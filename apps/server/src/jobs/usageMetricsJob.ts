import cron, { ScheduledTask } from "node-cron";
import { v4 as uuidv4 } from "uuid";

import { config } from "#config";
import { logger } from "#lib/logger";
import { prisma } from "#lib/prisma";
import { getRedis } from "#lib/redis";

import { flushUsageMetricsForDate, getPendingUsageMetricDates } from "#services/analyticsService";

let job: ScheduledTask | null = null;

const AUDIT_PRUNE_BATCH_SIZE = 5_000;
const AUDIT_PRUNE_MAX_BATCHES = 20;

const RELEASE_LOCK_LUA_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
  else
      return 0
  end
`;

/**
 * Returns a Date object representing the start of yesterday in UTC.
 * This ensures we only flush complete day cycles.
 */

function getTodayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Deletes AuditLog rows past the retention window.
 *
 * Batched rather than a single `deleteMany`, because the first run against a table that has never
 * been pruned could touch millions of rows and hold locks long enough to stall writers. The
 * per-run ceiling means a large backlog drains over several nights instead of in one long
 * transaction; steady state clears well inside a single batch.
 */
async function pruneAuditLogs() {
  const retentionDays = config.logging.auditRetentionDays;

  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let deleted = 0;

  for (let batch = 0; batch < AUDIT_PRUNE_MAX_BATCHES; batch += 1) {
    // Uses the existing @@index([createdAt]) on AuditLog for both the select and the delete.
    const stale = await prisma.auditLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: AUDIT_PRUNE_BATCH_SIZE,
    });

    if (!stale.length) break;

    const result = await prisma.auditLog.deleteMany({
      where: { id: { in: stale.map((row) => row.id) } },
    });

    deleted += result.count;

    if (stale.length < AUDIT_PRUNE_BATCH_SIZE) break;
  }

  if (deleted > 0) logger.info("Audit log retention prune completed", { deleted, retentionDays });
}

/**
 * Orchestrates the movement of metrics from Redis to Postgres.
 * Uses a distributed lock to ensure only one instance performs the flush.
 */

async function runFlush(reason: "startup" | "cron") {
  const redis = getRedis();

  const lockKey = "usage:flush:lock";
  const lockValue = uuidv4();
  const lockTTL = 60 * 5;

  let lockAcquired = false;

  try {
    const lockResult = await redis.set(lockKey, lockValue, {
      NX: true,
      EX: lockTTL,
    });

    lockAcquired = lockResult === "OK";

    if (!lockAcquired) {
      logger.warn(`Skipping metrics flush (${reason}): lock already held`);
      return;
    }

    // Runs before the "nothing to flush" early return below, so retention still applies on days
    // with no pending metrics. Failing to prune must not abort the metrics flush.
    try {
      await pruneAuditLogs();
    } catch (error) {
      logger.error("Audit log retention prune failed", {
        error: error instanceof Error ? error.message : error,
      });
    }

    const todayKey = getTodayUtcDate().toISOString().slice(0, 10);
    const dateKeys = (await getPendingUsageMetricDates()).filter((dateKey) => dateKey < todayKey);

    if (dateKeys.length === 0) {
      logger.info(`Usage metrics flush (${reason}) skipped: no completed days pending`);
      return;
    }

    for (const dateKey of dateKeys) {
      const result = await flushUsageMetricsForDate(new Date(`${dateKey}T00:00:00.000Z`));

      if ("skipped" in result && result.skipped) {
        logger.warn(`Usage metrics flush (${reason}) skipped: another flush is in progress`, {
          dateKey: result.dateKey,
        });
        continue;
      }

      logger.info(`Usage metrics flush (${reason}) completed`, {
        dateKey: result.dateKey,
        flushedEvents: result.flushedEvents,
      });
    }
  } catch (error) {
    logger.error(`Usage metrics flush (${reason}) failed`, {
      error: error instanceof Error ? error.message : error,
    });
  } finally {
    if (lockAcquired) {
      try {
        await redis.eval(RELEASE_LOCK_LUA_SCRIPT, {
          keys: [lockKey],
          arguments: [lockValue],
        });
      } catch (err) {
        logger.error("Failed to release metrics flush lock", err);
      }
    }
  }
}

/**
 * Schedules the daily metrics flush and runs an initial check on startup.
 */

export function startUsageMetricsJob() {
  const { flushCron, flushTimezone } = config.metrics;

  if (job) return;

  job = cron.schedule(
    flushCron,
    () => {
      void runFlush("cron");
    },
    { timezone: flushTimezone },
  );

  logger.info("Usage metrics flush job scheduled", {
    cron: flushCron,
    timezone: flushTimezone,
  });

  // Check on startup in case the cron was missed during downtime
  void runFlush("startup");
}

/**
 * Cleanly stops the cron job during server shutdown.
 */

export function stopUsageMetricsJob() {
  if (job) {
    job.stop();
    job = null;
    logger.info("Usage metrics flush job stopped");
  }
}

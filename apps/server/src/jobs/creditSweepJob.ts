import { v4 as uuidv4 } from "uuid";
import cron from "node-cron";

import { logger } from "#lib/logger";
import { getRedis } from "#lib/redis";
import { sweepExpiredCredits } from "#services/creditService";

let job: ReturnType<typeof cron.schedule> | null = null;

const LOCK_KEY = "credits:sweep:lock";
const LOCK_TTL_SECONDS = 300;

const RELEASE_LOCK_LUA_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
  else
      return 0
  end
`;

/**
 * Hourly credit expiry sweep (V-107): wallet reads no longer release overdue reservations or
 * expire due grants, so this is what keeps `balance` honest between write paths. One runner per
 * tick through a token-checked Redis lock, like the other jobs. Never rejects: a Redis blip or a
 * failed sweep is a logged skipped tick.
 */
export async function runCreditSweep(reason: "startup" | "cron"): Promise<void> {
  let redis: ReturnType<typeof getRedis>;

  try {
    redis = getRedis();
  } catch (error) {
    logger.warn(`Skipping credit expiry sweep (${reason}): Redis not ready`, {
      error: error instanceof Error ? error.message : error,
    });
    return;
  }

  const lockValue = uuidv4();
  let lockAcquired = false;

  try {
    lockAcquired =
      (await redis.set(LOCK_KEY, lockValue, { NX: true, EX: LOCK_TTL_SECONDS })) === "OK";

    if (!lockAcquired) {
      logger.debug(`Skipping credit expiry sweep (${reason}): lock held by another worker`);
      return;
    }

    const totals = await sweepExpiredCredits();
    if (totals.wallets > 0 || totals.failed > 0)
      logger.info(`Credit expiry sweep (${reason}) completed`, totals);
  } catch (error) {
    logger.error(`Credit expiry sweep (${reason}) failed`, {
      error: error instanceof Error ? error.message : error,
    });
  } finally {
    if (lockAcquired) {
      try {
        await redis.eval(RELEASE_LOCK_LUA_SCRIPT, { keys: [LOCK_KEY], arguments: [lockValue] });
      } catch (err) {
        logger.error("Failed to release credit expiry sweep lock", err);
      }
    }
  }
}

export function startCreditSweepJob() {
  if (job) return;

  job = cron.schedule("30 * * * *", () => {
    void runCreditSweep("cron");
  });
  logger.debug("Credit expiry sweep job scheduled", { cron: "30 * * * *" });

  // Catch up on anything that came due while no process was running.
  void runCreditSweep("startup");
}

// Stops scheduling only; an in-flight sweep is not tracked or awaited (Phase 4 item 1).
export function stopCreditSweepJob() {
  if (job) {
    job.stop();
    job = null;
    logger.info("Credit expiry sweep job stopped");
  }
}

import cron, { ScheduledTask } from "node-cron";

import { config } from "#config";
import { logger } from "#lib/logger";
import { ApiError } from "#lib/errors";
import { getRedis } from "#lib/redis";
import { createRunTracker } from "#lib/jobLock";

import {
  shouldSyncChangelogReleases,
  syncChangelogFromGitHubReleases,
} from "#services/changelog/index";

let job: ScheduledTask | null = null;
const runs = createRunTracker();

/** Never rejects; a Redis blip is a skipped tick logged at warn, not an error (V-101). */
export async function runChangelogSync(reason: "startup" | "cron"): Promise<void> {
  try {
    getRedis();
  } catch (error) {
    logger.warn(`Skipping changelog release sync (${reason}): Redis not ready`, {
      error: error instanceof Error ? error.message : error,
    });
    return;
  }

  try {
    // Mirrors the GitHub stats job: a restart is not a reason to re-scan GitHub. The cron
    // is the schedule, so it always runs; only the boot path checks freshness.
    if (reason === "startup" && !(await shouldSyncChangelogReleases())) {
      logger.debug("Changelog release sync (startup) skipped: last sync is still fresh.");
      return;
    }

    const result = await syncChangelogFromGitHubReleases();

    logger.info(`Changelog release sync (${reason}) success`, {
      created: result.created,
      refreshed: result.refreshed,
      skipped: result.skipped,
      total: result.total,
    });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 409) {
      logger.debug(`Changelog release sync (${reason}) locked by another instance. Skipping.`);
      return;
    }

    logger.error(`Changelog release sync (${reason}) failed`, {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/** Whether startChangelogSyncJob schedules anything; `/health/jobs` reports it disabled otherwise. */
export function isChangelogSyncJobEnabled(): boolean {
  return config.changelogSync.enabled;
}

export function startChangelogSyncJob() {
  const { cron: cronExpression, timezone } = config.changelogSync;

  if (!isChangelogSyncJobEnabled()) {
    logger.warn("Changelog release sync is disabled in config.");
    return;
  }

  if (job) return;

  job = cron.schedule(cronExpression, () => runs.track(runChangelogSync("cron")), { timezone });

  logger.debug("Changelog release sync cron started", { schedule: cronExpression });

  runs.track(runChangelogSync("startup"));
}

/** Stops scheduling and resolves once the sync in progress, if any, has finished. */
export function stopChangelogSyncJob(): Promise<void> {
  if (job) {
    job.stop();
    job = null;

    logger.info("Changelog release sync cron stopped.");
  }

  return runs.idle();
}

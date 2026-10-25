import cron, { ScheduledTask } from "node-cron";

import { config } from "#config";
import { logger } from "#lib/logger";
import { ApiError } from "#lib/errors";
import { getRedis } from "#lib/redis";
import { createRunTracker } from "#lib/jobLock";

import {
  isGitHubIssueSyncConfigured,
  shouldSyncGitHubStats,
  syncGitHubStatsFromGitHub,
} from "#services/github/index";

let job: ScheduledTask | null = null;
const runs = createRunTracker();
let warnedNotConfigured = false;

/** Never rejects; a Redis blip is a skipped tick logged at warn, not an error (V-101). */
export async function runGitHubSync(reason: "startup" | "cron"): Promise<void> {
  try {
    getRedis();
  } catch (error) {
    logger.warn(`Skipping GitHub sync (${reason}): Redis not ready`, {
      error: error instanceof Error ? error.message : error,
    });
    return;
  }

  try {
    // The cron is the schedule, so it always runs; only the boot path checks freshness. syncedAt
    // lands seconds after the previous tick, so a 12 h check skipped every second cron run (V-055).
    if (reason === "startup" && !(await shouldSyncGitHubStats())) {
      logger.debug(`GitHub sync (${reason}) skipped: Data is fresh.`);
      return;
    }

    // The cron's first run of each UTC day is a full sync (the only kind that drops issues deleted
    // or transferred on GitHub); its other runs, and the startup run, are incremental.
    const result = await syncGitHubStatsFromGitHub(reason === "cron" ? "daily" : false);

    logger.info(`GitHub sync (${reason}) success`, {
      itemsSynced:
        typeof result === "object" && result && "issueCount" in result ? result.issueCount : 0,
      syncedAt:
        typeof result === "object" && result && "syncedAt" in result ? result.syncedAt : new Date(),
    });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 409) {
      logger.debug(`GitHub sync (${reason}) locked by another instance. Skipping.`);
      return;
    }

    // GITHUB_OWNER/GITHUB_REPO unset: said once, not on every tick (V-058).
    if (error instanceof ApiError && error.statusCode === 503) {
      if (!warnedNotConfigured) logger.warn(`GitHub sync skipped: ${error.message}`);
      warnedNotConfigured = true;
      return;
    }

    logger.error(`GitHub sync (${reason}) failed`, {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/** Whether startGitHubSyncJob schedules anything; `/health/jobs` reports the job disabled otherwise. */
export function isGitHubSyncJobEnabled(): boolean {
  return config.github.syncEnabled && isGitHubIssueSyncConfigured();
}

export function startGitHubSyncJob() {
  const { syncEnabled, syncCron, syncTimezone } = config.github;

  if (!syncEnabled) {
    logger.warn("GitHub sync is disabled in config.");
    return;
  }

  // GITHUB_OWNER/GITHUB_REPO unset: every tick would fail the same way (V-058).
  if (!isGitHubSyncJobEnabled()) {
    logger.warn("GitHub sync is not scheduled: GITHUB_OWNER/GITHUB_REPO are not configured.");
    return;
  }

  if (job) return;

  job = cron.schedule(syncCron, () => runs.track(runGitHubSync("cron")), {
    timezone: syncTimezone,
  });

  logger.debug("GitHub sync cron started", { schedule: syncCron });

  runs.track(runGitHubSync("startup"));
}

/** Stops scheduling and resolves once the sync in progress, if any, has finished. */
export function stopGitHubSyncJob(): Promise<void> {
  if (job) {
    job.stop();
    job = null;

    logger.info("GitHub sync cron stopped.");
  }

  return runs.idle();
}

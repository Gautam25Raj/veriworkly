import cron, { ScheduledTask } from "node-cron";

import { config } from "#config";
import { logger } from "#lib/logger";
import { ApiError } from "#lib/errors";
import { getRedis } from "#lib/redis";

import { shouldSyncGitHubStats, syncGitHubStatsFromGitHub } from "#services/github/index";

let job: ScheduledTask | null = null;

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
    const needsSync = await shouldSyncGitHubStats();

    if (!needsSync) {
      logger.debug(`GitHub sync (${reason}) skipped: Data is fresh.`);
      return;
    }

    const result = await syncGitHubStatsFromGitHub(reason === "cron");

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

    logger.error(`GitHub sync (${reason}) failed`, {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export function startGitHubSyncJob() {
  const { syncEnabled, syncCron, syncTimezone } = config.github;

  if (!syncEnabled) {
    logger.warn("GitHub sync is disabled in config.");
    return;
  }

  if (job) return;

  job = cron.schedule(syncCron, () => void runGitHubSync("cron"), { timezone: syncTimezone });

  logger.debug("GitHub sync cron started", { schedule: syncCron });

  void runGitHubSync("startup");
}

// Stops scheduling only; an in-flight sync is not tracked or awaited (Phase 4 item 1).
export function stopGitHubSyncJob() {
  if (job) {
    job.stop();
    job = null;

    logger.info("GitHub sync cron stopped.");
  }
}

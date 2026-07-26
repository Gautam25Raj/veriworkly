import cron, { ScheduledTask } from "node-cron";

import { config } from "#config";
import { logger } from "#lib/logger";
import { ApiError } from "#lib/errors";

import { syncChangelogFromGitHubReleases } from "#services/changelogSyncService";

let job: ScheduledTask | null = null;

async function runSync(reason: "startup" | "cron") {
  try {
    const result = await syncChangelogFromGitHubReleases();

    logger.info(`Changelog release sync (${reason}) success`, {
      created: result.created,
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

export function startChangelogSyncJob() {
  const { enabled, cron: cronExpression, timezone } = config.changelogSync;

  if (!enabled) {
    logger.warn("Changelog release sync is disabled in config.");
    return;
  }

  if (job) return;

  job = cron.schedule(cronExpression, () => void runSync("cron"), { timezone });

  logger.info("Changelog release sync cron started", { schedule: cronExpression });

  void runSync("startup");
}

export function stopChangelogSyncJob() {
  if (job) {
    job.stop();
    job = null;

    logger.info("Changelog release sync cron stopped.");
  }
}

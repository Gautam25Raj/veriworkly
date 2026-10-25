import type { JobName } from "#lib/metrics";

import {
  isChangelogSyncJobEnabled,
  startChangelogSyncJob,
  stopChangelogSyncJob,
} from "./changelogSyncJob.js";
import { startCreditSweepJob, stopCreditSweepJob } from "./creditSweepJob.js";
import { isGitHubSyncJobEnabled, startGitHubSyncJob, stopGitHubSyncJob } from "./githubSyncJob.js";
import { startPortfolioAccessJob, stopPortfolioAccessJob } from "./portfolioAccessJob.js";
import { isRetentionEnabled, startRetentionJob, stopRetentionJob } from "./retentionJob.js";
import { startUsageMetricsJob, stopUsageMetricsJob } from "./usageMetricsJob.js";
import { startViewsFlushJob, stopViewsFlushJob } from "./viewsFlushJob.js";

const always = () => true;

/**
 * Every background job, once: what `index.ts` starts and stops, and what `/health/jobs` reports.
 * `enabled` is the same check the job's start function makes before scheduling anything, so the
 * health report and the schedule cannot drift apart.
 */
export const SCHEDULED_JOBS: ReadonlyArray<{
  name: JobName;
  start: () => void;
  stop: () => Promise<void>;
  enabled: () => boolean;
}> = [
  {
    name: "github-sync",
    start: startGitHubSyncJob,
    stop: stopGitHubSyncJob,
    enabled: isGitHubSyncJobEnabled,
  },
  {
    name: "changelog-sync",
    start: startChangelogSyncJob,
    stop: stopChangelogSyncJob,
    enabled: isChangelogSyncJobEnabled,
  },
  { name: "views-flush", start: startViewsFlushJob, stop: stopViewsFlushJob, enabled: always },
  {
    name: "usage-metrics",
    start: startUsageMetricsJob,
    stop: stopUsageMetricsJob,
    enabled: always,
  },
  {
    name: "portfolio-access",
    start: startPortfolioAccessJob,
    stop: stopPortfolioAccessJob,
    enabled: always,
  },
  { name: "credit-sweep", start: startCreditSweepJob, stop: stopCreditSweepJob, enabled: always },
  {
    name: "retention",
    start: startRetentionJob,
    stop: () => stopRetentionJob(),
    enabled: () => isRetentionEnabled(),
  },
];

/** Schedules every job (each start function skips itself when its configuration disables it). */
export function startScheduledJobs(): void {
  for (const job of SCHEDULED_JOBS) job.start();
}

/** Stops every job; resolves once each one's run in progress, if any, has finished. */
export async function stopScheduledJobs(): Promise<void> {
  await Promise.all(SCHEDULED_JOBS.map((job) => job.stop()));
}

/**
 * The jobs a process with CRON_ROLE=all schedules under the current configuration.
 * `/health/jobs` reports the others as disabled rather than stale forever. The cron role itself is
 * not consulted: an API-only replica (CRON_ROLE=none) still answers for the jobs another replica
 * runs.
 */
export function enabledJobs(): Set<JobName> {
  return new Set(SCHEDULED_JOBS.filter((job) => job.enabled()).map((job) => job.name));
}

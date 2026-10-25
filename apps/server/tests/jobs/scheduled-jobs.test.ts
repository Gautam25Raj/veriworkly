import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

/**
 * `/health/jobs` must describe exactly the jobs `index.ts` starts. Both read one table; these tests
 * pin the table to the job schedule list and `index.ts` to the table.
 */

const mocks = vi.hoisted(() => {
  const job = () => ({
    start: vi.fn(),
    stop: vi.fn(async () => undefined),
    enabled: vi.fn(() => true),
  });
  return {
    github: job(),
    changelog: job(),
    views: job(),
    usage: job(),
    portfolio: job(),
    credit: job(),
    retention: job(),
  };
});

vi.mock("#lib/redis", () => ({ getRedis: vi.fn() }));
vi.mock("#jobs/githubSyncJob", () => ({
  startGitHubSyncJob: mocks.github.start,
  stopGitHubSyncJob: mocks.github.stop,
  isGitHubSyncJobEnabled: mocks.github.enabled,
}));
vi.mock("#jobs/changelogSyncJob", () => ({
  startChangelogSyncJob: mocks.changelog.start,
  stopChangelogSyncJob: mocks.changelog.stop,
  isChangelogSyncJobEnabled: mocks.changelog.enabled,
}));
vi.mock("#jobs/viewsFlushJob", () => ({
  startViewsFlushJob: mocks.views.start,
  stopViewsFlushJob: mocks.views.stop,
}));
vi.mock("#jobs/usageMetricsJob", () => ({
  startUsageMetricsJob: mocks.usage.start,
  stopUsageMetricsJob: mocks.usage.stop,
}));
vi.mock("#jobs/portfolioAccessJob", () => ({
  startPortfolioAccessJob: mocks.portfolio.start,
  stopPortfolioAccessJob: mocks.portfolio.stop,
}));
vi.mock("#jobs/creditSweepJob", () => ({
  startCreditSweepJob: mocks.credit.start,
  stopCreditSweepJob: mocks.credit.stop,
}));
vi.mock("#jobs/retentionJob", () => ({
  startRetentionJob: mocks.retention.start,
  stopRetentionJob: mocks.retention.stop,
  isRetentionEnabled: mocks.retention.enabled,
}));

const { SCHEDULED_JOBS, enabledJobs, startScheduledJobs, stopScheduledJobs } =
  await import("#jobs/scheduledJobs");
const { JOB_SCHEDULES } = await import("#lib/metrics");

describe("the scheduled job table", () => {
  it("lists every job /health/jobs knows, once", () => {
    const names = SCHEDULED_JOBS.map((job) => job.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual(Object.keys(JOB_SCHEDULES).sort());
  });

  it("starts and stops every job in it", async () => {
    startScheduledJobs();
    await stopScheduledJobs();

    for (const job of Object.values(mocks)) {
      expect(job.start).toHaveBeenCalledTimes(1);
      expect(job.stop).toHaveBeenCalledTimes(1);
    }
  });

  it("reports as enabled exactly the jobs whose start function would schedule them", () => {
    mocks.github.enabled.mockReturnValue(false);
    mocks.retention.enabled.mockReturnValue(false);

    expect([...enabledJobs()].sort()).toEqual([
      "changelog-sync",
      "credit-sweep",
      "portfolio-access",
      "usage-metrics",
      "views-flush",
    ]);
  });

  it("is what index.ts starts and stops: no job is started or stopped there by hand", () => {
    const source = readFileSync(path.resolve(__dirname, "../../src/index.ts"), "utf8");

    expect(source).toContain("startScheduledJobs()");
    expect(source).toContain("stopScheduledJobs()");
    expect(source).not.toMatch(/\b(start|stop)\w+Job\(\)/);
  });
});

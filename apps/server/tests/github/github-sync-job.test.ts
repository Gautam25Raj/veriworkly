import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * V-055 and V-058 against the real job and the real issue-sync service; only the stores, config
 * and logger are mocked. `shouldSyncGitHubStats` is the only caller of `gitHubSync.findUnique`
 * before the sync's own guard, so that call is the freshness check.
 */

const mocks = vi.hoisted(() => ({
  config: {
    github: {
      owner: "",
      repo: "",
      token: "",
      projectUrl: "https://github.com/x/y",
      syncCron: "0 0,12 * * *",
      syncTimezone: "UTC",
      syncEnabled: true,
    },
  },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  findUnique: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock("#config", () => ({ config: mocks.config }));
vi.mock("#lib/logger", () => ({ logger: mocks.logger }));
vi.mock("#lib/prisma", () => ({
  prisma: { gitHubSync: { findUnique: mocks.findUnique } },
}));
vi.mock("#lib/redis", () => ({
  getRedis: () => ({ set: mocks.redisSet, eval: vi.fn() }),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
  cacheDelByPrefix: vi.fn(),
}));

const { runGitHubSync } = await import("#jobs/githubSyncJob");

describe("runGitHubSync", () => {
  beforeEach(() => {
    mocks.findUnique.mockResolvedValue({ syncedAt: new Date() });
  });

  it("warns exactly once across runs when GITHUB_OWNER/GITHUB_REPO are empty (V-058)", async () => {
    await runGitHubSync("cron");
    await runGitHubSync("cron");
    await runGitHubSync("cron");

    expect(mocks.logger.warn).toHaveBeenCalledTimes(1);
    expect(mocks.logger.warn.mock.calls[0][0]).toMatch(/not configured/);
    expect(mocks.logger.error).not.toHaveBeenCalled();
    // The guard runs before the lock, so an unconfigured sync never touches Redis.
    expect(mocks.redisSet).not.toHaveBeenCalled();
  });

  it("skips the freshness check on cron runs and keeps it at startup (V-055)", async () => {
    await runGitHubSync("cron");
    expect(mocks.findUnique).not.toHaveBeenCalled();

    // Data synced a second ago: the startup run checks freshness and stops there.
    await runGitHubSync("startup");
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
  });
});

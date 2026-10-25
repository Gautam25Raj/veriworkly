import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The job lock's failure handling with a scripted Redis. Its Lua scripts and TTL arithmetic run
 * against real Redis in tests/integration/job-locks.test.ts; here only what a real Redis cannot be
 * made to do on cue: fail one GET.
 */

const mocks = vi.hoisted(() => ({
  token: "",
  get: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  recordJobSuccess: vi.fn(),
}));

vi.mock("#lib/logger", () => ({ logger: mocks.logger }));
vi.mock("#lib/metrics", () => ({ recordJobSuccess: mocks.recordJobSuccess }));
vi.mock("#lib/redis", () => ({
  getRedis: () => ({
    set: async (_key: string, token: string) => {
      mocks.token = token;
      return "OK";
    },
    get: mocks.get,
    eval: async () => 1,
  }),
}));

const { acquireJobLock, withJobLock } = await import("#lib/jobLock");

beforeEach(() => {
  mocks.get.mockImplementation(async () => mocks.token);
});

describe("stillOwner()", () => {
  it("survives one failed GET: the check is retried before the lock is declared lost", async () => {
    const lock = (await acquireJobLock("test:lock", { ttlMs: 60_000 }))!;
    mocks.get.mockRejectedValueOnce(new Error("socket closed"));

    expect(await lock.stillOwner()).toBe(true);
    // Not latched as lost: a later check still asks Redis.
    expect(await lock.stillOwner()).toBe(true);
    await lock.release();
  });

  it("is false, for good, when the retry fails too", async () => {
    const lock = (await acquireJobLock("test:lock", { ttlMs: 60_000 }))!;
    mocks.get.mockRejectedValueOnce(new Error("down")).mockRejectedValueOnce(new Error("down"));

    expect(await lock.stillOwner()).toBe(false);
    expect(await lock.stillOwner()).toBe(false);
    await lock.release();
  });

  it("is false at once on a definite token mismatch, with no retry", async () => {
    const lock = (await acquireJobLock("test:lock", { ttlMs: 60_000 }))!;
    mocks.get.mockClear();
    mocks.get.mockResolvedValueOnce("someone-else");

    expect(await lock.stillOwner()).toBe(false);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    await lock.release();
  });
});

describe("withJobLock", () => {
  it("names the job and the lock key when the run fails", async () => {
    await withJobLock("credits:sweep:lock", { ttlMs: 60_000, job: "credit-sweep" }, async () => {
      throw new Error("boom");
    });

    expect(mocks.logger.error).toHaveBeenCalledWith(
      "Job credit-sweep (credits:sweep:lock) failed",
      expect.objectContaining({ error: "boom" }),
    );
    expect(mocks.recordJobSuccess).not.toHaveBeenCalled();
  });

  it("falls back to the lock key when no job name is given", async () => {
    await withJobLock("some:lock", { ttlMs: 60_000 }, async () => {
      throw new Error("boom");
    });

    expect(mocks.logger.error).toHaveBeenCalledWith(
      "Job some:lock failed",
      expect.objectContaining({ error: "boom" }),
    );
  });
});

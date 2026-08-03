import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin overview reads are aggregate scans, and the action queue in particular is fetched by
 * the studio's `AdminLayout` on *every* admin navigation. These tests pin the two properties that
 * make caching them safe: a repeat read must not touch the database, and an operator's own write
 * must drop the cache immediately rather than leaving a stale badge until the TTL lapses.
 */

/**
 * `vi.hoisted` because both mock factories below are lifted above every import in this file, so
 * anything they close over has to be initialised up there with them — a plain `const` would still
 * be in its temporal dead zone when the factory runs.
 */
const { count, store } = vi.hoisted(() => ({
  count: vi.fn(async () => 3),
  store: new Map<string, string>(),
}));

vi.mock("#lib/redis", () => ({
  cacheGet: vi.fn(async (key: string) => {
    const raw = store.get(key);
    return raw ? JSON.parse(raw) : null;
  }),
  cacheSet: vi.fn(async (key: string, value: unknown) => {
    store.set(key, JSON.stringify(value));
  }),
  cacheDelByPrefix: vi.fn(async (prefix: string) => {
    for (const key of [...store.keys()]) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  }),
}));

vi.mock("#lib/prisma", () => ({
  prisma: {
    ambassadorApplication: { count, findMany: vi.fn(async () => []) },
    affiliateWithdrawal: { count },
    affiliateCommission: { count },
    billingWebhookEvent: { count },
    portfolioPublication: { count, findMany: vi.fn(async () => []) },
    portfolioAsset: { count },
    user: { count, groupBy: vi.fn(async () => []), findMany: vi.fn(async () => []) },
    session: { count },
    subscription: { findMany: vi.fn(async () => []) },
  },
}));

/**
 * Imported statically rather than with `await import(...)` inside each test. `vi.mock` is hoisted
 * above these imports, so the mocks above still apply — but pulling the overview service in also
 * pulls in every domain summary service it fans out to, and paying that once at module load keeps
 * it out of the first test's 5s budget, where it intermittently blew the timeout under full-suite
 * load while passing comfortably in isolation.
 */
import { invalidateAdminCacheOnWrite } from "../../src/middleware/adminCacheInvalidation";
import { getActionQueue } from "../../src/services/admin/adminOverviewService";
import {
  ADMIN_CACHE_PREFIX,
  adminOverviewCacheKey,
  adminTimeSeriesCacheKey,
  invalidateAdminCaches,
} from "../../src/services/admin/cache";

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("admin overview caching", () => {
  it("serves a repeated action-queue read from cache instead of re-counting", async () => {
    const first = await getActionQueue();
    const countsAfterFirst = count.mock.calls.length;

    const second = await getActionQueue();

    expect(countsAfterFirst).toBe(6);
    expect(second).toEqual(first);
    // The decisive assertion: the second read added no queries at all.
    expect(count.mock.calls.length).toBe(countsAfterFirst);
  });

  it("re-counts after an admin write invalidates the cache", async () => {
    await getActionQueue();
    const countsBefore = count.mock.calls.length;

    await invalidateAdminCaches();
    await getActionQueue();

    expect(count.mock.calls.length).toBe(countsBefore * 2);
  });

  it("keys the overview by window, so switching ranges is not served a stale window", async () => {
    expect(adminOverviewCacheKey(7)).not.toBe(adminOverviewCacheKey(30));
    expect(adminTimeSeriesCacheKey(7)).not.toBe(adminTimeSeriesCacheKey(30));
  });

  it("scopes its prefix so invalidation cannot clear unrelated admin keys", async () => {
    // The legacy analytics dashboard owns `admin:dashboard:stats` and has its own invalidation
    // triggered by the usage-metric flush; a prefix delete here must leave it alone.
    store.set("admin:dashboard:stats", JSON.stringify({ totals: {} }));
    store.set(`${ADMIN_CACHE_PREFIX}queue`, JSON.stringify({ failedWebhooks: 1 }));

    await invalidateAdminCaches();

    expect(store.has(`${ADMIN_CACHE_PREFIX}queue`)).toBe(false);
    expect(store.has("admin:dashboard:stats")).toBe(true);
  });
});

describe("admin cache invalidation middleware", () => {
  type FinishHandler = () => void;

  function runMiddleware(method: string, statusCode: number) {
    const handlers: FinishHandler[] = [];
    const next = vi.fn();

    const res = {
      statusCode,
      on: (event: string, handler: FinishHandler) => {
        if (event === "finish") handlers.push(handler);
      },
    };

    return { handlers, next, res, method };
  }

  it("invalidates only after a successful mutation", async () => {
    const seed = () => store.set(`${ADMIN_CACHE_PREFIX}queue`, JSON.stringify({ pending: 1 }));

    const cases: Array<{ method: string; status: number; survives: boolean }> = [
      // A read must never invalidate — that would defeat the cache entirely.
      { method: "GET", status: 200, survives: true },
      // A rejected write changed nothing, so there is nothing to drop.
      { method: "PATCH", status: 403, survives: true },
      { method: "POST", status: 422, survives: true },
      // Successful writes drop the cache.
      { method: "PATCH", status: 200, survives: false },
      { method: "POST", status: 201, survives: false },
      { method: "DELETE", status: 204, survives: false },
    ];

    for (const { method, status, survives } of cases) {
      store.clear();
      seed();

      const ctx = runMiddleware(method, status);

      invalidateAdminCacheOnWrite({ method } as never, ctx.res as never, ctx.next as never);

      expect(ctx.next, `${method} must always continue the chain`).toHaveBeenCalled();

      // The middleware defers to "finish" so it can read the real status code.
      for (const handler of ctx.handlers) handler();
      await Promise.resolve();

      expect(
        store.has(`${ADMIN_CACHE_PREFIX}queue`),
        `${method} ${status} should ${survives ? "keep" : "drop"} the cache`,
      ).toBe(survives);
    }
  });
});

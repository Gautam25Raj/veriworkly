import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "#lib/prisma";
import { getRedis } from "#lib/redis";
import { flushUsageMetricsForDate } from "#services/analyticsService";
import { PortfolioService } from "#services/portfolioService";
import { ShareService } from "#services/shareService";

/**
 * V-127 (rest): the per-date usage flush, the per-date portfolio views flush and the share views
 * flush hold token locks that are renewed while they run and released by compare-and-delete, so
 * a flush that outlives its TTL never deletes the lock the next runner now holds.
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Replaces the lock from under a running flush, the way an expiry plus a second runner would. */
async function stealLock(key: string) {
  const redis = getRedis();
  await redis.del(key);
  await redis.set(key, "someone-else", { PX: 60_000 });
}

/** Delays the next transaction long enough to steal the lock meanwhile. */
function slowTransaction(onStart: () => Promise<void>) {
  const original = prisma.$transaction.bind(prisma);
  return vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (...args: unknown[]) => {
    await onStart();
    await sleep(50);
    return (original as (...a: unknown[]) => Promise<unknown>)(...args);
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await getRedis().flushDb();
});

describe("usage metrics flush lock", () => {
  const dateKey = "2026-10-03";
  const lockKey = `usage:daily:${dateKey}:flush-lock`;

  it("skips while another runner holds the lock, and leaves that lock alone", async () => {
    const redis = getRedis();
    await redis.hSet(`usage:daily:${dateKey}`, "resume_created", "3");
    await redis.set(lockKey, "someone-else", { PX: 60_000 });

    const result = await flushUsageMetricsForDate(new Date(`${dateKey}T00:00:00.000Z`));

    expect(result).toMatchObject({ skipped: true, flushedEvents: 0 });
    expect(await redis.get(lockKey)).toBe("someone-else");
    expect(await redis.hGet(`usage:daily:${dateKey}`, "resume_created")).toBe("3");
  });

  it("holds a token, not a constant, and never deletes a lock another runner took over", async () => {
    const redis = getRedis();
    await redis.hSet(`usage:daily:${dateKey}`, "resume_created", "5");

    let tokenSeen: string | null = null;
    slowTransaction(async () => {
      tokenSeen = await redis.get(lockKey);
      await stealLock(lockKey);
    });

    await flushUsageMetricsForDate(new Date(`${dateKey}T00:00:00.000Z`));

    expect(tokenSeen).not.toBeNull();
    expect(tokenSeen).not.toBe("1");
    expect(await redis.get(lockKey)).toBe("someone-else");
    // The data still landed: losing the lock after the commit only skips the Redis cleanup.
    const row = await prisma.usageMetricDaily.findFirst({ where: { event: "resume_created" } });
    expect(row?.count).toBe(5);
  });
});

describe("portfolio views flush lock", () => {
  it("never deletes a lock another runner took over", async () => {
    const redis = getRedis();
    const dateKey = "2026-10-04";
    const lockKey = `portfolio:views:buffer:${dateKey}:flush-lock`;
    const user = await prisma.user.create({
      data: { email: `views-${randomUUID()}@example.test`, emailVerified: true },
    });
    const document = await prisma.document.create({
      data: { userId: user.id, type: "PORTFOLIO", title: "Site", slug: "site", content: {} },
    });
    const publication = await prisma.portfolioPublication.create({
      data: {
        userId: user.id,
        documentId: document.id,
        subdomain: `site${randomUUID().slice(0, 8)}`,
        templateId: "signal",
        snapshot: {},
      },
    });
    await redis.hSet(`portfolio:views:buffer:${dateKey}`, `${publication.id}:direct`, "2");

    slowTransaction(() => stealLock(lockKey));
    await PortfolioService.flushViewsForDate(dateKey);

    expect(await redis.get(lockKey)).toBe("someone-else");
  });
});

describe("share views flush lock", () => {
  it("never deletes a lock another runner took over", async () => {
    const redis = getRedis();
    const lockKey = "share:views:flush-lock";
    await redis.hSet("share:links:view_count", "missing-link", "1");

    slowTransaction(() => stealLock(lockKey));
    await ShareService.flushShareViews();

    expect(await redis.get(lockKey)).toBe("someone-else");
  });
});

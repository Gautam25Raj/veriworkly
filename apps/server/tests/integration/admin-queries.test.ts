import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "#app";
import { pool, poolMax, prisma } from "#lib/prisma";
import { getRedis } from "#lib/redis";
import { getAdminTimeSeries } from "#services/admin/adminTimeSeriesService";

import { STUDIO_ORIGIN } from "./env.js";
import { createUserWithSession, type TestUser } from "./helpers/auth.js";

const ADMIN_BASE = "/api/v1/admin";
const DAY_MS = 24 * 60 * 60 * 1000;

let adminPromise: Promise<TestUser> | undefined;
const adminUser = () =>
  (adminPromise ??= createUserWithSession({ email: "admin@example.test", emailVerified: true }));

const adminGet = async (url: string) => {
  const admin = await adminUser();
  return request(app).get(url).set("Origin", STUDIO_ORIGIN).set("Cookie", admin.cookie);
};

/** UTC midnight `days` ago plus `hours`, so a row lands on a known UTC calendar day. */
const utcDayAt = (daysAgo: number, hours: number) => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, hours),
  );
};

/**
 * Puts every connection in the shared pool on `zone`. A session-level `SET` survives the client
 * being released, so checking out all `poolMax` clients at once and setting each one covers every
 * connection Prisma can be handed afterwards.
 */
async function setPoolTimeZone(zone: string) {
  const clients = await Promise.all(Array.from({ length: poolMax }, () => pool.connect()));
  try {
    await Promise.all(clients.map((client) => client.query(`SET TIME ZONE '${zone}'`)));
  } finally {
    for (const client of clients) client.release();
  }
}

beforeEach(async () => {
  await getRedis().flushDb();
});

describe("admin time series (V-071)", () => {
  it("buckets by UTC day regardless of the session time zone", async () => {
    const user = await createUserWithSession();
    // 20:00 UTC two days ago is 01:30 the next day in Kolkata, so a session-zone `date_trunc`
    // of the timestamptz lands it in the following day's bucket.
    await prisma.user.update({ where: { id: user.id }, data: { createdAt: utcDayAt(2, 20) } });

    const expectedDay = utcDayAt(2, 0).toISOString().slice(0, 10);

    await setPoolTimeZone("UTC");
    const utc = await getAdminTimeSeries(7);
    await getRedis().flushDb();

    await setPoolTimeZone("Asia/Kolkata");
    try {
      const kolkata = await getAdminTimeSeries(7);

      const utcIndex = utc.buckets.indexOf(expectedDay);
      expect(utcIndex).toBeGreaterThanOrEqual(0);
      expect(utc.series.signups[utcIndex]).toBeGreaterThanOrEqual(1);
      expect(kolkata.buckets).toEqual(utc.buckets);
      expect(kolkata.series).toEqual(utc.series);
    } finally {
      await setPoolTimeZone("UTC");
    }
  });

  it("counts a since-cancelled subscription on the day it was created", async () => {
    const user = await createUserWithSession();
    await prisma.subscription.create({
      data: {
        userId: user.id,
        provider: "dodo",
        status: "CANCELED",
        createdAt: utcDayAt(1, 10),
      },
    });

    const series = await getAdminTimeSeries(7);
    const index = series.buckets.indexOf(utcDayAt(1, 0).toISOString().slice(0, 10));

    expect(series.series.subscriptions[index]).toBe(1);
  });
});

describe("admin overview (V-069)", () => {
  it("returns the other sections when one section's query throws", async () => {
    vi.spyOn(prisma.ambassadorApplication, "groupBy").mockRejectedValue(new Error("boom"));

    const response = await adminGet(`${ADMIN_BASE}/overview?days=30`);

    expect(response.status).toBe(200);
    const data = response.body.data;
    expect(data.ambassadors).toEqual({ error: true });
    expect(typeof data.users.total).toBe("number");
    expect(typeof data.billing.webhooks.failed).toBe("number");
    expect(data.actionQueue.pendingAmbassadorApplications).toBeNull();
    expect(typeof data.actionQueue.failedWebhooks).toBe("number");
  });

  it("does not cache an overview with a failed section", async () => {
    const groupBy = vi
      .spyOn(prisma.ambassadorApplication, "groupBy")
      .mockRejectedValue(new Error("boom"));

    const failed = await adminGet(`${ADMIN_BASE}/overview?days=30`);
    expect(failed.status).toBe(200);
    expect(failed.body.data.ambassadors).toEqual({ error: true });

    groupBy.mockRestore();

    // Same key, no flush: a cached partial would come back with the error still in it.
    const rebuilt = await adminGet(`${ADMIN_BASE}/overview?days=30`);
    expect(rebuilt.status).toBe(200);
    expect(typeof rebuilt.body.data.ambassadors.pending).toBe("number");
    expect(typeof rebuilt.body.data.actionQueue.pendingAmbassadorApplications).toBe("number");
  });

  it("serves the user createdAt window from an index", async () => {
    const now = Date.now();
    await prisma.user.createMany({
      data: Array.from({ length: 4000 }, (_, i) => ({
        email: `seed-${i}@example.test`,
        name: `Seed ${i}`,
        // Spread over ~2 years, so a 30-day window is a few percent of the table.
        createdAt: new Date(now - (i % 730) * DAY_MS - i * 1000),
      })),
    });
    await prisma.$executeRawUnsafe(`ANALYZE "User"`);

    const since = new Date(now - 30 * DAY_MS);
    const plan = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>`
      EXPLAIN SELECT COUNT(*) FROM "User" WHERE "createdAt" >= ${since}
    `;
    const text = plan.map((row) => row["QUERY PLAN"]).join("\n");

    expect(text).toContain("Index");
    expect(text).not.toContain("Seq Scan");
  });
});

describe("request-log list (V-078)", () => {
  it("walks every row once through the keyset cursor", async () => {
    const base = Date.now() - DAY_MS;
    // Pairs share a timestamp so the `id` tie-break is exercised.
    await prisma.auditLog.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        method: "GET",
        path: `/keyset-seed/${i}`,
        status: 200,
        createdAt: new Date(base - Math.floor(i / 2) * 1000),
      })),
    });

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const query = new URLSearchParams({ path: "/keyset-seed/", limit: "25" });
      if (cursor) query.set("cursor", cursor);

      const response = await adminGet(`${ADMIN_BASE}/system/request-logs?${query}`);
      expect(response.status).toBe(200);

      const data = response.body.data;
      seen.push(...data.items.map((item: { id: string }) => item.id));
      cursor = data.nextCursor;
      pages += 1;
      expect(data.hasMore).toBe(cursor !== null);
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(60);
    expect(new Set(seen).size).toBe(60);
  });

  it("defaults to the last seven days", async () => {
    await prisma.auditLog.create({
      data: {
        method: "GET",
        path: "/window-seed/old",
        status: 500,
        createdAt: new Date(Date.now() - 8 * DAY_MS),
      },
    });

    const response = await adminGet(`${ADMIN_BASE}/system/request-logs?path=/window-seed/`);
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(0);
    expect(response.body.data.total).toBeNull();
  });
});

describe("audit filters (V-077)", () => {
  it("returns each target type and actor once", async () => {
    const admin = await adminUser();
    const other = await createUserWithSession();

    await prisma.adminAuditEntry.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        actorId: i % 2 ? admin.id : other.id,
        action: "user.update",
        targetType: ["user", "document", "portfolio"][i % 3]!,
      })),
    });

    const response = await adminGet(`${ADMIN_BASE}/audit/filters`);
    expect(response.status).toBe(200);

    const { targetTypes, actors } = response.body.data;
    expect(targetTypes).toEqual(["document", "portfolio", "user"]);
    expect(actors.map((actor: { id: string }) => actor.id).sort()).toEqual(
      [admin.id, other.id].sort(),
    );
  });
});

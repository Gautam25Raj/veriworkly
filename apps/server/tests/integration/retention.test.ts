import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyRetention,
  PURGED_DOCUMENT_CONTENT,
  readRetentionSettings,
  type RetentionSettings,
} from "#jobs/retentionJob";
import { pool, prisma } from "#lib/prisma";
import { DocumentService } from "#services/documentService";
import { restoreDocument as adminRestoreDocument } from "#services/admin/adminDocumentService";

import { createUserWithSession } from "./helpers/auth.js";

/**
 * V-116: the retention job against a real Postgres. Every rule gets one row just past its window
 * and one just inside it (an hour either side), and only the old one may change.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const now = new Date();

/** `days` before now, nudged an hour older ("old") or younger ("fresh") than the cutoff. */
const at = (days: number, side: "old" | "fresh") =>
  new Date(now.getTime() - days * DAY_MS + (side === "old" ? -HOUR_MS : HOUR_MS));

const DEFAULTS = readRetentionSettings({});

const disabled: RetentionSettings = Object.fromEntries(
  Object.keys(DEFAULTS).map((key) => [key, 0]),
) as RetentionSettings;

const only = (setting: keyof RetentionSettings, days = DEFAULTS[setting]): RetentionSettings => ({
  ...disabled,
  [setting]: days,
});

async function setTimestamp(table: string, column: string, id: string, value: Date) {
  await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET "${column}" = $1 WHERE "id" = $2`,
    value,
    id,
  );
}

async function ids(table: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "${table}" ORDER BY "id"`,
  );
  return rows.map((row) => row.id);
}

beforeEach(async () => {
  // Users cascade to sessions, documents, shares, publications, views, wallets and clicks.
  await prisma.$executeRawUnsafe(
    `TRUNCATE "User", "Verification", "BillingWebhookEvent", "AuditLog", "AdminAuditEntry",
       "ViewFlushBatch", "UsageMetricFlushBatch" CASCADE`,
  );
});

describe("retention defaults", () => {
  it("match the owner's windows, and RETENTION_AUDIT_LOG_DAYS wins over the old name", () => {
    expect(DEFAULTS).toEqual({
      expiredSessions: 1,
      expiredVerifications: 1,
      webhookPayloads: 30,
      auditLogs: 90,
      adminAuditEntries: 365,
      creditReservations: 90,
      flushBatches: 7,
      affiliateClicks: 0,
      portfolioViews: 0,
      deletedDocuments: 30,
    });
    expect(readRetentionSettings({ RETENTION_AUDIT_LOG_DAYS: "0" }).auditLogs).toBe(0);
    expect(readRetentionSettings({ RETENTION_SESSION_DAYS_TYPO: "x" }).expiredSessions).toBe(1);
  });
});

describe("retention rules (V-116)", () => {
  it("deletes expired sessions and verifications only past the 1-day grace", async () => {
    const user = await createUserWithSession();
    await prisma.session.deleteMany({});
    const [, freshSession] = await Promise.all(
      (["old", "fresh"] as const).map((side) =>
        prisma.session.create({
          data: { userId: user.id, token: randomUUID(), expiresAt: at(1, side) },
        }),
      ),
    );
    const [, freshVerification] = await Promise.all(
      (["old", "fresh"] as const).map((side) =>
        prisma.verification.create({
          data: { identifier: `id-${side}`, value: randomUUID(), expiresAt: at(1, side) },
        }),
      ),
    );

    const summary = await applyRetention({
      settings: { ...disabled, expiredSessions: 1, expiredVerifications: 1 },
      now,
    });

    expect(summary.affected).toEqual({ expiredSessions: 1, expiredVerifications: 1 });
    expect(await ids("Session")).toEqual([freshSession!.id]);
    expect(await ids("Verification")).toEqual([freshVerification!.id]);
  });

  it("redacts PROCESSED webhook payloads after 30 days, never FAILED or PROCESSING ones", async () => {
    const payload = { data: { customer: { email: "buyer@example.test" } } };
    const make = async (status: "PROCESSED" | "FAILED" | "PROCESSING", side: "old" | "fresh") => {
      const row = await prisma.billingWebhookEvent.create({
        data: {
          providerEventId: randomUUID(),
          type: "payment.succeeded",
          payload,
          status,
          error: status === "FAILED" ? "boom" : null,
        },
      });
      await setTimestamp("BillingWebhookEvent", "createdAt", row.id, at(30, side));
      return row.id;
    };
    const oldProcessed = await make("PROCESSED", "old");
    const freshProcessed = await make("PROCESSED", "fresh");
    const oldFailed = await make("FAILED", "old");
    // Still being handled, or its handler died mid-way: the payload is what a retry needs.
    const oldProcessing = await make("PROCESSING", "old");

    const first = await applyRetention({ settings: only("webhookPayloads"), now });
    const second = await applyRetention({ settings: only("webhookPayloads"), now });

    expect(first.affected).toEqual({ webhookPayloadsRedacted: 1 });
    // Already-redacted rows are not rewritten night after night.
    expect(second.affected).toEqual({ webhookPayloadsRedacted: 0 });

    const rows = await prisma.billingWebhookEvent.findMany();
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(oldProcessed)).toMatchObject({
      payload: { redacted: true, type: "payment.succeeded" },
      status: "PROCESSED",
    });
    expect(byId.get(freshProcessed)?.payload).toEqual(payload);
    expect(byId.get(oldFailed)).toMatchObject({ payload, status: "FAILED", error: "boom" });
    expect(byId.get(oldProcessing)).toMatchObject({ payload, status: "PROCESSING" });
  });

  it("deletes request and admin audit rows past 90 days and 1 year", async () => {
    for (const side of ["old", "fresh"] as const) {
      await prisma.auditLog.create({
        data: {
          id: `audit-${side}`,
          method: "GET",
          path: "/x",
          status: 500,
          createdAt: at(90, side),
        },
      });
      await prisma.adminAuditEntry.create({
        data: { id: `admin-${side}`, action: "x", targetType: "user", createdAt: at(365, side) },
      });
    }

    const summary = await applyRetention({
      settings: { ...disabled, auditLogs: 90, adminAuditEntries: 365 },
      now,
    });

    expect(summary.affected).toEqual({ auditLogs: 1, adminAuditEntries: 1 });
    expect(await ids("AuditLog")).toEqual(["audit-fresh"]);
    expect(await ids("AdminAuditEntry")).toEqual(["admin-fresh"]);
  });

  it("deletes terminal credit reservations after 90 days and never touches PENDING ones", async () => {
    const days = DEFAULTS.creditReservations;
    const user = await createUserWithSession();
    const wallet = await prisma.creditWallet.create({ data: { userId: user.id } });
    const make = async (
      id: string,
      status: "PENDING" | "COMMITTED" | "RELEASED" | "EXPIRED",
      side: "old" | "fresh",
    ) => {
      await prisma.creditReservation.create({
        data: {
          id,
          walletId: wallet.id,
          userId: user.id,
          requestId: randomUUID(),
          action: "ai",
          cost: 1,
          status,
          expiresAt: at(days + 1, "old"),
        },
      });
      await setTimestamp("CreditReservation", "updatedAt", id, at(days, side));
    };
    await make("r-committed-old", "COMMITTED", "old");
    await make("r-released-old", "RELEASED", "old");
    await make("r-expired-old", "EXPIRED", "old");
    await make("r-committed-fresh", "COMMITTED", "fresh");
    await make("r-pending-old", "PENDING", "old");

    const summary = await applyRetention({ settings: only("creditReservations"), now });

    expect(summary.affected).toEqual({ creditReservations: 3 });
    expect(await ids("CreditReservation")).toEqual(["r-committed-fresh", "r-pending-old"]);
  });

  it("deletes flush markers past 7 days, affiliate clicks and portfolio views past 180", async () => {
    const affiliate = await createUserWithSession();
    const document = await prisma.document.create({
      data: { userId: affiliate.id, type: "PORTFOLIO", title: "Site", slug: "site", content: {} },
    });
    const publication = await prisma.portfolioPublication.create({
      data: {
        userId: affiliate.id,
        documentId: document.id,
        subdomain: `site${randomUUID().slice(0, 8)}`,
        templateId: "signal",
        snapshot: {},
      },
    });

    for (const side of ["old", "fresh"] as const) {
      await prisma.viewFlushBatch.create({
        data: { id: `v-${side}`, kind: "share", createdAt: at(7, side) },
      });
      await prisma.usageMetricFlushBatch.create({
        data: { id: `u-${side}`, date: at(30, "old"), createdAt: at(7, side) },
      });
      await prisma.affiliateClick.create({
        data: { id: `c-${side}`, affiliateId: affiliate.id, code: "abc", createdAt: at(180, side) },
      });
      await prisma.portfolioViewDaily.create({
        data: { id: `p-${side}`, publicationId: publication.id, date: at(180, side), count: 3 },
      });
    }

    const summary = await applyRetention({
      settings: { ...disabled, flushBatches: 7, affiliateClicks: 180, portfolioViews: 180 },
      now,
    });

    expect(summary.affected).toEqual({
      viewFlushBatches: 1,
      usageMetricFlushBatches: 1,
      affiliateClicks: 1,
      portfolioViews: 1,
    });
    expect(await ids("ViewFlushBatch")).toEqual(["v-fresh"]);
    expect(await ids("UsageMetricFlushBatch")).toEqual(["u-fresh"]);
    expect(await ids("AffiliateClick")).toEqual(["c-fresh"]);
    expect(await ids("PortfolioViewDaily")).toEqual(["p-fresh"]);
  });

  it("replaces soft-deleted content with the purge marker after 30 days, keeping rows and shares", async () => {
    const user = await createUserWithSession();
    const content = { basics: { name: "Ada" } };
    const make = (id: string, deletedAt: Date | null, body: object = content) =>
      prisma.document.create({
        data: { id, userId: user.id, title: id, slug: id, content: body, deletedAt },
      });
    await make("d-old", at(30, "old"));
    await make("d-old-shared", at(30, "old"));
    // A document that was empty when deleted is purged too: emptiness is not the marker.
    await make("d-old-empty", at(30, "old"), {});
    await make("d-fresh", at(30, "fresh"));
    await make("d-live", null);
    await prisma.shareLink.create({
      data: { userId: user.id, documentId: "d-old-shared", slug: "shared", snapshot: content },
    });
    const before = await prisma.document.findUniqueOrThrow({ where: { id: "d-old" } });

    const summary = await applyRetention({ settings: only("deletedDocuments"), now });
    const second = await applyRetention({ settings: only("deletedDocuments"), now });

    expect(summary.affected).toEqual({ deletedDocumentsPurged: 3 });
    // Rows already carrying the marker are skipped.
    expect(second.affected).toEqual({ deletedDocumentsPurged: 0 });
    const docs = new Map((await prisma.document.findMany()).map((doc) => [doc.id, doc]));
    expect(docs.size).toBe(5);
    expect(docs.get("d-old")?.content).toEqual(PURGED_DOCUMENT_CONTENT);
    expect(docs.get("d-old")?.deletedAt).toEqual(before.deletedAt);
    // The sync cursor is updatedAt; a purge must not surface the row as an edit.
    expect(docs.get("d-old")?.updatedAt).toEqual(before.updatedAt);
    expect(docs.get("d-old-shared")?.content).toEqual(PURGED_DOCUMENT_CONTENT);
    expect(docs.get("d-old-empty")?.content).toEqual(PURGED_DOCUMENT_CONTENT);
    expect(docs.get("d-fresh")?.content).toEqual(content);
    expect(docs.get("d-live")?.content).toEqual(content);
    expect(await prisma.shareLink.count({ where: { documentId: "d-old-shared" } })).toBe(1);
  });

  it("does nothing for a rule whose setting is 0", async () => {
    await prisma.auditLog.create({
      data: { method: "GET", path: "/x", status: 500, createdAt: at(1_000, "old") },
    });

    const summary = await applyRetention({ settings: disabled, now });

    expect(summary).toEqual({ affected: {}, incomplete: [], failed: [] });
    expect(await prisma.auditLog.count()).toBe(1);
  });

  it("drains a backlog larger than one batch within a run", async () => {
    await prisma.auditLog.createMany({
      data: Array.from({ length: 7 }, () => ({
        method: "GET",
        path: "/x",
        status: 500,
        createdAt: at(90, "old"),
      })),
    });

    const summary = await applyRetention({ settings: only("auditLogs"), batchSize: 2, now });

    expect(summary).toEqual({ affected: { auditLogs: 7 }, incomplete: [], failed: [] });
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("stops at the time budget after one batch per rule and the next run continues", async () => {
    await prisma.auditLog.createMany({
      data: Array.from({ length: 5 }, () => ({
        method: "GET",
        path: "/x",
        status: 500,
        createdAt: at(90, "old"),
      })),
    });
    await prisma.adminAuditEntry.create({
      data: { action: "x", targetType: "user", createdAt: at(365, "old") },
    });
    const settings = { ...disabled, auditLogs: 90, adminAuditEntries: 365 };

    const first = await applyRetention({ settings, batchSize: 2, budgetMs: 0, now });

    // The spent budget does not starve the rule after it.
    expect(first).toEqual({
      affected: { auditLogs: 2, adminAuditEntries: 1 },
      incomplete: ["auditLogs"],
      failed: [],
    });
    expect(await prisma.auditLog.count()).toBe(3);

    await applyRetention({ settings, batchSize: 2, budgetMs: 0, now });
    await applyRetention({ settings, batchSize: 2, budgetMs: 0, now });
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it("stops between batches once the job lock is lost", async () => {
    await prisma.auditLog.createMany({
      data: Array.from({ length: 5 }, () => ({
        method: "GET",
        path: "/x",
        status: 500,
        createdAt: at(90, "old"),
      })),
    });

    const summary = await applyRetention({
      settings: only("auditLogs"),
      batchSize: 2,
      stillOwner: async () => false,
      now,
    });

    expect(summary).toEqual({ affected: { auditLogs: 2 }, incomplete: ["auditLogs"], failed: [] });
  });
});

describe("restoring a purged document", () => {
  it("refuses a document the retention job blanked, but restores one inside the window", async () => {
    const user = await createUserWithSession();
    const content = { basics: { name: "Ada" } };
    const make = (id: string, deletedAt: Date) =>
      prisma.document.create({
        data: { id, userId: user.id, title: id, slug: id, content, deletedAt },
      });
    await make("r-old", at(30, "old"));
    await make("r-fresh", at(30, "fresh"));
    await applyRetention({ settings: only("deletedDocuments"), now });

    await expect(DocumentService.restoreDocument(user.id, "r-old")).rejects.toMatchObject({
      statusCode: 410,
      message: expect.stringMatching(/permanently removed/),
    });
    const stillDeleted = await prisma.document.findUniqueOrThrow({ where: { id: "r-old" } });
    expect(stillDeleted.deletedAt).not.toBeNull();

    const restored = await DocumentService.restoreDocument(user.id, "r-fresh");
    expect(restored.deletedAt).toBeNull();
    expect(restored.content).toEqual(content);
  });

  it("restores a document that was legitimately empty, however long ago it was deleted", async () => {
    const user = await createUserWithSession();
    await prisma.document.create({
      data: {
        id: "empty",
        userId: user.id,
        title: "e",
        slug: "e",
        content: {},
        deletedAt: at(400, "old"),
      },
    });

    const restored = await DocumentService.restoreDocument(user.id, "empty");

    expect(restored.deletedAt).toBeNull();
    expect(restored.content).toEqual({});
  });

  describe("with the window changed after the purge", () => {
    const previous = process.env.RETENTION_DELETED_DOCUMENT_DAYS;

    afterEach(() => {
      if (previous === undefined) delete process.env.RETENTION_DELETED_DOCUMENT_DAYS;
      else process.env.RETENTION_DELETED_DOCUMENT_DAYS = previous;
    });

    it.each(["0", "3650"])(
      "still refuses a purged document (setting %s), for the owner and the admin",
      async (setting) => {
        const user = await createUserWithSession();
        await prisma.document.create({
          data: {
            id: "purged",
            userId: user.id,
            title: "p",
            slug: "p",
            content: { a: 1 },
            deletedAt: at(30, "old"),
          },
        });
        await applyRetention({ settings: only("deletedDocuments"), now });

        process.env.RETENTION_DELETED_DOCUMENT_DAYS = setting;

        await expect(DocumentService.restoreDocument(user.id, "purged")).rejects.toMatchObject({
          statusCode: 410,
        });
        await expect(adminRestoreDocument("purged")).rejects.toMatchObject({ statusCode: 410 });
        const row = await prisma.document.findUniqueOrThrow({ where: { id: "purged" } });
        expect(row.deletedAt).not.toBeNull();
      },
    );
  });
});

describe("purge and restore racing each other", () => {
  const makeDeleted = async (id: string) => {
    const user = await createUserWithSession();
    await prisma.document.create({
      data: {
        id,
        userId: user.id,
        title: id,
        slug: id,
        content: { basics: { name: "Ada" } },
        deletedAt: at(30, "old"),
      },
    });
    return user;
  };

  it("the purge skips a row restored after its id was selected", async () => {
    await makeDeleted("raced");
    // A restore holds the row, uncommitted: the purge's subselect still sees it deleted, and its
    // UPDATE has to wait for the row lock.
    const restorer = await pool.connect();
    try {
      await restorer.query("BEGIN");
      await restorer.query(`UPDATE "Document" SET "deletedAt" = NULL WHERE "id" = 'raced'`);

      const purge = applyRetention({ settings: only("deletedDocuments"), now });
      await vi.waitFor(
        async () => {
          const waiting = await prisma.$queryRaw<Array<{ n: number }>>`
            SELECT count(*)::int AS n FROM pg_stat_activity
            WHERE wait_event_type = 'Lock' AND query LIKE '%UPDATE "Document" SET "content"%'`;
          expect(waiting[0].n).toBe(1);
        },
        { timeout: 5_000, interval: 25 },
      );

      await restorer.query("COMMIT");
      const summary = await purge;

      expect(summary.affected).toEqual({ deletedDocumentsPurged: 0 });
    } finally {
      restorer.release();
    }

    const row = await prisma.document.findUniqueOrThrow({ where: { id: "raced" } });
    expect(row.deletedAt).toBeNull();
    expect(row.content).toEqual({ basics: { name: "Ada" } });
  });

  it("an owner restore refuses (410) a document purged after it was read", async () => {
    const user = await makeDeleted("late-purge");
    const findFirst = prisma.document.findFirst.bind(prisma.document);
    vi.spyOn(prisma.document, "findFirst").mockImplementationOnce((async (args: never) => {
      const read = await findFirst(args);
      await applyRetention({ settings: only("deletedDocuments"), now });
      return read;
    }) as never);

    await expect(DocumentService.restoreDocument(user.id, "late-purge")).rejects.toMatchObject({
      statusCode: 410,
    });
    const row = await prisma.document.findUniqueOrThrow({ where: { id: "late-purge" } });
    expect(row.deletedAt).not.toBeNull();
  });

  it("an admin restore refuses (410) a document purged after it was read", async () => {
    await makeDeleted("late-purge-admin");
    const findUnique = prisma.document.findUnique.bind(prisma.document);
    vi.spyOn(prisma.document, "findUnique").mockImplementationOnce((async (args: never) => {
      const read = await findUnique(args);
      await applyRetention({ settings: only("deletedDocuments"), now });
      return read;
    }) as never);

    await expect(adminRestoreDocument("late-purge-admin")).rejects.toMatchObject({
      statusCode: 410,
    });
    const row = await prisma.document.findUniqueOrThrow({ where: { id: "late-purge-admin" } });
    expect(row.deletedAt).not.toBeNull();
  });
});

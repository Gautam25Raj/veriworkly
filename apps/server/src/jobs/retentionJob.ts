import cron, { type ScheduledTask } from "node-cron";

import { config } from "#config";
import { parseIntegerEnv } from "#config/parseEnv";
import { ApiError } from "#lib/errors";
import { createRunTracker, withJobLock } from "#lib/jobLock";
import { logger } from "#lib/logger";
import { prisma } from "#lib/prisma";

/**
 * Data retention (V-116, PERFORMANCE-AND-SCALING §6): one daily pass that deletes or redacts rows
 * past their window. Every rule is a setting (`RETENTION_*_DAYS`, `0` disables it) and works in
 * bounded batches: each statement touches at most `batchSize` rows picked by a `LIMIT`ed subquery
 * on an indexed column, so no statement holds locks on an unbounded set. A run stops starting new
 * batches once its time budget is spent; whatever is left is picked up by the next night's run.
 *
 * Soft-deleted documents have their content replaced by `PURGED_DOCUMENT_CONTENT`, never deleted:
 * the row is the sync tombstone (`listDocuments` returns `{ id, deletedAt }` to a device whose
 * cursor predates the delete, and a create with that id answers 409 instead of resurrecting it),
 * and deleting it would also cascade away its ShareLink and PortfolioPublication. There is no
 * `contentPurgedAt` column, so the marker itself is the durable "already purged" record.
 */

const CRON = "15 3 * * *";
const TIMEZONE = "UTC";
const LOCK_NAME = "retention:lock";
const DEFAULT_BATCH_SIZE = 5_000;
const DEFAULT_BUDGET_MS = 4 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RetentionSetting =
  | "expiredSessions"
  | "expiredVerifications"
  | "webhookPayloads"
  | "auditLogs"
  | "adminAuditEntries"
  | "creditReservations"
  | "flushBatches"
  | "affiliateClicks"
  | "portfolioViews"
  | "deletedDocuments";

export type RetentionSettings = Record<RetentionSetting, number>;

/** Reads the `RETENTION_*_DAYS` settings. Anything not a positive integer disables its rule. */
export function readRetentionSettings(env: NodeJS.ProcessEnv = process.env): RetentionSettings {
  const days = (name: string, fallback: number) => parseIntegerEnv(env[name], fallback);

  return {
    expiredSessions: days("RETENTION_EXPIRED_SESSION_DAYS", 1),
    expiredVerifications: days("RETENTION_EXPIRED_VERIFICATION_DAYS", 1),
    webhookPayloads: days("RETENTION_WEBHOOK_PAYLOAD_DAYS", 30),
    // Falls back to the older AUDIT_LOG_RETENTION_DAYS so an existing deployment keeps its window.
    auditLogs: days("RETENTION_AUDIT_LOG_DAYS", config.logging.auditRetentionDays),
    adminAuditEntries: days("RETENTION_ADMIN_AUDIT_DAYS", 365),
    // A reservation row is reserve()'s idempotency record for its requestId: deleting a COMMITTED
    // one lets a late retry reserve again, run the AI call, and then fail the commit on the
    // CreditTransaction.requestId unique. 90 days is far past any client retry.
    creditReservations: days("RETENTION_CREDIT_RESERVATION_DAYS", 90),
    flushBatches: days("RETENTION_FLUSH_BATCH_DAYS", 7),
    // Off by default: the affiliate dashboard and admin affiliate stats count every click row, so
    // pruning would shrink lifetime click totals.
    affiliateClicks: days("RETENTION_AFFILIATE_CLICK_DAYS", 0),
    // Off by default: a portfolio's total views is the SUM over these rows, so deleting old ones
    // silently turns "total" into a rolling window.
    portfolioViews: days("RETENTION_PORTFOLIO_VIEW_DAYS", 0),
    deletedDocuments: days("RETENTION_DELETED_DOCUMENT_DAYS", 30),
  };
}

/** What the purge rule writes over a soft-deleted document's content. */
export const PURGED_DOCUMENT_CONTENT = Object.freeze({ purged: true });
const PURGED_DOCUMENT_JSON = JSON.stringify(PURGED_DOCUMENT_CONTENT);

/**
 * Throws 410 for a document the purge rule has already emptied, so a restore cannot bring back a
 * shell. Only the marker counts, never the current window: a document that was simply empty
 * restores, and changing `RETENTION_DELETED_DOCUMENT_DAYS` later cannot make a purged one
 * restorable.
 */
export function assertDocumentNotPurged(document: { content: unknown }): void {
  const { content } = document;

  if (typeof content !== "object" || content === null || Array.isArray(content)) return;
  if (JSON.stringify(content) !== PURGED_DOCUMENT_JSON) return;

  throw new ApiError(
    410,
    "This document was deleted and its content has since been permanently removed.",
  );
}

/** One batch: affect at most `limit` rows older than `cutoff`, return how many were affected. */
type BatchStep = (cutoff: Date, limit: number) => Promise<number>;

// Each subquery filters on the index named beside it; the outer statement then hits the primary key.
const RULES: Array<{ name: string; setting: RetentionSetting; step: BatchStep }> = [
  {
    name: "expiredSessions", // Session(expiresAt)
    setting: "expiredSessions",
    step: (cutoff, limit) => prisma.$executeRaw`
      DELETE FROM "Session" WHERE "id" IN (
        SELECT "id" FROM "Session" WHERE "expiresAt" < ${cutoff} LIMIT ${limit})`,
  },
  {
    name: "expiredVerifications", // Verification(expiresAt)
    setting: "expiredVerifications",
    step: (cutoff, limit) => prisma.$executeRaw`
      DELETE FROM "Verification" WHERE "id" IN (
        SELECT "id" FROM "Verification" WHERE "expiresAt" < ${cutoff} LIMIT ${limit})`,
  },
  {
    // Keeps the row, ids, status and error; FAILED (and PROCESSING) rows keep their payload so
    // they can still be replayed or investigated.
    name: "webhookPayloadsRedacted", // BillingWebhookEvent(status, createdAt)
    setting: "webhookPayloads",
    step: (cutoff, limit) => prisma.$executeRaw`
      UPDATE "BillingWebhookEvent"
      SET "payload" = jsonb_build_object('redacted', true, 'type', "type")
      WHERE "id" IN (
        SELECT "id" FROM "BillingWebhookEvent"
        WHERE "status" = 'PROCESSED' AND "createdAt" < ${cutoff}
          AND "payload" <> jsonb_build_object('redacted', true, 'type', "type")
        LIMIT ${limit})`,
  },
  {
    name: "auditLogs", // AuditLog(createdAt)
    setting: "auditLogs",
    step: (cutoff, limit) => prisma.$executeRaw`
      DELETE FROM "AuditLog" WHERE "id" IN (
        SELECT "id" FROM "AuditLog" WHERE "createdAt" < ${cutoff} LIMIT ${limit})`,
  },
  {
    name: "adminAuditEntries", // AdminAuditEntry(createdAt)
    setting: "adminAuditEntries",
    step: (cutoff, limit) => prisma.$executeRaw`
      DELETE FROM "AdminAuditEntry" WHERE "id" IN (
        SELECT "id" FROM "AdminAuditEntry" WHERE "createdAt" < ${cutoff} LIMIT ${limit})`,
  },
  {
    // `updatedAt` is when the reservation reached its terminal state; PENDING ones are the credit
    // sweep's, never this job's.
    name: "creditReservations", // CreditReservation(status, updatedAt)
    setting: "creditReservations",
    step: (cutoff, limit) => prisma.$executeRaw`
      DELETE FROM "CreditReservation" WHERE "id" IN (
        SELECT "id" FROM "CreditReservation"
        WHERE "status" IN ('COMMITTED', 'RELEASED', 'EXPIRED') AND "updatedAt" < ${cutoff}
        LIMIT ${limit})`,
  },
  {
    // Batch markers only guard a crash between the Postgres commit and the Redis cleanup of the
    // same flush, which the next flush resolves; a week is ample. The marker is the P2002
    // double-count guard, so deleting it can only double-count a batch whose Redis cleanup has
    // kept failing for the whole 7 days.
    name: "viewFlushBatches", // ViewFlushBatch(createdAt)
    setting: "flushBatches",
    step: (cutoff, limit) => prisma.$executeRaw`
      DELETE FROM "ViewFlushBatch" WHERE "id" IN (
        SELECT "id" FROM "ViewFlushBatch" WHERE "createdAt" < ${cutoff} LIMIT ${limit})`,
  },
  {
    name: "usageMetricFlushBatches", // UsageMetricFlushBatch(createdAt)
    setting: "flushBatches",
    step: (cutoff, limit) => prisma.$executeRaw`
      DELETE FROM "UsageMetricFlushBatch" WHERE "id" IN (
        SELECT "id" FROM "UsageMetricFlushBatch" WHERE "createdAt" < ${cutoff} LIMIT ${limit})`,
  },
  {
    name: "affiliateClicks", // AffiliateClick(createdAt)
    setting: "affiliateClicks",
    step: (cutoff, limit) => prisma.$executeRaw`
      DELETE FROM "AffiliateClick" WHERE "id" IN (
        SELECT "id" FROM "AffiliateClick" WHERE "createdAt" < ${cutoff} LIMIT ${limit})`,
  },
  {
    name: "portfolioViews", // PortfolioViewDaily(date)
    setting: "portfolioViews",
    step: (cutoff, limit) => prisma.$executeRaw`
      DELETE FROM "PortfolioViewDaily" WHERE "id" IN (
        SELECT "id" FROM "PortfolioViewDaily" WHERE "date" < ${cutoff} LIMIT ${limit})`,
  },
  {
    // `updatedAt` is left alone: it is the sync cursor, and a purge is not an edit. The conditions
    // are repeated on the outer UPDATE: Postgres re-checks those (not the subselect) against the
    // latest row version, so a document restored after its id was selected is not purged.
    name: "deletedDocumentsPurged", // Document(deletedAt)
    setting: "deletedDocuments",
    step: (cutoff, limit) => prisma.$executeRaw`
      UPDATE "Document" SET "content" = ${PURGED_DOCUMENT_JSON}::jsonb
      WHERE "id" IN (
        SELECT "id" FROM "Document"
        WHERE "deletedAt" < ${cutoff} AND "content" <> ${PURGED_DOCUMENT_JSON}::jsonb
        LIMIT ${limit})
      AND "deletedAt" < ${cutoff} AND "content" <> ${PURGED_DOCUMENT_JSON}::jsonb`,
  },
];

export type RetentionSummary = {
  /** Rows deleted or redacted per enabled rule. */
  affected: Record<string, number>;
  /** Rules that stopped on the time budget with rows left; the next run continues them. */
  incomplete: string[];
  failed: string[];
};

/**
 * Applies every enabled rule once. Each rule always gets at least one batch, so a slow rule early
 * in the list cannot starve the rest; further batches run only while the budget lasts. A rule's
 * failure is logged and the next rule still runs. Never rejects.
 */
export async function applyRetention(
  options: {
    settings?: RetentionSettings;
    batchSize?: number;
    budgetMs?: number;
    now?: Date;
    /** Checked between batches; false (the job lock was lost) ends the run where it stands. */
    stillOwner?: () => Promise<boolean>;
  } = {},
): Promise<RetentionSummary> {
  const settings = options.settings ?? readRetentionSettings();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const nowMs = (options.now ?? new Date()).getTime();
  const deadline = Date.now() + budgetMs;
  const summary: RetentionSummary = { affected: {}, incomplete: [], failed: [] };

  for (const rule of RULES) {
    const days = settings[rule.setting];
    if (!Number.isSafeInteger(days) || days <= 0) continue;

    const cutoff = new Date(nowMs - days * DAY_MS);
    let affected = 0;

    try {
      for (;;) {
        const count = await rule.step(cutoff, batchSize);
        affected += count;
        if (count < batchSize) break;
        if (Date.now() >= deadline || (options.stillOwner && !(await options.stillOwner()))) {
          summary.incomplete.push(rule.name);
          break;
        }
      }
    } catch (error) {
      summary.failed.push(rule.name);
      logger.error(`Retention rule ${rule.name} failed`, {
        error: error instanceof Error ? error.message : error,
      });
    }

    summary.affected[rule.name] = affected;
  }

  return summary;
}

let job: ScheduledTask | null = null;
const runs = createRunTracker();

/**
 * One locked retention pass. Never rejects: `withJobLock` logs a Redis outage, a held lock or a
 * throw. `applyRetention` contains each rule's failure so the others still run; the run then
 * throws once at the end, so a partial failure is never recorded as a success.
 */
export async function runRetention(reason: "cron" | "manual" = "cron"): Promise<void> {
  await withJobLock(
    LOCK_NAME,
    { ttlMs: 2 * 60_000, renewEveryMs: 30_000, job: "retention" },
    async (stillOwner) => {
      const startedAt = Date.now();
      const summary = await applyRetention({ stillOwner });
      logger.info(`Retention run (${reason}) completed`, {
        ...summary,
        durationMs: Date.now() - startedAt,
      });
      // Every rule ran; a failed one makes the run a failure for `/health/jobs`.
      if (summary.failed.length > 0)
        throw new Error(`Retention rules failed: ${summary.failed.join(", ")}`);
    },
  );
}

/** False when every rule is disabled: the job is then not scheduled at all. */
export function isRetentionEnabled(settings: RetentionSettings = readRetentionSettings()): boolean {
  return Object.values(settings).some((days) => Number.isSafeInteger(days) && days > 0);
}

/** Daily at 03:15 UTC. No startup run: a missed night just makes the next one a little larger. */
export function startRetentionJob() {
  if (!isRetentionEnabled()) {
    logger.warn("Data retention is disabled: every RETENTION_*_DAYS rule is 0.");
    return;
  }

  if (job) return;

  job = cron.schedule(CRON, () => runs.track(runRetention("cron")), { timezone: TIMEZONE });
  logger.debug("Retention job scheduled", { cron: CRON, timezone: TIMEZONE });
}

/** Stops scheduling and resolves once the run in progress, if any, has finished. */
export function stopRetentionJob(): Promise<void> {
  if (job) {
    job.stop();
    job = null;
    logger.info("Retention job stopped");
  }

  return runs.idle();
}

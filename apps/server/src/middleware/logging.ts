import { Request, Response, NextFunction } from "express";

import { config } from "#config";

import { prisma } from "#lib/prisma";
import { logger } from "#lib/logger";
import { getRequestIpDetails } from "#utils/requestIp";

/**
 * Expected, high-volume failures that are not worth a row (V-109): auth probes, missing routes,
 * autosave revision conflicts and rate limiting. 400 and 413 stay audited. They still reach
 * the log line below.
 */
const UNAUDITED_STATUSES = new Set([401, 404, 409, 429]);

/** Rows are written in batches: when this many are waiting, or after the interval. */
const AUDIT_BATCH_SIZE = 100;
const AUDIT_FLUSH_INTERVAL_MS = 2_000;
/** While the database is down the buffer stops growing here and drops new rows. */
const AUDIT_BUFFER_MAX = 1_000;

type AuditRow = {
  method: string;
  path: string;
  status: number;
  ip: string | null;
  userAgent: string | undefined;
  error: string | null;
  createdAt: Date;
};

let buffer: AuditRow[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let flushing: Promise<void> | null = null;
let droppedSinceWarn = 0;
let persistOverride: boolean | null = null;

/** Tests turn persistence on outside production; `null` returns to the environment default. */
export function setAuditLogPersistence(enabled: boolean | null) {
  persistOverride = enabled;
}

function persistenceEnabled() {
  return persistOverride ?? config.nodeEnv === "production";
}

/** Writes everything buffered so far in one `createMany`. Never rejects. */
export async function flushAuditLogs(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (flushing) await flushing;
  if (buffer.length === 0) return;

  const rows = buffer;
  buffer = [];

  flushing = prisma.auditLog
    .createMany({ data: rows })
    .then(() => {
      if (droppedSinceWarn > 0) {
        logger.warn("Audit log writes recovered", { dropped: droppedSinceWarn });
        droppedSinceWarn = 0;
      }
    })
    .catch((err) => {
      // Put the rows back for the next attempt, within the bound.
      buffer = rows.concat(buffer).slice(0, AUDIT_BUFFER_MAX);
      logger.error("Audit log DB write failed", err);
      scheduleFlush();
    })
    .finally(() => {
      flushing = null;
    });

  await flushing;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => void flushAuditLogs(), AUDIT_FLUSH_INTERVAL_MS);
  flushTimer.unref();
}

function enqueueAuditLog(row: AuditRow) {
  if (buffer.length >= AUDIT_BUFFER_MAX) {
    // One warning per outage, not one per dropped row.
    if (droppedSinceWarn === 0)
      logger.warn("Audit log buffer full (database unavailable?); dropping rows");
    droppedSinceWarn += 1;
    return;
  }

  buffer.push(row);
  if (buffer.length >= AUDIT_BATCH_SIZE && !flushing) void flushAuditLogs();
  else scheduleFlush();
}

export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = performance.now();

  const ip = getRequestIpDetails(req).resolvedIp;

  const userAgent = req.headers["user-agent"];

  res.on("finish", () => {
    if (res.statusCode >= 400) {
      const duration = Math.round(performance.now() - startTime);

      logger.error(`[ERROR] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);

      if (persistenceEnabled() && !UNAUDITED_STATUSES.has(res.statusCode)) {
        enqueueAuditLog({
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ip,
          userAgent,
          error: res.locals.errorMessage || null,
          createdAt: new Date(),
        });
      }
    }
  });

  next();
}

import { z } from "zod";

/**
 * Shared primitives for every admin list endpoint.
 *
 * Admin tables are read by a human paging through a browser, not by a batch job, so the
 * page size is capped low enough that a mistyped `limit` can never turn one click into a
 * full-table scan against production.
 */

export const ADMIN_PAGE_SIZE_DEFAULT = 25;
export const ADMIN_PAGE_SIZE_MAX = 100;

const numericString = (fallback: number, min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") return fallback;

      const parsed = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(parsed)) return fallback;

      return Math.min(Math.max(Math.trunc(parsed), min), max);
    });

export const adminPaginationSchema = z.object({
  limit: numericString(ADMIN_PAGE_SIZE_DEFAULT, 1, ADMIN_PAGE_SIZE_MAX),
  offset: numericString(0, 0, 1_000_000),
});

export const adminSearchSchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
});

/** ISO date window used by the audit log and every "activity between X and Y" report. */
export const adminDateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

/**
 * Every mutating admin action is written to `AdminAuditEntry`, and an entry without a
 * reason is useless three months later when someone asks why a user lost access. The
 * minimum length exists to reject placeholder reasons like "x".
 */
export const adminReasonSchema = z.string().trim().min(3).max(500);

export const adminOptionalReasonSchema = z.string().trim().max(500).optional();

export const adminIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export type AdminPagination = z.infer<typeof adminPaginationSchema>;

/** Turns the validated `from`/`to` pair into a Prisma `createdAt` filter, or nothing. */
export function toCreatedAtFilter(range: { from?: string; to?: string }) {
  if (!range.from && !range.to) return undefined;

  return {
    createdAt: {
      ...(range.from ? { gte: new Date(range.from) } : {}),
      ...(range.to ? { lte: new Date(range.to) } : {}),
    },
  };
}

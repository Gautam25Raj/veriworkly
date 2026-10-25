import { z } from "zod";

import { adminDaysParam, adminReasonSchema } from "#validators/admin/adminCommonValidator";

export const adminUsageMetricsQuerySchema = z.object({
  days: adminDaysParam(1, 180),
  event: z.string().trim().min(1).max(64).optional(),
});

export const adminOverviewQuerySchema = z.object({
  /** Window used for the "new in period" deltas on the overview cards. */
  days: adminDaysParam(1, 365),
});

export const adminTimeSeriesQuerySchema = z.object({
  /**
   * Window for the dashboard charts. Floored at 7 because a chart of fewer points reads as
   * noise, and capped at 180 because every point is a row scan per metric.
   */
  days: adminDaysParam(7, 180),
});

export const adminGithubSyncSchema = z.object({
  force: z.boolean().optional().default(false),
  reason: adminReasonSchema,
});

export const adminCacheFlushSchema = z.object({
  /**
   * Restricted to prefixes the platform owns. An unbounded prefix would let a single
   * request evict the session cache for every signed-in user at once.
   */
  prefix: z.enum([
    "portfolio:public",
    "user:profile",
    "affiliate",
    "credits",
    "changelog",
    "roadmap",
  ]),
  reason: adminReasonSchema,
});

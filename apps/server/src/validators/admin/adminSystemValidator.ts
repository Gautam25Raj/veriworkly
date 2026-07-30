import { z } from "zod";

import { adminReasonSchema } from "#validators/admin/adminCommonValidator";

export const adminUsageMetricsQuerySchema = z.object({
  days: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      const parsed = value === undefined ? 30 : Number(value);
      if (!Number.isFinite(parsed)) return 30;

      return Math.min(Math.max(Math.trunc(parsed), 1), 180);
    }),
  event: z.string().trim().min(1).max(64).optional(),
});

export const adminOverviewQuerySchema = z.object({
  /** Window used for the "new in period" deltas on the overview cards. */
  days: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      const parsed = value === undefined ? 30 : Number(value);
      if (!Number.isFinite(parsed)) return 30;

      return Math.min(Math.max(Math.trunc(parsed), 1), 365);
    }),
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

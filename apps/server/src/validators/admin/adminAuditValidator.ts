import { z } from "zod";

import {
  adminDateRangeSchema,
  adminPaginationSchema,
  adminSearchSchema,
} from "#validators/admin/adminCommonValidator";

export const adminAuditListQuerySchema = adminPaginationSchema
  .merge(adminSearchSchema)
  .merge(adminDateRangeSchema)
  .extend({
    action: z.string().trim().min(1).max(120).optional(),
    targetType: z.string().trim().min(1).max(120).optional(),
    targetId: z.string().trim().min(1).max(64).optional(),
    actorId: z.string().trim().min(1).max(64).optional(),
  });

export type AdminAuditListQuery = z.infer<typeof adminAuditListQuerySchema>;

export const adminRequestLogQuerySchema = adminPaginationSchema.merge(adminDateRangeSchema).extend({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
  path: z.string().trim().min(1).max(255).optional(),
  /** `4` or `5` narrows to the 4xx/5xx family — the only filter that matters on-call. */
  statusClass: z.enum(["2", "3", "4", "5"]).optional(),
  errorsOnly: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
});

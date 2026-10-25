import { z } from "zod";

import {
  adminFlagParam,
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

/** Position after the last row of a request-log page, ordered `(createdAt DESC, id DESC)`. */
interface RequestLogCursor {
  createdAt: Date;
  id: string;
}

/** Opaque to clients: base64url of `<ISO createdAt>|<id>`. */
export function encodeRequestLogCursor(cursor: RequestLogCursor) {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.id}`).toString("base64url");
}

function decodeRequestLogCursor(value: string): RequestLogCursor | null {
  const [iso, id, ...rest] = Buffer.from(value, "base64url").toString("utf8").split("|");
  if (!iso || !id || rest.length > 0 || id.length > 64) return null;

  const createdAt = new Date(iso);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
}

/** Request-log offsets only serve the studio's first pages; deeper paging uses the cursor (V-078). */
const REQUEST_LOG_MAX_OFFSET = 1000;

export const adminRequestLogQuerySchema = adminPaginationSchema.merge(adminDateRangeSchema).extend({
  offset: adminPaginationSchema.shape.offset.transform((value) =>
    Math.min(value, REQUEST_LOG_MAX_OFFSET),
  ),
  cursor: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      const decoded = decodeRequestLogCursor(value);
      if (!decoded) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid cursor" });
        return z.NEVER;
      }
      return decoded;
    }),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
  path: z.string().trim().min(1).max(255).optional(),
  /** `4` or `5` narrows to the 4xx/5xx family — the only filter that matters on-call. */
  statusClass: z.enum(["2", "3", "4", "5"]).optional(),
  errorsOnly: adminFlagParam,
});

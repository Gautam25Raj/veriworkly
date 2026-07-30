import { z } from "zod";

import { adminPaginationSchema, adminSearchSchema } from "#validators/admin/adminCommonValidator";

export const adminAmbassadorListQuerySchema = adminPaginationSchema
  .merge(adminSearchSchema)
  .extend({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    graduationYear: z
      .string()
      .trim()
      .regex(/^\d{4}$/)
      .optional(),
    sort: z.enum(["newest", "oldest"]).default("newest"),
  });

export type AdminAmbassadorListQuery = z.infer<typeof adminAmbassadorListQuerySchema>;

export const adminAmbassadorReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewNote: z.string().trim().max(500).optional(),
});

export type AdminAmbassadorReviewInput = z.infer<typeof adminAmbassadorReviewSchema>;

export const adminAmbassadorRosterQuerySchema = adminPaginationSchema.merge(adminSearchSchema);

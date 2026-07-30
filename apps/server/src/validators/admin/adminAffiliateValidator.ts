import { z } from "zod";

import {
  adminOptionalReasonSchema,
  adminPaginationSchema,
  adminSearchSchema,
} from "#validators/admin/adminCommonValidator";

export const adminAffiliateListQuerySchema = adminPaginationSchema.merge(adminSearchSchema).extend({
  status: z.enum(["NOT_ENROLLED", "PENDING", "ACTIVE", "SUSPENDED"]).optional(),
  tier: z.enum(["TIER_1", "TIER_2", "TIER_3"]).optional(),
  sort: z.enum(["newest", "earnings", "referrals"]).default("newest"),
});

export const adminAffiliateSchema = z
  .object({
    status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]).optional(),
    tier: z.enum(["TIER_1", "TIER_2", "TIER_3"]).optional(),
    reason: adminOptionalReasonSchema,
  })
  .refine((value) => value.status || value.tier, "Status or tier is required");

export const adminCommissionListQuerySchema = adminPaginationSchema.extend({
  status: z.enum(["PENDING", "AVAILABLE", "REVERSED", "PAID"]).optional(),
  affiliateId: z.string().trim().min(1).optional(),
});

export const adminCommissionSchema = z.object({
  referredUserId: z.string().trim().min(1),
  subscriptionId: z.string().trim().min(1).optional(),
  providerPaymentId: z.string().trim().min(1),
  purchaseAmountCents: z.number().int().min(1),
  status: z.enum(["PENDING", "AVAILABLE"]).default("PENDING"),
  reason: adminOptionalReasonSchema,
});

export const adminCommissionStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "REVERSED"]),
  reason: adminOptionalReasonSchema,
});

export const adminWithdrawalListQuerySchema = adminPaginationSchema.extend({
  status: z.enum(["REQUESTED", "APPROVED", "REJECTED", "PAID"]).optional(),
});

export const adminWithdrawalStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PAID"]),
  payoutNote: z.string().trim().max(500).optional(),
});

export const adminReferralListQuerySchema = adminPaginationSchema.extend({
  status: z.enum(["SIGNED_UP", "CONVERTED", "REJECTED"]).optional(),
  affiliateId: z.string().trim().min(1).optional(),
});

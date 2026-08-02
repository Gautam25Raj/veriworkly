import { z } from "zod";

export const referralCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(32)
    .regex(/^[a-z0-9-]+$/i),
});

export const clickSchema = referralCodeSchema.extend({
  referrerHost: z.string().trim().max(255).optional(),
});

export const withdrawalSchema = z.object({
  amountCents: z.number().int().min(2_500).max(10_000_000),
});

// Admin-side affiliate schemas live in `#validators/admin/adminAffiliateValidator` alongside
// the rest of the admin surface. This file covers only what an affiliate submits themselves.

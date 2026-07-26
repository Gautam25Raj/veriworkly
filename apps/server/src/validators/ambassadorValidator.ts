import { z } from "zod";

const graduationYearSchema = z
  .string()
  .trim()
  .regex(/^(19|20)\d{2}$/, "Enter a real 4-digit graduation year");

export const ambassadorApplicationSchema = z.object({
  collegeName: z.string().trim().min(2, "College/University name is required").max(160),
  graduationYear: graduationYearSchema,
  whyJoin: z.string().trim().min(20, "Give us a bit more — at least 20 characters").max(1000),
  superpower: z.string().trim().min(2, "Tell us your superpower").max(300),
  funFact: z.string().trim().min(2, "Drop a fun fact about yourself").max(300),
  vibeCheck: z.string().trim().max(80).optional(),
  socialHandle: z.string().trim().max(120).optional(),
});

export type AmbassadorApplicationInput = z.infer<typeof ambassadorApplicationSchema>;

export const adminAmbassadorReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewNote: z.string().trim().max(500).optional(),
});

export type AdminAmbassadorReviewInput = z.infer<typeof adminAmbassadorReviewSchema>;

export const adminAmbassadorListQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

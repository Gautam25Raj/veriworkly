import { z } from "zod";

/**
 * Field ceilings, kept in one place because the apply form mirrors them as `maxLength`.
 * They used to drift (the client capped `superpower` at 160 while the server allowed 300),
 * which silently truncated answers rather than failing loudly.
 */
export const AMBASSADOR_FIELD_LIMITS = {
  collegeName: 120,
  whyJoin: 1000,
  superpower: 160,
  funFact: 200,
  vibeCheck: 80,
  socialHandle: 100,
} as const;

/** How far ahead a student may credibly graduate — covers long undergrad + grad tracks. */
const GRADUATION_YEARS_AHEAD = 8;

const graduationYearSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "Enter a real 4-digit graduation year")
  .refine(
    (value) => {
      // Evaluated per request rather than at module load, so a long-lived server process
      // does not keep validating against the year it happened to boot in.
      const currentYear = new Date().getFullYear();
      const year = Number(value);

      return year >= currentYear - 1 && year <= currentYear + GRADUATION_YEARS_AHEAD;
    },
    () => {
      const currentYear = new Date().getFullYear();

      return {
        message: `Graduation year should be between ${currentYear - 1} and ${currentYear + GRADUATION_YEARS_AHEAD}`,
      };
    },
  );

export const ambassadorApplicationSchema = z.object({
  collegeName: z
    .string()
    .trim()
    .min(2, "College/University name is required")
    .max(AMBASSADOR_FIELD_LIMITS.collegeName),
  graduationYear: graduationYearSchema,
  whyJoin: z
    .string()
    .trim()
    .min(20, "Give us a bit more — at least 20 characters")
    .max(AMBASSADOR_FIELD_LIMITS.whyJoin),
  superpower: z
    .string()
    .trim()
    .min(2, "Tell us your superpower")
    .max(AMBASSADOR_FIELD_LIMITS.superpower),
  funFact: z
    .string()
    .trim()
    .min(2, "Drop a fun fact about yourself")
    .max(AMBASSADOR_FIELD_LIMITS.funFact),
  vibeCheck: z.string().trim().max(AMBASSADOR_FIELD_LIMITS.vibeCheck).optional(),
  socialHandle: z.string().trim().max(AMBASSADOR_FIELD_LIMITS.socialHandle).optional(),
});

export type AmbassadorApplicationInput = z.infer<typeof ambassadorApplicationSchema>;

// Review/list schemas for the admin queue live in `#validators/admin/adminAmbassadorValidator`.
// This file covers only what an applicant submits themselves.

import { z } from "zod";

/**
 * Body validation for the user-facing API-key routes. Only the fields that reached Prisma or a
 * date comparison unchecked live here (`name`, `expiresAt`); `scopes` and `rateLimit` keep their
 * controller parsers, which already answer 400.
 */

export const API_KEY_NAME_MAX_LENGTH = 100;

const apiKeyNameSchema = z
  .string({ invalid_type_error: "Key name must be a string" })
  .trim()
  .min(1, "Key name is required")
  .max(API_KEY_NAME_MAX_LENGTH, `Key name must be at most ${API_KEY_NAME_MAX_LENGTH} characters`);

/**
 * Optional ISO-8601 timestamp (or Date) that must be in the future. An empty/absent value means
 * "use the default lifetime", matching the previous controller behaviour. Strings must carry a
 * zone (`Z` or an offset): a bare `new Date(value)` would read offset-less or non-ISO input in
 * the server's local time. A past date used to be accepted and produced a key that failed on
 * first use (V-051).
 */
const apiKeyExpiresAtSchema = z
  .union([
    z.literal(""),
    z.string().datetime({ offset: true, message: "expiresAt must be an ISO-8601 timestamp" }),
    z.date(),
  ])
  .nullish()
  .transform((value, ctx) => {
    if (value == null || value === "") return undefined;

    const parsed = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expiresAt must be an ISO-8601 timestamp",
      });
      return z.NEVER;
    }

    if (parsed.getTime() <= Date.now()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "expiresAt must be in the future" });
      return z.NEVER;
    }

    return parsed;
  });

export const apiKeyCreateSchema = z.object({
  name: apiKeyNameSchema,
  expiresAt: apiKeyExpiresAtSchema,
});

export const apiKeyRotateSchema = z.object({
  name: apiKeyNameSchema.nullish().transform((value) => value ?? undefined),
  expiresAt: apiKeyExpiresAtSchema,
});

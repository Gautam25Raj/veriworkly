import { z } from "zod";

import { normalizeSlug, normalizeUsername } from "#utils/slugs";

/**
 * Validation schemas for sharing-related requests
 */

export const shareLinkCreateSchema = z.object({
  documentId: z.string().min(1),
  snapshot: z.record(z.string(), z.any()),
  password: z.string().min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  noExpiry: z.boolean().optional(),
  updateSlug: z.boolean().optional(),
  removePassword: z.boolean().optional(),
});

export const shareLinkPasswordSchema = z.object({
  password: z.string().min(1),
});

export const sharedDocumentIdsQuerySchema = z.object({
  ids: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
});

export const publicReadableParamsSchema = z.object({
  username: z.string().transform((value) => normalizeUsername(value)),
  slug: z.string().transform((value) => normalizeSlug(value)),
});

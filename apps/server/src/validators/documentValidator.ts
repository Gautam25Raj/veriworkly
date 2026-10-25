import { z } from "zod";
import { DocumentType, Visibility } from "@prisma/client";

import { normalizeSlug, normalizeTags } from "#utils/slugs";

const documentTypeSchema = z.nativeEnum(DocumentType);
const visibilitySchema = z.nativeEnum(Visibility);

const documentTitleSchema = z.string().trim().min(1).max(255);

const documentSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .transform((value) => normalizeSlug(value));

const documentTagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((tags) => normalizeTags(tags));

export const documentCreateSchema = z.object({
  id: z.string().optional(),
  type: documentTypeSchema,
  title: documentTitleSchema.optional(),
  slug: documentSlugSchema.optional(),
  tags: documentTagsSchema.optional(),
  content: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  templateId: z.string().min(1).max(64).optional(),
  visibility: visibilitySchema.optional(),
});

export const documentUpdateSchema = z.object({
  title: documentTitleSchema.optional(),
  slug: documentSlugSchema.optional(),
  updateShareSlug: z.boolean().optional(),
  tags: documentTagsSchema.optional(),
  content: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  templateId: z.string().min(1).max(64).optional(),
  visibility: visibilitySchema.optional(),
  revision: z.number().int().min(1),
});

export const documentListQuerySchema = z.object({
  type: z.nativeEnum(DocumentType).optional(),
  /**
   * Incremental hydrate cursor. The client has always sent this; it used to be
   * dropped silently here, so every hydrate re-downloaded the whole library.
   */
  updatedSince: z
    .string()
    .datetime()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
  /**
   * Document bodies are omitted by default — the client library renders from
   * metadata. Only sync, which needs to merge content, asks for them.
   */
  includeContent: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

import { z } from "zod";

import type { ResumeData } from "@/types/resume";

import {
  phoneSchema,
  yearDateSchema,
  monthDateSchema,
  urlOrEmptySchema,
  emailOrEmptySchema,
} from "@/features/resume/schemas/resume-validation-rules";
import { normalizeResumeData } from "@/features/resume/utils/normalize-data";
import { normalizeFontFamilyId } from "@/features/documents/constants/fonts";

const resumeSectionIdSchema = z.enum([
  "basics",
  "links",
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "awards",
  "publications",
  "languages",
  "interests",
  "volunteer",
  "references",
  "achievements",
  "custom",
]);

const resumeLinkTypeSchema = z.enum([
  "github",
  "linkedin",
  "dribbble",
  "twitter",
  "portfolio",
  "behance",
  "medium",
  "youtube",
  "custom",
]);

const resumeAdditionalSectionKindSchema = z.enum([
  "certifications",
  "awards",
  "publications",
  "languages",
  "interests",
  "volunteer",
  "references",
  "achievements",
  "custom",
]);

const resumeFluencySchema = z.enum(["elementary", "limited", "professional", "fluent", "native"]);

const resumeSyncStatusSchema = z.enum(["local-only", "pending", "syncing", "synced", "conflicted"]);

const resumeFontFamilySchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((value) => normalizeFontFamilyId(value));

const resumeDataSchemaBase = z
  .object({
    id: z.string(),
    templateId: z.string(),
    title: z.string().optional(),
    basics: z.object({
      fullName: z.string(),
      role: z.string(),
      headline: z.string(),
      email: emailOrEmptySchema,
      phone: phoneSchema,
      location: z.string(),
      linkEmail: z.boolean(),
      linkPhone: z.boolean(),
      linkLocation: z.boolean(),
    }),

    links: z.object({
      displayMode: z.enum(["icon", "url", "icon-username"]),
      items: z.array(
        z.object({
          id: z.string(),
          type: resumeLinkTypeSchema,
          label: z.string(),
          url: urlOrEmptySchema,
        }),
      ),
    }),

    summary: z.string(),

    experience: z.array(
      z.object({
        id: z.string(),
        company: z.string(),
        role: z.string(),
        location: z.string(),
        startDate: monthDateSchema,
        endDate: monthDateSchema,
        current: z.boolean(),
        summary: z.string(),
        highlights: z.array(z.string()),
      }),
    ),

    education: z.array(
      z.object({
        id: z.string(),
        school: z.string(),
        degree: z.string(),
        field: z.string(),
        startDate: yearDateSchema,
        endDate: yearDateSchema,
        current: z.boolean(),
        summary: z.string(),
      }),
    ),

    projects: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        link: urlOrEmptySchema,
        linkLabel: z.string().default("Link"),
        showLinkAsText: z.boolean().default(true),
        summary: z.string(),
        highlights: z.array(z.string()),
        skills: z.array(z.string()).default([]),
      }),
    ),

    skills: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        keywords: z.array(z.string()),
      }),
    ),

    /*
     * The eight typed sections. A resume stored before this model has them flattened into
     * `customSections` instead; `normalizeResumeData` unflattens on read, so both shapes
     * parse and only the typed one is ever written back.
     */
    languages: z.array(
      z.object({
        id: z.string(),
        language: z.string(),
        fluency: resumeFluencySchema,
      }),
    ),

    interests: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        keywords: z.array(z.string()),
      }),
    ),

    awards: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        awarder: z.string(),
        date: monthDateSchema,
        website: urlOrEmptySchema.optional(),
        description: z.string(),
        showLink: z.boolean(),
      }),
    ),

    certificates: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        issuer: z.string(),
        date: monthDateSchema,
        website: urlOrEmptySchema.optional(),
        referenceId: z.string().optional(),
        description: z.string(),
        showLink: z.boolean(),
      }),
    ),

    publications: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        publisher: z.string(),
        date: monthDateSchema,
        website: urlOrEmptySchema.optional(),
        description: z.string(),
        showLink: z.boolean(),
      }),
    ),

    volunteer: z.array(
      z.object({
        id: z.string(),
        organization: z.string(),
        role: z.string(),
        startDate: monthDateSchema,
        endDate: monthDateSchema,
        current: z.boolean(),
        location: z.string(),
        summary: z.string(),
      }),
    ),

    references: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        title: z.string(),
        organization: z.string(),
        email: emailOrEmptySchema.optional(),
        phone: phoneSchema.optional(),
        relationship: z.string(),
      }),
    ),

    achievements: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
      }),
    ),

    customSections: z.array(
      z.object({
        id: z.string(),
        kind: resumeAdditionalSectionKindSchema,
        title: z.string(),
        editableTitle: z.boolean().optional(),
        items: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            issuer: z.string(),
            date: z.string(),
            link: z.string(),
            referenceId: z.string(),
            description: z.string(),
            details: z.array(z.string()),
          }),
        ),
      }),
    ),

    sections: z.array(
      z.object({
        id: resumeSectionIdSchema,
        label: z.string(),
        visible: z.boolean(),
        order: z.number(),
        column: z.enum(["left", "right"]).optional(),
        customSectionId: z.string().optional(),
      }),
    ),

    customization: z.object({
      accentColor: z.string(),
      textColor: z.string(),
      mutedTextColor: z.string(),
      pageBackgroundColor: z.string(),
      sectionBackgroundColor: z.string(),
      borderColor: z.string(),
      sectionHeadingColor: z.string(),
      fontFamily: resumeFontFamilySchema,
      sectionSpacing: z.number(),
      pagePadding: z.number(),
      bodyLineHeight: z.number(),
      headingLineHeight: z.number(),
    }),

    sync: z.object({
      enabled: z.boolean(),
      status: resumeSyncStatusSchema,
      cloudDocumentId: z.string().nullable(),
      lastSyncedAt: z.string().nullable(),
      revision: z.number().int().default(1),
    }),
    updatedAt: z.string(),
  })
  .passthrough();

/**
 * zod 3's `.deepPartial()`, which zod 4 removed: every object key at every depth becomes
 * optional, through arrays, optionals and nullables, and an object keeps its unknown-key mode.
 *
 * A defaulted field loses its default here. zod 3 wrapped it as `optional(default(x))`, which
 * left an absent key absent; zod 4 would fill it in, and `normalizeResumeData` has to see which
 * keys the stored payload really carried.
 */
function deepPartial(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodObject) {
    const shape = Object.fromEntries(
      Object.entries(schema.shape as Record<string, z.ZodType>).map(([key, field]) => [
        key,
        // A defaulted field is unwrapped but its inner object is not deep-partialled, as in zod 3.
        field instanceof z.ZodDefault
          ? (field.unwrap() as z.ZodType).optional()
          : deepPartial(field).optional(),
      ]),
    );
    const catchall = schema.def.catchall;

    return catchall ? z.object(shape).catchall(catchall) : z.object(shape);
  }

  if (schema instanceof z.ZodArray) return z.array(deepPartial(schema.element as z.ZodType));
  if (schema instanceof z.ZodOptional) return deepPartial(schema.unwrap() as z.ZodType).optional();
  if (schema instanceof z.ZodNullable) return deepPartial(schema.unwrap() as z.ZodType).nullable();

  return schema;
}

const resumeDataInputSchema = deepPartial(resumeDataSchemaBase);

export interface ResumeCollection {
  version: 1;
  items: Record<string, ResumeData>;
}

export function parseResumeDataInput(value: unknown) {
  const result = resumeDataInputSchema.safeParse(value);

  if (!result.success) {
    return null;
  }

  return normalizeResumeData(result.data as Partial<ResumeData>);
}

export function parseResumeDataForExport(value: unknown) {
  const parsed = parseResumeDataInput(value);

  if (!parsed) {
    throw new Error("Resume payload is invalid");
  }

  return parsed;
}

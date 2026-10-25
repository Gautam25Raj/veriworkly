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

export const documentSyncStatusSchema = z.enum([
  "local-only",
  "pending",
  "syncing",
  "synced",
  "conflicted",
]);

/**
 * A stored sync state with every key optional: callers merge it over the state they already
 * hold, so a key absent here must stay absent rather than be defaulted.
 */
export const documentSyncStateSchema = z
  .object({
    enabled: z.boolean(),
    status: documentSyncStatusSchema,
    cloudDocumentId: z.string().nullable(),
    lastSyncedAt: z.string().nullable(),
    revision: z.number().int(),
  })
  .partial();

const resumeFontFamilySchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .transform((value) => normalizeFontFamilyId(value));

/** The schemas for the fields whose content has rules: contact details, links and dates. */
interface ResumeFieldRules {
  email: z.ZodString;
  phone: z.ZodString;
  url: z.ZodString;
  monthDate: z.ZodString;
  yearDate: z.ZodString;
}

/*
 * Storage checks shape, never content. An email of "j", a phone of "+1 5" or a half-typed
 * date is what the user has typed so far, and refusing to store it loses their text. The
 * content rules apply in the editor's validation and in the export parse below.
 */
const shapeOnlyRules: ResumeFieldRules = {
  email: z.string(),
  phone: z.string(),
  url: z.string(),
  monthDate: z.string(),
  yearDate: z.string(),
};

const contentRules: ResumeFieldRules = {
  email: emailOrEmptySchema,
  phone: phoneSchema,
  url: urlOrEmptySchema,
  monthDate: monthDateSchema,
  yearDate: yearDateSchema,
};

const text = z.string().default("");
const textList = z.array(z.string()).default([]);

/**
 * One resume shape, checked with either set of field rules.
 *
 * Fields inside a list entry default when absent, so an entry written before a field existed
 * still reads as a complete entry. `current` on experience and education is the exception:
 * normalisation derives it from an end date of "Present" when it is missing.
 *
 * Every top-level key is optional. `.partial()` adds no defaults, so a key the stored payload
 * lacks stays absent and `normalizeResumeData` can tell "missing" from "empty".
 */
function createResumeDataSchema(rules: ResumeFieldRules) {
  return z
    .object({
      id: z.string(),
      templateId: z.string(),
      title: z.string(),
      basics: z
        .object({
          fullName: z.string(),
          role: z.string(),
          headline: z.string(),
          email: rules.email,
          phone: rules.phone,
          location: z.string(),
          linkEmail: z.boolean(),
          linkPhone: z.boolean(),
          linkLocation: z.boolean(),
        })
        .partial(),

      links: z
        .object({
          displayMode: z.enum(["icon", "url", "icon-username"]),
          items: z.array(
            z.object({
              id: text,
              type: text,
              label: text,
              url: rules.url.default(""),
            }),
          ),
        })
        .partial(),

      summary: z.string(),

      experience: z.array(
        z.object({
          id: z.string(),
          company: text,
          role: text,
          location: text,
          startDate: rules.monthDate.default(""),
          endDate: rules.monthDate.default(""),
          current: z.boolean().optional(),
          summary: text,
          highlights: textList,
        }),
      ),

      education: z.array(
        z.object({
          id: z.string(),
          school: text,
          degree: text,
          field: text,
          startDate: rules.yearDate.default(""),
          endDate: rules.yearDate.default(""),
          current: z.boolean().optional(),
          summary: text,
        }),
      ),

      projects: z.array(
        z.object({
          id: z.string(),
          name: text,
          role: text,
          link: rules.url.default(""),
          linkLabel: text,
          showLinkAsText: z.boolean().default(true),
          summary: text,
          highlights: textList,
          skills: textList,
        }),
      ),

      skills: z.array(
        z.object({
          id: z.string(),
          name: text,
          keywords: textList,
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
          language: text,
          fluency: resumeFluencySchema,
        }),
      ),

      interests: z.array(
        z.object({
          id: z.string(),
          name: text,
          keywords: textList,
        }),
      ),

      awards: z.array(
        z.object({
          id: z.string(),
          title: text,
          awarder: text,
          date: rules.monthDate.default(""),
          website: rules.url.optional(),
          description: text,
          showLink: z.boolean().default(false),
        }),
      ),

      certificates: z.array(
        z.object({
          id: z.string(),
          title: text,
          issuer: text,
          date: rules.monthDate.default(""),
          website: rules.url.optional(),
          referenceId: z.string().optional(),
          description: text,
          showLink: z.boolean().default(false),
        }),
      ),

      publications: z.array(
        z.object({
          id: z.string(),
          title: text,
          publisher: text,
          date: rules.monthDate.default(""),
          website: rules.url.optional(),
          description: text,
          showLink: z.boolean().default(false),
        }),
      ),

      volunteer: z.array(
        z.object({
          id: z.string(),
          organization: text,
          role: text,
          startDate: rules.monthDate.default(""),
          endDate: rules.monthDate.default(""),
          current: z.boolean().default(false),
          location: text,
          summary: text,
        }),
      ),

      references: z.array(
        z.object({
          id: z.string(),
          name: text,
          title: text,
          organization: text,
          email: rules.email.optional(),
          phone: rules.phone.optional(),
          relationship: text,
        }),
      ),

      achievements: z.array(
        z.object({
          id: z.string(),
          title: text,
          description: text,
        }),
      ),

      customSections: z.array(
        z.object({
          id: text,
          kind: resumeAdditionalSectionKindSchema,
          title: text,
          editableTitle: z.boolean().optional(),
          items: z
            .array(
              z.object({
                id: text,
                name: text,
                issuer: text,
                date: text,
                link: text,
                referenceId: text,
                description: text,
                details: textList,
              }),
            )
            .default([]),
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

      customization: z
        .object({
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
        })
        .partial(),

      sync: documentSyncStateSchema,
      updatedAt: z.string(),
    })
    .passthrough()
    .partial();
}

const resumeDataInputSchema = createResumeDataSchema(shapeOnlyRules);
const resumeExportSchema = createResumeDataSchema(contentRules);

/**
 * An imported file has to say it is a resume. `basics` is the key every resume carries and
 * no other document type does, so `{}` and a cover letter's export are both refused.
 */
const resumeImportSchema = resumeDataInputSchema.required({ basics: true });

export interface ResumeCollection {
  version: 1;
  items: Record<string, ResumeData>;
}

/** The read path for storage, sync and the editor. */
export function parseResumeDataInput(value: unknown) {
  const result = resumeDataInputSchema.safeParse(value);

  if (!result.success) {
    return null;
  }

  return normalizeResumeData(result.data as Partial<ResumeData>);
}

/**
 * The content-checked parse, for output that has to be valid: a value the editor would flag
 * (an email of "j") throws here instead of reaching the file.
 */
export function parseResumeDataForExport(value: unknown) {
  const result = resumeExportSchema.safeParse(value);

  if (!result.success) {
    throw new Error("Resume payload is invalid");
  }

  return normalizeResumeData(result.data as Partial<ResumeData>);
}

/** The read path for a file the user imports. */
export function parseResumeImport(value: unknown) {
  const result = resumeImportSchema.safeParse(value);

  if (!result.success) {
    return null;
  }

  return normalizeResumeData(result.data as Partial<ResumeData>);
}

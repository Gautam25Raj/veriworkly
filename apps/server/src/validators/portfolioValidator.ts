import { z } from "zod";

import { portfolioSectionTypes, type PortfolioSectionType } from "@veriworkly/profile-core";

export const PORTFOLIO_TEMPLATE_IDS = ["signal", "atelier", "nimbus", "cipher"] as const;
export type PortfolioTemplateId = (typeof PORTFOLIO_TEMPLATE_IDS)[number];

/**
 * Templates that need an active `portfolio_publish` grant to publish and whose publications
 * follow the subscription (GRACE/SUSPENDED on lapse). Signal and Atelier are free: no grant to
 * publish, and billing never takes them down.
 */
export const PREMIUM_PORTFOLIO_TEMPLATE_IDS = [
  "nimbus",
  "cipher",
] as const satisfies readonly PortfolioTemplateId[];

export function isPremiumPortfolioTemplate(templateId: string) {
  return (PREMIUM_PORTFOLIO_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

const webUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS URL.");

const assetReferenceSchema = z.object({
  id: z.string().min(1).max(128),
  url: webUrlSchema,
});

const linkSchema = z.object({
  id: z.string().min(1).max(128),
  label: z.string().trim().min(1).max(80),
  url: webUrlSchema,
});

// One contract for section types: profile-core owns the list, the portfolio app re-exports it
// and `projectToPortfolio` emits from it, so a copy here drifts (it had 9 of the 18).
const sectionTypeSchema = z.enum(
  portfolioSectionTypes as [PortfolioSectionType, ...PortfolioSectionType[]],
);

const baseSectionSchema = z.object({
  id: z.string().min(1).max(128),
  type: sectionTypeSchema,
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(240).optional(),
  visible: z.boolean(),
  items: z.array(z.record(z.unknown())).max(24),
  settings: z.record(z.unknown()).optional(),
});

export const portfolioContentSchema = z.object({
  schemaVersion: z.literal(1),

  templateId: z.enum(PORTFOLIO_TEMPLATE_IDS),

  identity: z.object({
    name: z.string().trim().min(1).max(120),
    headline: z.string().trim().min(1).max(240),
    bio: z.string().trim().min(1).max(1600),
    location: z.string().trim().max(120),
    email: z.string().trim().email().max(254),
    availability: z.string().trim().max(160),
    avatar: assetReferenceSchema.nullable(),
  }),

  seo: z.object({
    title: z.string().trim().max(120),
    description: z.string().trim().max(300),
    socialImage: assetReferenceSchema.nullable(),
  }),

  socialLinks: z.array(linkSchema).max(12),

  sections: z.array(baseSectionSchema).max(24),

  pages: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        slug: z.string().trim().min(1).max(63),
        title: z.string().trim().min(1).max(120),
        sections: z.array(baseSectionSchema).max(24),
      }),
    )
    .max(10)
    .optional(),

  removeWatermark: z.boolean().optional(),
});

export const portfolioDraftContentSchema = portfolioContentSchema.extend({
  identity: portfolioContentSchema.shape.identity.extend({
    name: z.string().trim().max(120),
    headline: z.string().trim().max(240),
    bio: z.string().trim().max(1600),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
  }),

  socialLinks: z
    .array(
      linkSchema.extend({
        label: z.string().trim().max(80),
        url: z.union([z.literal(""), webUrlSchema]),
      }),
    )
    .max(12),

  sections: z
    .array(
      baseSectionSchema.extend({
        title: z.string().trim().max(120),
      }),
    )
    .max(24),

  pages: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        slug: z.string().trim().min(1).max(63),
        title: z.string().trim().max(120),
        sections: z
          .array(
            baseSectionSchema.extend({
              title: z.string().trim().max(120),
            }),
          )
          .max(24),
      }),
    )
    .max(10)
    .optional(),
});

export const portfolioSaveDraftSchema = z.object({
  documentId: z.string().min(1).optional(),
  subdomain: z.string().trim().min(1).max(63),
  revision: z.number().int().min(1).optional(),
  snapshot: portfolioDraftContentSchema,
});

export const portfolioPublishSchema = z.object({
  documentId: z.string().min(1),
  subdomain: z.string().trim().min(1).max(63),
  revision: z.number().int().min(1),
});

export const portfolioSubdomainParamsSchema = z.object({
  slug: z.string().trim().min(1).max(63),
});

export type PortfolioContentInput = z.infer<typeof portfolioDraftContentSchema>;

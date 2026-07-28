import { z } from "zod";
import { defineCollections, defineConfig } from "fumadocs-mdx/config";

/**
 * Blog frontmatter.
 *
 * Fields beyond title/description/author/date feed structured data
 * (BlogPosting + FAQPage JSON-LD) and topical clustering. See
 * `content/CONTENT-STRATEGY.md` for the editorial rules that govern them.
 */
export const blogPosts = defineCollections({
  type: "doc",
  dir: "content/blog",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    date: z.string().or(z.date()),

    /** Last substantive revision. Drives the "Updated" stamp and sitemap lastmod. */
    updated: z.string().or(z.date()).optional(),

    /** Single primary category — renders as the post eyebrow instead of a hardcoded label. */
    category: z.string().default("Career"),

    /** Topical cluster this post belongs to. Used for related-post surfacing. */
    cluster: z.string().optional(),

    /** Topics for internal linking and `keywords` metadata. */
    tags: z.array(z.string()).default([]),

    /** The primary query this post is written to answer. */
    primaryKeyword: z.string().optional(),

    /**
     * Q&A pairs rendered as an FAQ section AND emitted as FAQPage JSON-LD.
     * Keep answers 40-60 words: that is the extraction sweet spot for AI answers.
     */
    faq: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .default([]),

    /** Cornerstone posts that should be refreshed on a cadence. */
    pillar: z.boolean().default(false),
  }),
});

export default defineConfig();

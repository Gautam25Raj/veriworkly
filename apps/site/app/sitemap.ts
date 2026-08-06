import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { COMPETITORS } from "@/config/compare";
import { documentTypeSummaries, templateSummaries } from "@/config/templates";

import { fetchRoadmapSitemapEntries } from "@/features/roadmap/services/roadmap-backend";
import {
  fetchChangelogIndex,
  fetchLatestChangelogPublishedAt,
} from "@/features/changelog/services/changelog-backend";

/**
 * Almost all of this sitemap is compiled from local config and genuinely cannot change
 * until the next deploy — a deploy rebuilds the route, so a long window costs nothing.
 * The exceptions are `/roadmap/[id]` and `/changelog/[id]`: those are real, crawlable URLs
 * created in the backend without a redeploy, so a build-only sitemap would leave new pages
 * undiscoverable. A weekly refresh covers that without pointless churn.
 *
 * For this to actually hold, every backend read below must be cached for at least this long.
 * Next collapses a route's revalidate to the minimum of the segment value and every
 * fetch inside it, so calling a helper cached for 300s would silently pin this route to
 * 5 minutes regardless of what is declared here. All three helpers used below are on this
 * same 7-day schedule.
 */
export const revalidate = 604800; // 7 days

/**
 * Captured once when the module is first evaluated, i.e. at build/boot — NOT per
 * request. Using `new Date()` inside the handler stamped every static URL with "now" on
 * each revalidation, telling crawlers all ~35 pages changed minutes ago. Google demotes
 * or ignores `lastmod` once it detects that pattern, which devalues the signal for the
 * pages where it is real. Static content changes on deploy, so deploy time is the
 * honest value.
 */
const DEPLOYED_AT = new Date();

const publicRoutes = [
  {
    url: siteConfig.url,
    changeFrequency: "weekly" as const,
    priority: 1,
  },

  {
    url: `${siteConfig.url}/templates`,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  },

  {
    url: `${siteConfig.url}/pricing`,
    changeFrequency: "monthly" as const,
    priority: 0.85,
  },

  {
    url: `${siteConfig.url}/ats-checker`,
    changeFrequency: "monthly" as const,
    priority: 0.9,
  },

  // The tool itself, not just the page describing it. It is a static route with its own
  // metadata and heading, and it is the URL people actually link to and land on.
  {
    url: `${siteConfig.url}/ats-checker/scan`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  },

  {
    url: `${siteConfig.url}/roadmap`,
    changeFrequency: "daily" as const,
    priority: 0.8,
  },

  {
    url: `${siteConfig.url}/roadmap/todo`,
    changeFrequency: "daily" as const,
    priority: 0.75,
  },

  {
    url: `${siteConfig.url}/roadmap/in-progress`,
    changeFrequency: "daily" as const,
    priority: 0.75,
  },

  {
    url: `${siteConfig.url}/roadmap/done`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  },

  {
    url: `${siteConfig.url}/stats`,
    changeFrequency: "daily" as const,
    priority: 0.6,
  },

  {
    url: `${siteConfig.url}/changelog`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  },

  {
    url: `${siteConfig.url}/compare`,
    changeFrequency: "monthly" as const,
    priority: 0.75,
  },

  {
    url: `${siteConfig.url}/brand-kit`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  },

  {
    url: `${siteConfig.url}/about`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  },

  {
    url: `${siteConfig.url}/features`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  },

  {
    url: `${siteConfig.url}/how-it-works`,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  },

  {
    url: `${siteConfig.url}/affiliate`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  },

  {
    url: `${siteConfig.url}/ambassador`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  },

  {
    url: `${siteConfig.url}/contact`,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  },

  {
    url: `${siteConfig.url}/faq`,
    changeFrequency: "monthly" as const,
    priority: 0.75,
  },

  {
    url: `${siteConfig.url}/style-guide`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  },

  {
    url: `${siteConfig.url}/privacy`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  },

  {
    url: `${siteConfig.url}/security`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  },

  {
    url: `${siteConfig.url}/terms`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  },

  { url: siteConfig.links.app, changeFrequency: "weekly", priority: 0.8 },
  { url: siteConfig.links.docs, changeFrequency: "weekly", priority: 0.7 },
  { url: siteConfig.links.blog, changeFrequency: "weekly", priority: 0.7 },
] satisfies MetadataRoute.Sitemap;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = DEPLOYED_AT;

  const templateRoutes = documentTypeSummaries
    .filter((docType) => docType.status === "available")
    .map((docType) => ({
      url: `${siteConfig.url}${docType.href}`,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    }));

  const templateDetailRoutes = templateSummaries.map((template) => ({
    url: `${siteConfig.url}/templates/${template.documentType}/${template.id}`,
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  // Both helpers swallow their own failures and return empty/null. A backend blip must
  // degrade the sitemap to its static routes, never fail the route — an erroring
  // sitemap.xml is worse for crawlers than a temporarily shorter one.
  const [roadmapEntries, changelogLastModified, changelogEntries] = await Promise.all([
    fetchRoadmapSitemapEntries(),
    fetchLatestChangelogPublishedAt(),
    fetchChangelogIndex(),
  ]);

  const roadmapItemRoutes = roadmapEntries.map((entry) => {
    const updatedAt = new Date(entry.updatedAt);

    return {
      url: `${siteConfig.url}/roadmap/${entry.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.65,
      // An unparseable timestamp would render as `Invalid Date` in the XML.
      lastModified: Number.isNaN(updatedAt.getTime()) ? lastModified : updatedAt,
    };
  });

  /**
   * Each release now has its own `/changelog/[id]` page, so these are real crawlable URLs
   * rather than the `#id` fragments they used to be — fragments are not distinct URLs and
   * were discarded by crawlers. `lastModified` is the publish date: a shipped release is
   * immutable, so it never legitimately changes after the fact.
   */
  const changelogItemRoutes = changelogEntries.map((entry) => {
    const publishedAt = new Date(entry.publishedAt);

    return {
      url: `${siteConfig.url}/changelog/${entry.id}`,
      changeFrequency: "yearly" as const,
      priority: 0.6,
      lastModified: Number.isNaN(publishedAt.getTime()) ? lastModified : publishedAt,
    };
  });

  const compareRoutes = COMPETITORS.map((competitor) => ({
    url: `${siteConfig.url}/compare/${competitor.id}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
    lastModified,
  }));

  const changelogUrl = `${siteConfig.url}/changelog`;

  return [
    ...publicRoutes.map((route) => ({
      ...route,
      lastModified:
        route.url === changelogUrl ? (changelogLastModified ?? lastModified) : lastModified,
    })),
    ...templateRoutes.map((route) => ({ ...route, lastModified })),
    ...templateDetailRoutes.map((route) => ({ ...route, lastModified })),
    ...roadmapItemRoutes,
    ...changelogItemRoutes,
    ...compareRoutes,
  ];
}

import type { MetadataRoute } from "next";

import { blog } from "@/lib/source";
import { siteConfig } from "@/config/site";

export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPages = blog.getPages().map((page) => ({
    url: `${siteConfig.url}${page.url}`,
    // Real revision dates. Stamping every URL with "today" is a freshness signal
    // crawlers learn to discount.
    lastModified: new Date(page.data.updated ?? page.data.date),
    changeFrequency: page.data.pillar ? ("monthly" as const) : ("yearly" as const),
    priority: page.data.pillar ? 0.9 : 0.7,
  }));

  return [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    ...blogPages,
  ];
}

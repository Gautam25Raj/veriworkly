import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url;

  return [
    {
      url: `${baseUrl}/login`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
  ];
}

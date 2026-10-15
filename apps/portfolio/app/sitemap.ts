import type { MetadataRoute } from "next";

import { templates } from "@/templates/catalog/templates";
import { portfolioPublicUrl, siteConfig } from "@/config/site";

import { backendApiUrl, firstPartyServerHeaders } from "@/lib/backend";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: siteConfig.url,
      changeFrequency: "weekly",
      priority: 1,
    },

    {
      url: `${siteConfig.url}/pricing`,
      changeFrequency: "monthly",
      priority: 0.8,
    },

    {
      url: `${siteConfig.url}/templates`,
      changeFrequency: "weekly",
      priority: 0.9,
    },

    {
      url: `${siteConfig.url}/faq`,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    ...templates.map((template) => ({
      url: `${siteConfig.url}/templates/${template.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];

  try {
    const response = await fetch(backendApiUrl("/portfolios/public", true), {
      headers: firstPartyServerHeaders(),
      next: { revalidate, tags: ["portfolios-list"] },
    });

    if (!response.ok) return routes;

    const payload = (await response.json()) as {
      data?: Array<{ subdomain: string; updatedAt: string }>;
    };

    return [
      ...routes,
      ...(payload.data ?? []).map((publication) => {
        const updatedAt = new Date(publication.updatedAt);

        return {
          url: portfolioPublicUrl(publication.subdomain),
          changeFrequency: "weekly" as const,
          priority: 0.8,
          ...(Number.isNaN(updatedAt.getTime()) ? {} : { lastModified: updatedAt }),
        };
      }),
    ];
  } catch {
    return routes;
  }
}

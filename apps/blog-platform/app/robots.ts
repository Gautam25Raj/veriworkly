import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * `/api/og` is allowed explicitly ahead of the `/api/` block. Every post points its
 * `og:image` at that route, so a blanket `Disallow: /api/` tells crawlers they may
 * not fetch the social card they were just handed.
 */
const allow = ["/", "/api/og"];
const disallow = ["/api/", "/_next/", "/static/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow,
        disallow,
      },
      {
        // Named explicitly so the allowance survives any future tightening of the
        // wildcard rule. Citation by these engines is the blog's acquisition channel.
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "OAI-SearchBot",
          "ClaudeBot",
          "Claude-User",
          "Claude-SearchBot",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
          "Applebot-Extended",
          "CCBot",
        ],
        allow,
        disallow,
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}

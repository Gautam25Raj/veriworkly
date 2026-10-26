import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * `/login` is the only indexable page. Share pages stay crawlable so a crawler can read
 * their `noindex`; the machine-readable files are open to every agent `llms.txt` invites.
 */
const allow = ["/login", "/share/", "/llms.txt", "/openapi.json", "/.well-known/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow,
        disallow: ["/"],
      },
    ],

    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}

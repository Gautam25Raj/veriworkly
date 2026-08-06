const isDev = process.env.NODE_ENV === "development";

export const siteConfig = {
  name: "VeriWorkly Portfolio",

  url: process.env.SITE_URL || "https://portfolio.veriworkly.com",

  description:
    "Build and publish a professional developer or designer portfolio website in minutes. Switch templates freely, configure custom SEO controls, track analytics, and showcase your best projects.",

  links: {
    github: "https://github.com/VeriWorkly/veriworkly",
    twitter: "https://x.com/veriworkly",
    linkedin: "https://linkedin.com/company/veriworkly",

    main: isDev ? "http://localhost:3000" : "https://veriworkly.com",
    app: isDev ? "http://localhost:3001" : "https://app.veriworkly.com",
    docs: isDev ? "http://localhost:3002" : "https://docs.veriworkly.com",
    blog: isDev ? "http://localhost:3003" : "https://blog.veriworkly.com",
    portfolio: isDev ? "http://localhost:3004" : "https://portfolio.veriworkly.com",
  },

  keywords: [
    "portfolio builder",
    "professional portfolio website",
    "developer portfolio",
    "designer portfolio",
    "online portfolio builder",
    "portfolio builder for developers",
    "portfolio builder for designers",
    "subdomain portfolio",
    "no-code portfolio builder",
    "developer portfolio template",
    "designer portfolio website",
    "interactive portfolio website",
    "SEO optimized portfolio",
  ],

  twitter: {
    handle: "@veriworkly",
    site: "@veriworkly",
    cardType: "summary_large_image",
  },
} as const;

export const veriworklyProductLinks = {
  studio: isDev ? "http://localhost:3001" : "https://app.veriworkly.com",
  docs: isDev ? "http://localhost:3002" : "https://docs.veriworkly.com",
  blog: isDev ? "http://localhost:3003" : "https://blog.veriworkly.com",
} as const;

export function portfolioPublicUrl(subdomain: string) {
  return isDev ? `http://${subdomain}.localhost:3004` : `https://${subdomain}.veriworkly.com`;
}

/**
 * The address to show the *owner* for their own portfolio.
 *
 * A dedicated subdomain is the Creator Pro perk; free portfolios live on the
 * platform host under `/portfolio/{slug}`. Both forms resolve (the proxy rewrites
 * either to the same route), but the workspace has to advertise the one the user
 * actually has — the dashboard used to hand every free account a subdomain URL
 * while the editor showed them the path form, for the same portfolio.
 */
export function portfolioWorkspaceUrl(slug: string, canPublish: boolean) {
  const href = canPublish
    ? portfolioPublicUrl(slug)
    : `${siteConfig.links.portfolio}/portfolio/${slug}`;

  return { href, display: href.replace(/^https?:\/\//, "") };
}

const isDev = process.env.NODE_ENV === "development";

const links = {
  github: "https://github.com/VeriWorkly/veriworkly",
  twitter: "https://x.com/veriworkly",
  linkedin: "https://linkedin.com/company/veriworkly",

  main: isDev ? "http://localhost:3000" : "https://veriworkly.com",
  app: isDev ? "http://localhost:3001" : "https://app.veriworkly.com",
  docs: isDev ? "http://localhost:3002" : "https://docs.veriworkly.com",
  blog: isDev ? "http://localhost:3003" : "https://blog.veriworkly.com",
  portfolio: isDev ? "http://localhost:3004" : "https://portfolio.veriworkly.com",
} as const;

export const siteConfig = {
  shortName: "VeriWorkly",

  /** The studio's own origin, for metadata, sitemap and robots. `SITE_URL` is the marketing site's. */
  url: process.env.NEXT_PUBLIC_APP_URL || links.app,

  description:
    "Free, open-source, and privacy-first studio for resumes, cover letters, portfolios, ATS checks, and AI-assisted content.",

  links,

  keywords: [
    "free resume builder",
    "ATS resume builder",
    "ATS-friendly resume builder",
    "resume builder no login",
    "online resume builder",
    "resume maker",
    "CV builder",
    "professional resume templates",
    "resume creator",
    "resume generator",
    "PDF resume builder",
    "open source resume builder",
    "privacy-first resume builder",
    "developer resume builder",
    "modern resume templates",
    "free CV maker",
    "resume templates free",
    "AI resume builder",
    "job resume maker",
    "best free resume builder",
  ],

  twitter: {
    handle: "@veriworkly",
  },
} as const;

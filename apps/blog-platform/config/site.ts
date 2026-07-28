const isDev = process.env.NODE_ENV === "development";

export const siteConfig = {
  name: "VeriWorkly Blog",
  shortName: "VeriWorkly",

  creator: "Gautam Raj",
  email: "info@veriworkly.com",

  tagline: "Resume and job search guidance, backed by evidence.",
  description:
    "Research-backed guidance on resumes, job search strategy, and hiring technology — plus engineering notes from the team building VeriWorkly.",
  url: process.env.SITE_URL || "https://blog.veriworkly.com",

  links: {
    twitter: "https://x.com/veriworkly",
    github: "https://github.com/VeriWorkly/veriworkly",
    linkedin: "https://linkedin.com/company/veriworkly",

    main: isDev ? "http://localhost:3000" : "https://veriworkly.com",
    app: isDev ? "http://localhost:3001" : "https://app.veriworkly.com",
    docs: isDev ? "http://localhost:3002" : "https://docs.veriworkly.com",
    blog: isDev ? "http://localhost:3003" : "https://blog.veriworkly.com",
    portfolio: isDev ? "http://localhost:3004" : "https://portfolio.veriworkly.com",
  },

  keywords: [
    "resume tips",
    "ats resume",
    "applicant tracking system",
    "job search advice",
    "resume writing",
    "free resume builder",
    "VeriWorkly",
  ],
} as const;

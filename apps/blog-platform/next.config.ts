import path from "path";
import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
  async redirects() {
    return [
      {
        // Consolidated into the researched ATS pillar; the old post competed
        // with it for the same queries.
        source: "/mastering-ats-friendly-resumes-2026",
        destination: "/ats-resume-myths-what-the-evidence-shows",
        permanent: true,
      },
    ];
  },
};

export default withMDX(nextConfig);

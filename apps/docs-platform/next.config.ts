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
      // These are public marketing routes, not documentation routes. The 301s resolve the
      // historical docs-subdomain 404s without turning the docs shell into a duplicate.
      { source: "/faq", destination: "https://veriworkly.com/faq", permanent: true },
      { source: "/templates", destination: "https://veriworkly.com/templates", permanent: true },
      { source: "/roadmap", destination: "https://veriworkly.com/roadmap", permanent: true },
    ];
  },
};

export default withMDX(nextConfig);

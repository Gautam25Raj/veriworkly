import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone",
  reactStrictMode: true,
  async redirects() {
    return [
      // One generated copy of the API spec lives on the docs site; this was a duplicate of it.
      {
        source: "/openapi.json",
        destination: "https://docs.veriworkly.com/openapi.json",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

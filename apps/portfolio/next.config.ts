import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Not nonce-based (that would require threading a per-request nonce through
// every layout/template render path, including the 4 independent portfolio
// templates) so 'unsafe-inline' stays in script-src/style-src for Next's own
// hydration scripts and the many inline `style={{...}}` usages across the
// template library. It still blocks the highest-value vector — loading a
// `<script src="https://attacker.example/x.js">` from an untrusted origin —
// since external script/style/connect/frame sources are restricted to
// same-origin and first-party veriworkly.com subdomains.
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.veriworkly.com${isProd ? "" : " http://localhost:* ws://localhost:*"}`,
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

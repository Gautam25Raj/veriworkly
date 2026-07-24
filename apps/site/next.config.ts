import type { NextConfig } from "next";

// The backend origin has to be reachable from the browser (contact form, checkout,
// ambassador apply), so it is added to connect-src explicitly rather than opening the
// directive up to all of `https:`.
const backendOrigin = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_BACKEND_URL;

    return raw ? new URL(raw).origin : "";
  } catch {
    return "";
  }
})();

const connectSrc = ["'self'", backendOrigin, "https://*.veriworkly.com"].filter(Boolean).join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' is still required: next-themes injects a blocking inline script to
  // set the theme class before paint, and every page ships inline JSON-LD. Moving to a
  // nonce needs middleware, which would opt every static route into dynamic rendering —
  // a bad trade for this site. 'unsafe-eval' is NOT needed and has been dropped.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "frame-ancestors 'self'",
  // Hardening that costs nothing here: the app has no <object>/<embed>, never needs to
  // rewrite <base>, and only ever posts to itself or the backend.
  "object-src 'none'",
  "base-uri 'none'",
  `form-action 'self'${backendOrigin ? ` ${backendOrigin}` : ""}`,
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Cross-origin isolation. `same-origin-allow-popups` (not `same-origin`) so the
  // hosted-checkout redirect and OAuth popups keep working.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },

  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Cloud deploys run `next start`, which warns and gains nothing from a standalone
  // bundle. Only the container build (which runs `node apps/site/server.js`) opts in.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  transpilePackages: ["@veriworkly/ui"],
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|ico)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// The backend origin is added to connect-src explicitly rather than opening the directive to all of `https:`.
const backendOrigin = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_BACKEND_URL;

    return raw ? new URL(raw).origin : "";
  } catch {
    return "";
  }
})();

const isProd = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' is for next-themes and Next's inline bootstrap scripts. 'wasm-unsafe-eval' is for
  // yoga-layout, which react-pdf compiles from an inline base64 module when a PDF is rendered.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isProd ? "" : " 'unsafe-eval'"}`,
  // Cover-letter previews load the chosen typeface from Google Fonts (features/documents/constants/fonts.ts).
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src ${["'self'", backendOrigin, "https://*.veriworkly.com", "data:", "blob:"].filter(Boolean).join(" ")}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  `form-action 'self'${backendOrigin ? ` ${backendOrigin}` : ""}`,
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  // Production only: a non-localhost dev backend (LAN IP, tunnel) would be upgraded to https and fail.
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // `same-origin-allow-popups`, not `same-origin`, so the checkout redirect and OAuth popups keep working.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

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

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

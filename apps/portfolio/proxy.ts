import { NextResponse, type NextRequest } from "next/server";

import { siteConfig } from "@/config/site";

const PLATFORM_HOST = "portfolio.veriworkly.com";
const publicPlatformPaths = [
  "/",
  "/pricing",
  "/portfolios",
  "/user",
  "/portfolio",
  "/templates",
  "/faq",
  "/dashboard",
  "/editor",
  "/preview",
  "/analytics",
  "/settings",
  "/profile",
];

const SESSION_COOKIE_NAMES = [
  "__Secure-veriworkly-auth.session_token",
  "veriworkly-auth.session_token",
];

export function isPublicPlatformPath(path: string) {
  return publicPlatformPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function hasPortfolioSessionCookie(request: NextRequest) {
  return SESSION_COOKIE_NAMES.some((cookieName) => Boolean(request.cookies.get(cookieName)?.value));
}

// A precise "is this a static file request" check: only the final path
// segment ending in a dot-extension counts, so a route or username that
// merely contains a literal dot elsewhere (e.g. deeper in the path) doesn't
// get misclassified as a static asset and skip the auth gate below.
export function looksLikeStaticAssetPath(path: string) {
  const lastSegment = path.split("/").pop() ?? "";
  return /\.[a-zA-Z0-9]+$/.test(lastSegment);
}

export default function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? "").split(":")[0];

  const path = request.nextUrl.pathname;
  const isPlatformHost =
    hostname === PLATFORM_HOST || hostname === "localhost" || hostname === "portfolio.localhost";

  if (
    isPlatformHost &&
    !isPublicPlatformPath(path) &&
    !path.startsWith("/api") &&
    !looksLikeStaticAssetPath(path)
  ) {
    const hasSession = hasPortfolioSessionCookie(request);

    if (!hasSession) {
      const loginUrl = `${siteConfig.links.app}/login`;

      return NextResponse.redirect(`${loginUrl}?callbackURL=${encodeURIComponent(request.url)}`);
    }
  }

  if (path.startsWith("/_next") || path.startsWith("/api") || looksLikeStaticAssetPath(path))
    return NextResponse.next();

  if (isPlatformHost) {
    const match = path.match(/^\/(?:user|portfolio)\/([^/]+)(.*)$/);

    return match
      ? NextResponse.rewrite(new URL(`/portfolios/${match[1]}${match[2]}`, request.url))
      : NextResponse.next();
  }

  const username = hostname.endsWith(".veriworkly.com")
    ? hostname.replace(".veriworkly.com", "")
    : hostname.endsWith(".localhost")
      ? hostname.replace(".localhost", "")
      : null;

  return username
    ? NextResponse.rewrite(new URL(`/portfolios/${username}${path}`, request.url))
    : NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

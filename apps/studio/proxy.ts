import { NextRequest, NextResponse } from "next/server";

import { getSafeAuthCallback } from "@/lib/auth-redirect";

/**
 * Every `/_next/` path is excluded, not just `static` and `image`.
 *
 * The framework's own endpoints live under that prefix too — in development
 * that includes the HMR socket, and answering its upgrade request with a normal
 * `NextResponse.next()` (carrying a `Set-Cookie`) fails the handshake. The dev
 * client then retries instead of bootstrapping, and the page never hydrates.
 * Auth redirects have no business on those routes in any case.
 */
export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};

const PROTECTED_PATH_PREFIXES = ["/admin", "/profile/master", "/profile/advanced"];
const GUEST_COOKIE_NAME = "veriworkly-guest-mode";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function isProtectedStudioPath(pathname: string) {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function withGuestCookie(response: NextResponse, request: NextRequest) {
  if (!request.cookies.get(GUEST_COOKIE_NAME)?.value) {
    response.cookies.set(GUEST_COOKIE_NAME, "true", {
      httpOnly: true,
      maxAge: GUEST_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionCookie =
    request.cookies.get("__Secure-veriworkly-auth.session_token")?.value ||
    request.cookies.get("veriworkly-auth.session_token")?.value;

  const isLoginPage = pathname === "/login";

  const isProtectedPath = isProtectedStudioPath(pathname);
  const isAuthenticated = !!sessionCookie;

  if (isLoginPage && isAuthenticated) {
    const callbackURL = getSafeAuthCallback(request.nextUrl.searchParams.get("callbackURL"));
    const redirectUrl = new URL(callbackURL, request.url);

    return NextResponse.redirect(redirectUrl);
  }

  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackURL", `${pathname}${request.nextUrl.search}`);

    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  return isAuthenticated ? response : withGuestCookie(response, request);
}

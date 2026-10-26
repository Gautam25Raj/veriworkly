import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAMES } from "@/lib/auth-redirect";
import { serverFetch } from "@/lib/server-fetch";

/**
 * The domains the API may have scoped its session cookie to (`AUTH_COOKIE_DOMAIN`): this host
 * and each parent above the top-level label. A cookie is only removed by a `Set-Cookie` with
 * the same domain, and studio does not know which one the API chose.
 */
function cookieDomains(hostname: string) {
  const labels = hostname.split(".");

  return labels.slice(0, -1).map((_, index) => labels.slice(index).join("."));
}

function expiredCookie(name: string, domain?: string) {
  const secure = name.startsWith("__Secure-") ? "; Secure" : "";

  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}${domain ? `; Domain=${domain}` : ""}`;
}

/**
 * Where a server render sends a browser whose session cookie the API rejects (revoked, expired):
 * the cookie is cleared and the user signs in again, instead of browsing as a guest who believes
 * they are signed in.
 *
 * The API is asked first, so a link to this route from anywhere cannot sign out a live session.
 */
export async function GET(request: NextRequest) {
  const hasSession = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
  if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));

  const { status } = await serverFetch("/users/me");
  if (status !== 401 && status !== 403) return NextResponse.redirect(new URL("/", request.url));

  const response = NextResponse.redirect(new URL("/login?session=expired", request.url));

  for (const name of SESSION_COOKIE_NAMES) {
    response.headers.append("Set-Cookie", expiredCookie(name));

    for (const domain of cookieDomains(request.nextUrl.hostname)) {
      response.headers.append("Set-Cookie", expiredCookie(name, domain));
    }
  }

  return response;
}

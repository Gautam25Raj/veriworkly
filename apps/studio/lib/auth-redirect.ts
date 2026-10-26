import { siteConfig } from "@/config/site";

/** better-auth's session cookie: `__Secure-` prefixed over HTTPS, bare in local development. */
export const SESSION_COOKIE_NAMES = [
  "__Secure-veriworkly-auth.session_token",
  "veriworkly-auth.session_token",
] as const;

/** Where a session the server no longer accepts is cleared before signing in again. */
export const SESSION_EXPIRED_PATH = "/auth/session-expired";

const APP_ORIGIN = new URL(siteConfig.links.app).origin;

const TRUSTED_ORIGINS = new Set<string>([
  APP_ORIGIN,
  new URL(siteConfig.links.portfolio).origin,
  new URL(siteConfig.links.main).origin,
]);

export function getSafeAuthCallback(rawCallback: string | null, fallback = "/") {
  if (!rawCallback) return fallback;

  // Prevent redirect loops back to login page
  if (
    rawCallback === "/login" ||
    rawCallback.startsWith("/login?") ||
    rawCallback.startsWith("/login/")
  )
    return fallback;

  // Resolve against the app's own origin rather than trusting a bare string-prefix
  // check — `rawCallback.startsWith("/") && !startsWith("//")` alone still lets a
  // backslash-based bypass like "/\evil.com" through, since some browsers normalize
  // a leading "/\" to a protocol-relative "//" during navigation. Letting the URL
  // parser resolve it and then checking the *resulting* origin closes that gap.
  if (rawCallback.startsWith("/")) {
    try {
      const resolved = new URL(rawCallback, APP_ORIGIN);
      if (resolved.origin !== APP_ORIGIN) return fallback;
      if (resolved.pathname === "/login" || resolved.pathname.startsWith("/login/")) {
        return fallback;
      }
      // Landing there after sign-in would clear the session just created.
      if (resolved.pathname === SESSION_EXPIRED_PATH) return fallback;
      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    } catch {
      return fallback;
    }
  }

  try {
    const callback = new URL(rawCallback);
    if (callback.pathname === "/login" || callback.pathname.startsWith("/login/")) return fallback;

    const isLocal = callback.hostname === "localhost" || callback.hostname === "127.0.0.1";
    const isTrusted =
      (callback.protocol === "https:" || (isLocal && callback.protocol === "http:")) &&
      TRUSTED_ORIGINS.has(callback.origin);

    return isTrusted ? callback.toString() : fallback;
  } catch {
    return fallback;
  }
}

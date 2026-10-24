import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { ApiRequestError, fetchApiData } from "@/utils/fetchApiData";

/** "Signed out" and "backend returned 503" need opposite responses; treating the second as the first causes a login redirect loop. */

export type ServerApiFailure =
  | "no-session"
  /** A session was sent but the backend rejected it (expired, revoked). */
  | "unauthorized"
  /** Feature flag off, backend down, timeout, malformed response. Not the user's fault. */
  | "unavailable";

export type ServerApiResult<T> =
  { ok: true; data: T } | { ok: false; reason: ServerApiFailure; status?: number };

// Node's fetch has no cookie jar, so the browser's cookies are read from next/headers and forwarded.

/** Only the auth cookies ("veriworkly-auth." prefix, plus "__Secure-" over HTTPS) go to the backend, never the whole jar. */
export function sessionCookieHeader(all: { name: string; value: string }[]) {
  return all
    .filter(({ name }) => /^(__Secure-)?veriworkly-auth\./.test(name))
    .map(({ name, value }) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

export const fetchServerApiResult = cache(async function fetchServerApiResult<T>(
  path: string,
): Promise<ServerApiResult<T>> {
  let cookieHeader = "";

  try {
    cookieHeader = sessionCookieHeader((await cookies()).getAll());
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!cookieHeader.trim()) return { ok: false, reason: "no-session" };

  try {
    const data = await fetchApiData<T>(path, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });

    return { ok: true, data };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      const reason: ServerApiFailure =
        error.status === 401 || error.status === 403 ? "unauthorized" : "unavailable";

      return { ok: false, reason, status: error.status };
    }

    return { ok: false, reason: "unavailable" };
  }
});

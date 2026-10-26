import "server-only";

import { cookies, headers } from "next/headers";

import {
  hasSessionCookieIn,
  type IncomingRequest,
  serverFetchDataFrom,
  serverFetchFrom,
} from "@/lib/server-fetch-core";

async function incomingRequest(): Promise<IncomingRequest> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);

  return { cookies: cookieStore, headers: requestHeaders };
}

export async function hasSessionCookie() {
  return hasSessionCookieIn(await cookies());
}

/** A backend call on behalf of the browser being rendered for; see `serverFetchFrom`. */
export async function serverFetch(path: string, init?: RequestInit) {
  return serverFetchFrom(await incomingRequest(), path, init);
}

type ServerFetchDataOptions = RequestInit & { notFoundAsNull?: boolean };

/** The response's `data`; `null` only for a 404 with `notFoundAsNull`, otherwise it throws. */
export async function serverFetchData<T>(
  path: string,
  options: ServerFetchDataOptions & { notFoundAsNull: true },
): Promise<T | null>;
export async function serverFetchData<T>(
  path: string,
  options?: ServerFetchDataOptions,
): Promise<T>;
export async function serverFetchData<T>(path: string, options?: ServerFetchDataOptions) {
  return serverFetchDataFrom<T>(await incomingRequest(), path, options);
}

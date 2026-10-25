import { backendApiUrl } from "@/lib/constants";
import { clearInvalidSessionAndRedirect, isInvalidSessionResponse } from "@/lib/invalid-session";

interface ApiSuccessResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export class ApiRequestError extends Error {
  status: number;
  /** The error body's `details`, e.g. `currentUpdatedAt` on a master-profile 409. */
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.details = details;
  }
}

function normalizeHeaders(headers?: HeadersInit) {
  return Object.fromEntries(new Headers(headers ?? {}).entries());
}

function firstPartyServerHeaders(headers?: HeadersInit) {
  const normalizedHeaders = normalizeHeaders(headers);

  if (typeof window !== "undefined") return normalizedHeaders;

  const siteOrigin = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : "";
  if (!siteOrigin) return normalizedHeaders;

  return {
    Origin: siteOrigin,
    ...normalizedHeaders,
  };
}

export async function fetchApiData<T>(
  path: string,
  options: RequestInit & {
    errorMessage?: string;
    nullOnNotFound?: boolean;
    /**
     * `false` for calls a guest can make: their 401 means "not signed in", not "session
     * expired", so it must reach the caller instead of signing out and leaving for /login.
     */
    redirectOnInvalidSession?: boolean;
  } = {},
): Promise<T> {
  const {
    errorMessage,
    nullOnNotFound,
    redirectOnInvalidSession = true,
    ...fetchOptions
  } = options;

  const url = backendApiUrl(path);

  const response = await fetch(url, {
    ...fetchOptions,
    credentials: fetchOptions.credentials ?? "include",
    headers: {
      "Content-Type": "application/json",
      ...firstPartyServerHeaders(fetchOptions.headers),
    },
  });

  if (!response.ok) {
    if (redirectOnInvalidSession && isInvalidSessionResponse(path, response.status)) {
      await clearInvalidSessionAndRedirect();
    }

    if (response.status === 404 && nullOnNotFound) {
      return null as unknown as T;
    }

    const errorData = await response.json().catch(() => ({}));
    const message = errorMessage || errorData.message || `Request failed: ${response.status}`;

    throw new ApiRequestError(message, response.status, errorData.details);
  }

  const payload = (await response.json()) as ApiSuccessResponse<T>;

  return payload.data;
}

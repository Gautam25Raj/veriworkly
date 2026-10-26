import type { ApiKeyDetailRecord, GeneratedApiKeyRecord } from "./components/ApiKeyTypes";

import { endOfLocalDay, toLocalDateInput } from "@/lib/local-date";
import { ApiRequestError, fetchApiData } from "@/utils/fetchApiData";

/**
 * The server's `API_KEY_DEFAULT_RATE_LIMIT` and `API_KEY_MAX_RATE_LIMIT` defaults; the server
 * clamps anything above the maximum. `server-contract.contract.test.ts` fails if they drift.
 */
export const API_KEY_DEFAULT_RATE_LIMIT = 20;
export const API_KEY_MAX_RATE_LIMIT = 600;

/** The API-key rate limiter counts requests per 15-minute window. */
export const API_KEY_RATE_WINDOW_LABEL = "15 min";

export type ApiKeyStatus = "active" | "expired" | "revoked" | "disabled";

export const API_KEY_STATUS_LABELS: Record<ApiKeyStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
  disabled: "Disabled",
};

/**
 * A key authenticates only while it is active, not revoked and not past its expiry. Revoked is
 * the user's (or a rotate's) doing; an inactive key with no `revokedAt` was disabled by an admin.
 */
export function getApiKeyStatus(
  key: { isActive: boolean; revokedAt?: string | null; expiresAt?: string | null },
  now = Date.now(),
): ApiKeyStatus {
  if (key.revokedAt) return "revoked";
  if (!key.isActive) return "disabled";
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= now) return "expired";
  return "active";
}

/** The "YYYY-MM-DD" a date input shows for a stored expiry, in the user's own time zone. */
export function expiryDateInputValue(expiresAt: string | null | undefined) {
  if (!expiresAt) return "";

  const parsed = new Date(expiresAt);

  return Number.isNaN(parsed.getTime()) ? "" : toLocalDateInput(parsed);
}

/** A picked date expires at the end of that local day; empty means the server's default lifetime. */
function expiryFromDateInput(value: string) {
  return value ? endOfLocalDay(value).toISOString() : undefined;
}

export type ApiKeyCreatePayload = {
  name: string;
  scopes: string[];
  rateLimit: number;
  expiresAt?: string;
};

export function buildCreateApiKeyPayload(values: {
  name: string;
  scopes: string[];
  rateLimit: number;
  expiresAt: string;
}): ApiKeyCreatePayload {
  return {
    name: values.name.trim(),
    scopes: values.scopes,
    rateLimit: values.rateLimit,
    expiresAt: expiryFromDateInput(values.expiresAt),
  };
}

export type ApiKeyRotatePayload = {
  name?: string;
  rateLimit?: number;
  expiresAt?: string;
};

/**
 * Only the fields the user changed: the server copies every other one from the current key, so
 * an unchanged expiry keeps its exact time and an admin-raised limit is not resent.
 */
export function buildRotateApiKeyPayload(
  current: Pick<ApiKeyDetailRecord, "name" | "rateLimit" | "expiresAt">,
  form: { name: string; rateLimit: number; expiresAt: string },
): ApiKeyRotatePayload {
  const payload: ApiKeyRotatePayload = {};
  const name = form.name.trim();

  if (name && name !== current.name) payload.name = name;
  if (form.rateLimit !== current.rateLimit) payload.rateLimit = form.rateLimit;
  if (form.expiresAt && form.expiresAt !== expiryDateInputValue(current.expiresAt)) {
    payload.expiresAt = expiryFromDateInput(form.expiresAt);
  }

  return payload;
}

/** The server's own words; a validation 400 carries them per field under `details`. */
export function apiKeyErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiRequestError)) return fallback;

  const [firstIssue] = Array.isArray(error.details) ? error.details : [];
  const issueMessage = (firstIssue as { message?: unknown } | undefined)?.message;

  return typeof issueMessage === "string" && issueMessage ? issueMessage : error.message;
}

/** The studio page for one key. */
export function apiKeyHref(id: string) {
  return `/api-keys/${encodeURIComponent(id)}`;
}

function apiKeyPath(id: string) {
  return `/api-keys/${encodeURIComponent(id)}`;
}

export function fetchApiKey(id: string) {
  return fetchApiData<ApiKeyDetailRecord>(apiKeyPath(id), { method: "GET" });
}

export function createApiKey(payload: ApiKeyCreatePayload) {
  return fetchApiData<GeneratedApiKeyRecord>("/api-keys", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rotateApiKey(id: string, payload: ApiKeyRotatePayload) {
  return fetchApiData<GeneratedApiKeyRecord>(`${apiKeyPath(id)}/rotate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function revokeApiKey(id: string) {
  return fetchApiData<null>(`${apiKeyPath(id)}/revoke`, { method: "POST" });
}

export function deleteApiKey(id: string) {
  return fetchApiData<null>(apiKeyPath(id), { method: "DELETE" });
}

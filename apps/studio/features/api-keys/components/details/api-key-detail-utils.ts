import type { ApiKeyStatus } from "../../api-key-service";

import { API_KEY_SCOPE_OPTIONS } from "../ApiKeyScopes";

export const scopeOptionMap = new Map<string, (typeof API_KEY_SCOPE_OPTIONS)[number]>(
  API_KEY_SCOPE_OPTIONS.map((scope) => [scope.value, scope]),
);

const STATUS_CLASSES: Record<ApiKeyStatus, string> = {
  active: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  expired: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  revoked: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
  disabled: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
};

export function statusClass(status: ApiKeyStatus) {
  return STATUS_CLASSES[status];
}

/** Why a key that is not active cannot authenticate. */
export const INACTIVE_STATUS_NOTES: Record<Exclude<ApiKeyStatus, "active">, string> = {
  expired: "This key has expired and cannot authenticate requests. Create a new key to replace it.",
  revoked: "This key was revoked and cannot authenticate requests.",
  disabled: "An administrator disabled this key. It cannot authenticate requests.",
};

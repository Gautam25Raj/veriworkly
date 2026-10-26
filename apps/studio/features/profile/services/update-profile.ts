import type { AccountProfile } from "@/features/profile/services/account-profile";

import { fetchApiData } from "@/utils/fetchApiData";

export async function updateAccountName(name: string): Promise<AccountProfile> {
  return fetchApiData<AccountProfile>("/users/me/name", {
    method: "PUT",
    body: JSON.stringify({ name }),
    errorMessage: "Failed to update profile name",
  });
}

export async function updateAccountUsername(username: string): Promise<AccountProfile> {
  return fetchApiData<AccountProfile>("/users/me/username", {
    method: "PUT",
    body: JSON.stringify({ username }),
  });
}

export type UsernameAvailability = {
  available: boolean;
  /** The handle the server would store: lowercased, with stray and repeated hyphens folded. */
  normalizedUsername: string;
  reason?: "too_short" | "too_long" | "invalid_characters" | "reserved" | "taken";
};

export async function checkUsernameAvailability(username: string): Promise<UsernameAvailability> {
  return fetchApiData<UsernameAvailability>(`/users/${encodeURIComponent(username)}/availability`, {
    method: "GET",
    errorMessage: "Failed to check username availability",
  });
}

export async function updateAutoSyncPreference(enabled: boolean): Promise<AccountProfile> {
  return fetchApiData<AccountProfile>("/users/me/sync", {
    method: "PUT",
    body: JSON.stringify({ enabled }),
    errorMessage: "Failed to update sync preference",
  });
}

/**
 * The server's message reaches the user as is, notably the 409 telling them to cancel a
 * live subscription before deleting.
 */
export async function deleteAccount(): Promise<void> {
  return fetchApiData<void>("/users/me", { method: "DELETE" });
}

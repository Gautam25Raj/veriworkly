import { WORKSPACE_SETTINGS_STORAGE_KEY } from "@/lib/constants";

import { z } from "zod";

import {
  safeSetLocalStorageItem,
  type LocalStorageWriteResult,
} from "@/features/documents/services/storage/safe-local-storage";

function isBrowser() {
  return typeof window !== "undefined";
}

export interface WorkspaceSettings {
  autoSyncEnabled: boolean;
}

const defaultWorkspaceSettings: WorkspaceSettings = {
  autoSyncEnabled: false,
};

const workspaceSettingsSchema = z.object({
  autoSyncEnabled: z.boolean(),
});

/**
 * An unreadable stored value is reported and left in place, not deleted: removing it would
 * turn auto-sync off for good without the user ever having chosen that.
 */
export function loadWorkspaceSettingsFromLocalStorage(): WorkspaceSettings {
  if (!isBrowser()) {
    return defaultWorkspaceSettings;
  }

  const rawValue = window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY);

  if (!rawValue) {
    return defaultWorkspaceSettings;
  }

  let stored: unknown;

  try {
    stored = JSON.parse(rawValue);
  } catch (error) {
    console.warn("Stored workspace settings are not JSON; using the defaults.", error);
    return defaultWorkspaceSettings;
  }

  const parsed = workspaceSettingsSchema.safeParse(stored);

  if (!parsed.success) {
    console.warn("Stored workspace settings are invalid; using the defaults.", parsed.error);
    return defaultWorkspaceSettings;
  }

  return parsed.data;
}

function saveWorkspaceSettingsToLocalStorage(settings: WorkspaceSettings): LocalStorageWriteResult {
  if (!isBrowser()) {
    return { ok: true };
  }

  return safeSetLocalStorageItem(
    window.localStorage,
    WORKSPACE_SETTINGS_STORAGE_KEY,
    JSON.stringify(workspaceSettingsSchema.parse(settings)),
  );
}

export function setAutoSyncEnabledInLocalStorage(
  autoSyncEnabled: boolean,
): LocalStorageWriteResult {
  return saveWorkspaceSettingsToLocalStorage({ autoSyncEnabled });
}

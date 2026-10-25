"use client";

import { useEffect } from "react";

import { useUserStore } from "../store/useUserStore";

import type { SessionUser } from "@/features/auth/services/current-user";

import {
  setAutoSyncEnabledInLocalStorage,
  loadWorkspaceSettingsFromLocalStorage,
} from "@/features/documents/services/workspace-settings";
import {
  setAllDocumentsSyncEnabled,
  startAllDocumentSyncWorkers,
} from "@/features/documents/services/document-sync";

export function AuthInitializer({ initialUser }: { initialUser: SessionUser | null }) {
  const setUser = useUserStore((state) => state.setUser);

  useEffect(() => {
    setUser(initialUser);

    const autoSyncEnabled = initialUser?.autoSyncEnabled ?? false;

    if (initialUser) {
      const localSettings = loadWorkspaceSettingsFromLocalStorage();

      if (localSettings.autoSyncEnabled !== autoSyncEnabled) {
        setAutoSyncEnabledInLocalStorage(autoSyncEnabled);
        setAllDocumentsSyncEnabled(autoSyncEnabled);
      }
    }

    // Back up pending documents of every type as soon as the user is signed in, not only
    // once an editor of that type is opened.
    startAllDocumentSyncWorkers({ enabled: Boolean(initialUser) && autoSyncEnabled });
  }, [initialUser, setUser]);

  return null;
}

"use client";

import { toast } from "sonner";

import type { DocumentType } from "@/features/documents/core/document-types";

import { toastSignInRequired } from "@/lib/sign-in";
import { useUserStore } from "@/store/useUserStore";
import { syncDocumentNow } from "@/features/documents/services/document-sync";

/** The toolbar's "Sync now": syncs the open document and reports the outcome in the status line. */
export function useSyncNowAction(
  type: DocumentType,
  documentId: string,
  onSetMessage: (message: string) => void,
) {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);

  return async function syncNow() {
    if (!isLoggedIn) {
      toastSignInRequired("Sign in to back up documents.");
      return;
    }

    onSetMessage("Syncing with cloud...");

    try {
      const result = await syncDocumentNow(type, documentId);

      if (!result.ok) {
        onSetMessage(`Sync failed: ${result.message}`);
        toast.error(result.message);
        return;
      }

      onSetMessage("Synced successfully");
      toast.success("Synced successfully");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Sync failed";
      onSetMessage(`Sync failed: ${errMsg}`);
      toast.error(errMsg);
    }
  };
}

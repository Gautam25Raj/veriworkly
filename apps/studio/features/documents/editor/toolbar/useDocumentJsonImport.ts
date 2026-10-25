"use client";

import { toast } from "sonner";
import { useCallback } from "react";
import { useRouter } from "next/navigation";

import type { BillingSummary } from "@/features/billing/types";
import type { DocumentType } from "@/features/documents/core/document-types";

import { getDocumentEditorPath } from "@/features/documents/core/routes";
import { importJsonFile } from "@/features/documents/services/import-service";
import { getSaveFailureMessage } from "@/features/documents/services/save-failure-message";
import { useUserStore } from "@/store/useUserStore";
import { fetchApiData } from "@/utils/fetchApiData";

/** Guests and free accounts keep one active document per type; payers have no limit. */
async function resolveDocumentsPerType(isLoggedIn: boolean): Promise<number | null> {
  if (!isLoggedIn) return 1;

  const billing = await fetchApiData<BillingSummary>("/billing/me", { method: "GET" });

  return billing.plan !== "FREE" || billing.entitlements.length > 0 ? null : 1;
}

/**
 * The "Import JSON" action for both editors.
 *
 * One hook because the menu item is one shared menu item: previously the resume created a
 * new document and navigated to it while the cover letter merged the file into whatever
 * was open, so the same command was safe in one editor and destructive in the other.
 *
 * The outcome is now identical for every type — a new document, saved and opened — and the
 * currently open document is never touched. Navigating remounts the destination editor,
 * which hydrates the imported document straight out of storage, so nothing needs to be
 * pushed into a store from here. A workspace backup restores every document it holds, and
 * opens the library when that is more than one.
 */
export function useDocumentJsonImport(type: DocumentType, onMessage: (message: string) => void) {
  const router = useRouter();
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);

  return useCallback(
    async function importJson(file: File | undefined) {
      if (!file) return;

      let outcome;

      try {
        outcome = await importJsonFile(type, file, () => resolveDocumentsPerType(isLoggedIn));
      } catch (error) {
        const failure =
          error instanceof SyntaxError || !(error instanceof Error)
            ? "Import failed. Please use a valid JSON file"
            : `Import failed. ${error.message}`;

        onMessage(failure);
        toast.error(failure);
        return;
      }

      if (outcome.kind === "document") {
        if (!outcome.saved.ok) {
          const failure = getSaveFailureMessage(outcome.saved.reason);

          onMessage(failure);
          toast.error(failure);

          return;
        }

        router.push(getDocumentEditorPath(type, outcome.document.id));

        // Toast as well as the status line: navigation remounts the editor, whose autosave
        // overwrites the status line within a few hundred milliseconds.
        onMessage("JSON imported successfully");
        toast.success("Imported as a new document");
        return;
      }

      const { imported, skipped, saved } = outcome;
      const parts = [`Restored ${imported.length} document${imported.length === 1 ? "" : "s"}`];

      if (skipped > 0) {
        parts.push(
          `${skipped} skipped: the free plan keeps one document of each type. Upgrade to restore the rest.`,
        );
      }

      if (!saved.ok) parts.push(getSaveFailureMessage(saved.reason));

      const message = parts.join(". ");

      onMessage(message);
      (saved.ok && imported.length > 0 ? toast.success : toast.error)(message);

      if (imported.length === 1) {
        router.push(getDocumentEditorPath(imported[0].type, imported[0].id));
      } else if (imported.length > 1) {
        router.push("/documents");
      }
    },
    [type, onMessage, router, isLoggedIn],
  );
}

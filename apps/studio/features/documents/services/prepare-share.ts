"use client";

import type { BaseDocument } from "@/features/documents/core/types";
import type { DocumentType } from "@/features/documents/core/document-types";

import { syncDocumentNow } from "@/features/documents/services/document-sync";
import { loadDocumentById } from "@/features/documents/services/document-workspace-service";

export type PrepareShareResult =
  | { ok: true; document: BaseDocument }
  | { ok: false; reason: "not-found" | "local-only" | "sync-failed"; message: string };

/**
 * A share link belongs to the cloud copy of a document, so the document is backed up first:
 * a share of something the server has not seen, or has only an older version of, fails or
 * goes stale. A document the user keeps on this device only is not uploaded unless they
 * say so (`backUp`), since that turns its sync back on.
 */
export async function prepareShareSnapshot(
  type: DocumentType,
  id: string,
  options: { backUp?: boolean } = {},
): Promise<PrepareShareResult> {
  const current = loadDocumentById(type, id);

  if (!current) {
    return {
      ok: false,
      reason: "not-found",
      message: "This document is not on this device. Refresh and try again.",
    };
  }

  if (current.sync.enabled === false && !options.backUp) {
    return {
      ok: false,
      reason: "local-only",
      message:
        "Back up this document to share it. It is kept on this device only, and a share link needs a copy in your account.",
    };
  }

  const synced = await syncDocumentNow(type, id);

  if (!synced.ok) {
    return {
      ok: false,
      reason: "sync-failed",
      message: `Back up this document to share it. ${synced.message}`,
    };
  }

  const document = loadDocumentById(type, id);

  if (!document) {
    return {
      ok: false,
      reason: "not-found",
      message: "This document is not on this device. Refresh and try again.",
    };
  }

  return { ok: true, document };
}

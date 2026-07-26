import type { DocumentType } from "@/features/documents/core/document-types";

/**
 * Single source of truth for the `veriworkly:docs:*` localStorage key scheme.
 * Every module that reads/writes document collections (workspace autosave,
 * the sync engine, the document library snapshot) must derive keys from here
 * so the key format can never drift between call sites.
 */
export const DOCUMENT_STORAGE_VERSION = "v2";
export const DOCUMENT_ACTIVE_STORAGE_KEY = `veriworkly:docs:${DOCUMENT_STORAGE_VERSION}:active`;

/**
 * Owned here (rather than by document-sync.ts) so document-workspace-service.ts
 * and document-sync.ts can both depend on this module without importing from
 * each other — avoids a circular dependency between the autosave and sync layers.
 */
export const DOCUMENT_STORAGE_UPDATED_EVENT = "veriworkly:docs-storage-updated";
export const DOCUMENT_SYNC_OUTBOX_UPDATED_EVENT = "veriworkly:sync-outbox-updated";

export function getDocumentCollectionKey(type: DocumentType): string {
  return `veriworkly:docs:${DOCUMENT_STORAGE_VERSION}:${type.toLowerCase()}`;
}

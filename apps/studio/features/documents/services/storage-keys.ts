import type { DocumentType } from "@/features/documents/core/document-types";

/**
 * Single source of truth for the `veriworkly:docs:*` localStorage key scheme.
 * Every module that reads/writes documents (workspace autosave, the sync engine,
 * the document library snapshot) must derive keys from here so the key format can
 * never drift between call sites.
 *
 * ## v3 layout: one key per document, plus a metadata index
 *
 * v2 stored every document of a type inside a single `…:resume` JSON blob. That made
 * every write O(total library size): each autosave had to `JSON.parse` + zod-validate
 * *every* document just to replace one of them, then re-`stringify` the whole set.
 * At 50 resumes that measured ~15ms of main-thread work every 300ms while typing, and
 * it made two tabs editing two different documents clobber each other, because both
 * were rewriting the same key.
 *
 * v3 splits it:
 *   - `…:v3:doc:<TYPE>:<id>` holds one document. Reads and writes are O(1).
 *   - `…:v3:index` holds only what list views need (title, template, updatedAt, sync,
 *     a short description) — no document bodies. The library and the sync worker's
 *     pending-scan read this instead of loading every document.
 *
 * `index.revision` increments on every write so cache keys can be a single integer
 * rather than a hash of the entire library.
 */
export const DOCUMENT_STORAGE_VERSION = "v3";
export const LEGACY_DOCUMENT_STORAGE_VERSION = "v2";

/**
 * Deliberately kept on the v2 name: it holds a `TYPE:id` pointer, not document data,
 * so there is nothing to migrate and rotating it would silently drop the user's
 * "last edited document" on upgrade.
 */
export const DOCUMENT_ACTIVE_STORAGE_KEY = `veriworkly:docs:${LEGACY_DOCUMENT_STORAGE_VERSION}:active`;

/**
 * Owned here (rather than by document-sync.ts) so document-workspace-service.ts
 * and document-sync.ts can both depend on this module without importing from
 * each other — avoids a circular dependency between the autosave and sync layers.
 */
export const DOCUMENT_STORAGE_UPDATED_EVENT = "veriworkly:docs-storage-updated";
export const DOCUMENT_SYNC_OUTBOX_UPDATED_EVENT = "veriworkly:sync-outbox-updated";

export const DOCUMENT_INDEX_STORAGE_KEY = `veriworkly:docs:${DOCUMENT_STORAGE_VERSION}:index`;

export function getDocumentKey(type: DocumentType, id: string): string {
  return `veriworkly:docs:${DOCUMENT_STORAGE_VERSION}:doc:${type.toLowerCase()}:${id}`;
}

export function getDocumentKeyPrefix(type: DocumentType): string {
  return `veriworkly:docs:${DOCUMENT_STORAGE_VERSION}:doc:${type.toLowerCase()}:`;
}

/** The pre-v3 single-blob-per-type key. Read once during migration, then removed. */
export function getLegacyDocumentCollectionKey(type: DocumentType): string {
  return `veriworkly:docs:${LEGACY_DOCUMENT_STORAGE_VERSION}:${type.toLowerCase()}`;
}

/**
 * @deprecated v2 collection key. Retained only so migration code and any stale
 * import keeps resolving; new call sites want {@link getDocumentKey}.
 */
export const getDocumentCollectionKey = getLegacyDocumentCollectionKey;

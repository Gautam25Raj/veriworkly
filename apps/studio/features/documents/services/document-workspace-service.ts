"use client";

import type { MasterProfileData } from "@veriworkly/profile-core";

import type { DocumentIndexEntry } from "@/types/document";
import type { DocumentType } from "@/features/documents/core/document-types";
import type { BaseDocument, DocumentMeta } from "@/features/documents/core/types";
import type { SaveDocumentOptions, SaveDocumentResult } from "./local-storage-service";

import { LocalStorageService } from "./local-storage-service";
import { DocumentApi, isDocumentApiError } from "./document-api";
import { SyncEngine, SYNC_STORAGE_KEYS } from "./sync-engine";
import {
  emptyDocumentIndex,
  invalidateDocumentIndexCache,
  listLocalStorageKeys,
  parkCorruptDocumentIndex,
  writeDocumentIndex,
} from "./document-index";
import {
  safeSetLocalStorageItem,
  type LocalStorageWriteResult,
} from "./storage/safe-local-storage";

import { getDocumentDefinition } from "@/features/documents/core/registry";
import { getMasterProfileForNewDocument } from "@/features/resume/services/master-profile";
import { withDocumentIdentity } from "@/features/documents/core/content-identity";
import { loadWorkspaceSettingsFromLocalStorage } from "@/features/documents/services/workspace-settings";
import { DOCUMENT_TYPES } from "@/features/documents/core/document-types";
import { MASTER_PROFILE_STORAGE_KEY } from "@/lib/constants";
import {
  DOCUMENT_ACTIVE_STORAGE_KEY,
  DOCUMENT_INDEX_STORAGE_KEY,
  DOCUMENT_MOVES_STORAGE_KEY,
  DOCUMENT_STORAGE_UPDATED_EVENT,
  getDocumentKey,
  getDocumentKeyPrefix,
  getLegacyDocumentCollectionKey,
} from "@/features/documents/services/storage-keys";

const ACTIVE_KEY = DOCUMENT_ACTIVE_STORAGE_KEY;
const pendingSaves = new Map<
  string,
  {
    document: BaseDocument;
    timer: number | null;
    onFlush?: (result: SaveDocumentResult) => void;
  }
>();
const storageInstances = new Map<DocumentType, LocalStorageService<BaseDocument>>();

function pendingSaveKey(type: DocumentType, id: string) {
  return `${type}:${id}`;
}

/** Fresh document id. Exported because import assigns one too — see import-service.ts. */
export function buildDocumentId(type: DocumentType): string {
  return `${type.toLowerCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function toIndexEntry(type: DocumentType, document: BaseDocument): DocumentIndexEntry {
  return {
    id: document.id,
    type,
    title: document.title,
    templateId: document.templateId,
    description: getDocumentDefinition(type).describe(document),
    updatedAt: document.updatedAt,
    sync: document.sync,
  };
}

/**
 * Single shared LocalStorageService instance per document type — reused by
 * both this module (editor autosave) and the sync engine (document-sync.ts)
 * so there is exactly one in-process writer per type instead of two
 * independently-instantiated clients racing against the same storage keys.
 */
export function getWorkspaceStorage(type: DocumentType): LocalStorageService<BaseDocument> {
  let instance = storageInstances.get(type);

  if (!instance) {
    instance = new LocalStorageService<BaseDocument>({
      scope: type,
      documentKey: (id) => getDocumentKey(type, id),
      documentKeyPrefix: getDocumentKeyPrefix(type),
      legacyCollectionKey: getLegacyDocumentCollectionKey(type),
      activeIdKey: ACTIVE_KEY,
      activeIdScope: type,
      updatedEventName: DOCUMENT_STORAGE_UPDATED_EVENT,
      parseItem: getDocumentDefinition(type).parse,
      toIndexEntry: (document) => toIndexEntry(type, document),
      repairIndex: rebuildDocumentIndex,
      cloudContentRevision: (id) => SyncEngine.getCloudContentRevision(id, type),
      resolveMovedId: (id) => resolveMovedDocumentId(type, id),
    });
    storageInstances.set(type, instance);
  }

  return instance;
}

/**
 * Rebuilds the shared index from every type's document body keys after it was found
 * unparseable. The corrupt value is parked under `<index key>:corrupt` first.
 */
function rebuildDocumentIndex(): LocalStorageWriteResult {
  const corrupt = window.localStorage.getItem(DOCUMENT_INDEX_STORAGE_KEY);
  const index = emptyDocumentIndex();

  for (const type of DOCUMENT_TYPES) {
    Object.assign(index.items, getWorkspaceStorage(type).entriesFromBodies());
  }

  // The rebuild overwrites the index key in place, so it needs no extra room; the copy of the
  // corrupt value does, and is skipped under quota rather than blocking every later save.
  const written = writeDocumentIndex(index);
  if (written.ok && corrupt !== null) parkCorruptDocumentIndex(corrupt);

  return written;
}

/**
 * Runs the one-time storage migration and index repair for every type. Both write, so they
 * run here — from an effect or a subscription — and never from a render's snapshot read.
 */
export function prepareWorkspaceStorage() {
  for (const type of DOCUMENT_TYPES) getWorkspaceStorage(type).prepare();
}

function clearPendingSave(type: DocumentType, id: string) {
  if (typeof window === "undefined") return;

  const key = pendingSaveKey(type, id);
  const pending = pendingSaves.get(key);

  if (!pending) return;

  if (pending.timer !== null) {
    window.clearTimeout(pending.timer);
  }

  pendingSaves.delete(key);
}

/**
 * Document metadata for list views. Reads the storage index only — it never loads or
 * validates a document body, so its cost does not grow with document size.
 */
export function listDocuments(type?: DocumentType): DocumentMeta[] {
  const selectedTypes: DocumentType[] = type ? [type] : [...DOCUMENT_TYPES];

  return selectedTypes
    .flatMap((t) => getWorkspaceStorage(t).listIndex())
    .map((entry) => ({
      id: entry.id,
      type: entry.type as DocumentType,
      title: entry.title,
      templateId: entry.templateId,
      updatedAt: entry.updatedAt,
      sync: entry.sync,
    }))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/** Index entries including the card description, for the document library. */
export function listDocumentIndexEntries(type?: DocumentType): DocumentIndexEntry[] {
  const selectedTypes: DocumentType[] = type ? [type] : [...DOCUMENT_TYPES];

  return selectedTypes
    .flatMap((t) => getWorkspaceStorage(t).listIndex())
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/** Monotonic storage revision, for cache keys. Cheap — see document-index.ts. */
export function getWorkspaceRevision(): number {
  return Math.max(...DOCUMENT_TYPES.map((type) => getWorkspaceStorage(type).getRevision()), 0);
}

export function loadDocumentById(type: DocumentType, id: string): BaseDocument | null {
  return getWorkspaceStorage(type).loadById(id);
}

function persistDocument(document: BaseDocument): SaveDocumentResult {
  return getWorkspaceStorage(document.type).persist(document);
}

export function saveDocument(
  document: BaseDocument,
  options?: SaveDocumentOptions,
): SaveDocumentResult {
  if (typeof window === "undefined") return { ok: true, queued: false };

  if (options?.flush) {
    clearPendingSave(document.type, document.id);
    return persistDocument(document);
  }

  const debounceMs = Math.max(0, options?.debounceMs ?? 0);

  if (debounceMs > 0) {
    const key = pendingSaveKey(document.type, document.id);

    clearPendingSave(document.type, document.id);

    const timer = window.setTimeout(() => {
      const pending = pendingSaves.get(key);
      pendingSaves.delete(key);

      if (!pending) return;

      // Persist unconditionally, then report: `onFlush?.(persistDocument(…))` would skip
      // the write entirely whenever no callback was supplied, because an optional call
      // does not evaluate its arguments.
      const result = persistDocument(pending.document);

      // The write's own result — the caller's `{ queued: true }` said nothing about it.
      pending.onFlush?.(result);
    }, debounceMs);

    pendingSaves.set(key, { document, timer, onFlush: options?.onFlush });
    return { ok: true, queued: true };
  }

  return persistDocument(document);
}

/**
 * Persists every pending debounced save right now, synchronously.
 *
 * Autosave debounces at 300ms via a `setTimeout` held in {@link pendingSaves}. Nothing
 * used to force that timer to run early, so closing the tab, reloading, or backgrounding
 * on mobile (where the browser may discard the page outright) dropped whatever was typed
 * in the last 300ms — the moment it hurts most, since users finish a sentence and leave.
 *
 * Deliberately synchronous: `localStorage.setItem` already is, and an unload path must not
 * await anything. Each pending entry still reports through its own `onFlush`, so an editor
 * finds out about a quota failure here exactly as it would have on the timer.
 */
export function flushPendingSaves(type?: DocumentType): void {
  if (typeof window === "undefined") return;

  for (const [key, pending] of [...pendingSaves.entries()]) {
    if (type && !key.startsWith(`${type}:`)) continue;

    pendingSaves.delete(key);

    if (pending.timer !== null) window.clearTimeout(pending.timer);

    pending.onFlush?.(persistDocument(pending.document));
  }
}

/**
 * Persists one document's pending debounced save now, if it has one. The sync layer calls
 * this before it decides a document is clean, so the last 300ms of typing count.
 */
export function flushPendingSave(type: DocumentType, id: string): void {
  if (typeof window === "undefined") return;

  const key = pendingSaveKey(type, id);
  const pending = pendingSaves.get(key);

  if (!pending) return;

  pendingSaves.delete(key);
  if (pending.timer !== null) window.clearTimeout(pending.timer);

  pending.onFlush?.(persistDocument(pending.document));
}

function readDocumentMoves(): Record<string, string> {
  const raw = window.localStorage.getItem(DOCUMENT_MOVES_STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The id `id` was moved to, following every later move; null when it never moved. */
function resolveMovedDocumentId(type: DocumentType, id: string): string | null {
  if (typeof window === "undefined") return null;

  const moves = readDocumentMoves();
  let current = id;

  // Bounded: a corrupt map must not loop.
  for (let hop = 0; hop < 16; hop += 1) {
    const next = moves[`${type}:${current}`];
    if (!next) break;
    current = next;
  }

  return current === id ? null : current;
}

/**
 * Moves a document to a fresh id, unlinked from the cloud and waiting to sync.
 *
 * For a document whose id the server will never accept again (it was deleted in the cloud):
 * the content is kept, the old id is removed, and the new document is created as new.
 * Returns the new document, or null when it could not be written (the old one is then kept).
 */
export function rekeyDocument(type: DocumentType, id: string): BaseDocument | null {
  flushPendingSave(type, id);

  const current = loadDocumentById(type, id);
  if (!current) return null;

  const nextId = buildDocumentId(type);
  const sync: BaseDocument["sync"] = {
    ...current.sync,
    enabled: true,
    status: "pending",
    cloudDocumentId: null,
    lastSyncedAt: null,
    revision: 1,
  };

  const next: BaseDocument = {
    ...current,
    id: nextId,
    sync,
    content: withDocumentIdentity(current.content, { id: nextId, sync }),
  };

  if (!persistDocument(next).ok) return null;

  // Recorded before the old id goes, so no editor (in any tab) still holding it can save
  // into the gap: its saves are redirected to the new id from here on.
  const moves = readDocumentMoves();
  moves[`${type}:${id}`] = nextId;

  if (
    !safeSetLocalStorageItem(window.localStorage, DOCUMENT_MOVES_STORAGE_KEY, JSON.stringify(moves))
      .ok
  ) {
    deleteDocument(type, nextId);
    return null;
  }

  deleteDocument(type, id);
  SyncEngine.setSyncOptedOut(id, false, type);

  return next;
}

/**
 * Builds, persists, and activates a new document.
 *
 * `master` is the profile to seed from. Synchronous on purpose — the registry's
 * `createDefault` cannot await — so callers that want the *database* copy resolve it first;
 * see {@link createDocumentFromMasterProfile}.
 */
export type CreatedDocument = BaseDocument & {
  /** Whether the new document reached storage. Never navigate to it when this failed. */
  saveResult: SaveDocumentResult;
};

export function createDocument(type: DocumentType, master?: MasterProfileData): CreatedDocument {
  const id = buildDocumentId(type);
  const defaultDoc = getDocumentDefinition(type).createDefault(id, master);
  const workspaceSettings = loadWorkspaceSettingsFromLocalStorage();

  const sync: BaseDocument["sync"] = {
    ...defaultDoc.sync,
    enabled: workspaceSettings.autoSyncEnabled,
    status: workspaceSettings.autoSyncEnabled ? "pending" : "local-only",
  };

  const doc: BaseDocument = {
    ...defaultDoc,
    sync,
    // The workspace setting has to reach the content's own sync copy too, or the resume
    // editor's first autosave reverts it — see withDocumentIdentity.
    content: withDocumentIdentity(defaultDoc.content, { id, sync }),
  };

  const saveResult = saveDocument(doc);
  if (saveResult.ok) setActiveDocument(type, id);

  return { ...doc, saveResult };
}

/**
 * `createDocument`, with the master profile fetched first.
 *
 * The entry point every user-facing "new document" action should use. The profile lives in
 * the database, so reaching it means an await; doing that here rather than in each of the
 * four call sites is what stops one of them quietly going back to demo data — which is the
 * bug this whole path exists to fix. Resolution never throws and never blocks: with no
 * profile, offline, or signed out, the document is still created from each type's own
 * fallback content.
 */
export async function createDocumentFromMasterProfile(type: DocumentType) {
  return createDocument(type, await getMasterProfileForNewDocument());
}

export function deleteDocument(type: DocumentType, id: string): LocalStorageWriteResult {
  clearPendingSave(type, id);

  const result = getWorkspaceStorage(type).delete(id);
  if (result.ok) SyncEngine.removeOutboxItem(id, type);

  return result;
}

/**
 * Deletes a document from the cloud (when it is linked there) and then from this device.
 *
 * Every user-facing delete goes through here. Deleting only the local copy left the cloud row
 * counting toward the free-tier limit and its public share link still serving. A 404 means
 * the cloud copy is already gone, so the local delete goes ahead; any other failure throws
 * with the server's message and leaves the local copy in place, still linked, so the delete
 * can be retried.
 */
export async function deleteDocumentEverywhere(
  type: DocumentType,
  doc: { id: string },
): Promise<void> {
  // Storage owns the sync block: an editor's copy can predate the first successful sync.
  const linked = Boolean(loadDocumentById(type, doc.id)?.sync.cloudDocumentId);

  if (linked) {
    try {
      await DocumentApi.delete(doc.id);
    } catch (error) {
      if (!isDocumentApiError(error, 404)) throw error;
    }
  }

  const result = deleteDocument(type, doc.id);

  if (!result.ok) {
    throw new Error(
      result.reason === "quota-exceeded"
        ? "The document was deleted from the cloud, but this device's storage is full and the local copy could not be removed."
        : "The local copy could not be removed. Please try again.",
    );
  }
}

/** Removes every document of a type, its index entries, and the active-id pointer. */
export function clearDocuments(type: DocumentType): LocalStorageWriteResult {
  for (const key of [...pendingSaves.keys()]) {
    if (key.startsWith(`${type}:`)) clearPendingSave(type, key.slice(type.length + 1));
  }

  return getWorkspaceStorage(type).clear();
}

const WORKSPACE_KEY_PREFIXES = [
  "veriworkly:docs:",
  "veriworkly:cloud-hydrate-meta:",
  MASTER_PROFILE_STORAGE_KEY,
  ...Object.values(SYNC_STORAGE_KEYS),
];

/**
 * Removes everything this device holds about the signed-in user's work: every document body
 * and index (parked `:corrupt` copies included), the sync outbox, telemetry, opt-outs and
 * hydrate cursors, and the cached master profile. For sign-out and account deletion, so the
 * next person on a shared device starts empty. Workspace preferences are kept.
 */
export function clearWorkspaceStorage(): void {
  if (typeof window === "undefined") return;

  for (const [key, pending] of [...pendingSaves.entries()]) {
    if (pending.timer !== null) window.clearTimeout(pending.timer);
    pendingSaves.delete(key);
  }

  // Index-driven first, so storage without key enumeration is still cleared of documents.
  for (const type of DOCUMENT_TYPES) getWorkspaceStorage(type).clear();

  for (const key of listLocalStorageKeys()) {
    if (WORKSPACE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }

  window.localStorage.removeItem(DOCUMENT_ACTIVE_STORAGE_KEY);
  invalidateDocumentIndexCache();
  window.dispatchEvent(new Event(DOCUMENT_STORAGE_UPDATED_EVENT));
}

export function setActiveDocument(type: DocumentType, id: string) {
  if (typeof window === "undefined") return;

  getWorkspaceStorage(type).setActiveId(id);
}

/**
 * Every document body of a type. O(library size) — only for callers that genuinely
 * need content (bulk sync-flag updates, export-all). List views want
 * {@link listDocumentIndexEntries} instead.
 */
export function listFullDocuments(type: DocumentType): BaseDocument[] {
  return getWorkspaceStorage(type)
    .list()
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

"use client";

import type { DocumentIndexEntry } from "@/types/document";
import type { DocumentType } from "@/features/documents/core/document-types";
import type { BaseDocument, DocumentMeta } from "@/features/documents/core/types";
import type { SaveDocumentOptions, SaveDocumentResult } from "./local-storage-service";

import { LocalStorageService } from "./local-storage-service";

import { getDocumentDefinition } from "@/features/documents/core/registry";
import { loadWorkspaceSettingsFromLocalStorage } from "@/features/documents/services/workspace-settings";
import { DOCUMENT_TYPES } from "@/features/documents/core/document-types";
import {
  DOCUMENT_ACTIVE_STORAGE_KEY,
  DOCUMENT_STORAGE_UPDATED_EVENT,
  getDocumentKey,
  getDocumentKeyPrefix,
  getLegacyDocumentCollectionKey,
} from "@/features/documents/services/storage-keys";

const ACTIVE_KEY = DOCUMENT_ACTIVE_STORAGE_KEY;
const pendingSaves = new Map<string, { document: BaseDocument; timer: number | null }>();
const storageInstances = new Map<DocumentType, LocalStorageService<BaseDocument>>();

function pendingSaveKey(type: DocumentType, id: string) {
  return `${type}:${id}`;
}

function buildId(type: DocumentType): string {
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
    });
    storageInstances.set(type, instance);
  }

  return instance;
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

      if (pending) persistDocument(pending.document);
    }, debounceMs);

    pendingSaves.set(key, { document, timer });
    return { ok: true, queued: true };
  }

  return persistDocument(document);
}

export function createDocument(type: DocumentType) {
  const id = buildId(type);
  const defaultDoc = getDocumentDefinition(type).createDefault(id);
  const workspaceSettings = loadWorkspaceSettingsFromLocalStorage();
  const doc: BaseDocument = {
    ...defaultDoc,
    sync: {
      ...defaultDoc.sync,
      enabled: workspaceSettings.autoSyncEnabled,
      status: workspaceSettings.autoSyncEnabled ? "pending" : "local-only",
    },
  };

  saveDocument(doc);
  setActiveDocument(type, id);

  return doc;
}

export function deleteDocument(type: DocumentType, id: string) {
  clearPendingSave(type, id);

  getWorkspaceStorage(type).delete(id);
}

/** Removes every document of a type, its index entries, and the active-id pointer. */
export function clearDocuments(type: DocumentType) {
  for (const key of [...pendingSaves.keys()]) {
    if (key.startsWith(`${type}:`)) clearPendingSave(type, key.slice(type.length + 1));
  }

  getWorkspaceStorage(type).clear();
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

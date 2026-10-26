"use client";

import type { DocumentIndex } from "@/types/document";

import {
  safeSetLocalStorageItem,
  type LocalStorageWriteResult,
} from "./storage/safe-local-storage";
import { DOCUMENT_INDEX_STORAGE_KEY } from "./storage-keys";

const DOCUMENT_INDEX_VERSION = 3;

/**
 * Mirrors `index.revision` in memory so callers can read it without a localStorage
 * round trip. `-1` means "not read yet"; the first {@link readDocumentIndex} fills it.
 */
let cachedRevision = -1;

/**
 * Set when the last read found the index unparseable. Reads stay pure (the library reads the
 * index from a useSyncExternalStore getSnapshot, which must not write); the storage write
 * paths check this and rebuild the index from the document body keys before writing over it.
 */
let lastReadWasCorrupt = false;

export function emptyDocumentIndex(): DocumentIndex {
  return { version: DOCUMENT_INDEX_VERSION, revision: 0, items: {} };
}

function isBrowser() {
  return typeof window !== "undefined";
}

/**
 * Reads the shared document index without writing anything.
 *
 * A throw here would propagate into autosave and the fire-and-forget sync worker, so a bad
 * value reads as empty and is flagged for {@link wasDocumentIndexCorrupt}; the documents
 * themselves live under separate keys and the index is rebuilt from them.
 */
export function readDocumentIndex(): DocumentIndex {
  if (!isBrowser()) return emptyDocumentIndex();

  const raw = window.localStorage.getItem(DOCUMENT_INDEX_STORAGE_KEY);
  lastReadWasCorrupt = false;

  if (!raw) {
    cachedRevision = 0;
    return emptyDocumentIndex();
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      lastReadWasCorrupt = true;
      cachedRevision = 0;
      return emptyDocumentIndex();
    }

    const candidate = parsed as Partial<DocumentIndex>;
    const items =
      typeof candidate.items === "object" && candidate.items !== null ? candidate.items : {};
    const revision = typeof candidate.revision === "number" ? candidate.revision : 0;

    cachedRevision = revision;

    return {
      version: typeof candidate.version === "number" ? candidate.version : DOCUMENT_INDEX_VERSION,
      revision,
      items: items as DocumentIndex["items"],
    };
  } catch {
    lastReadWasCorrupt = true;
    cachedRevision = 0;
    return emptyDocumentIndex();
  }
}

/** Whether the most recent {@link readDocumentIndex} found an unparseable index. */
export function wasDocumentIndexCorrupt(): boolean {
  return lastReadWasCorrupt;
}

/**
 * Keeps an unparseable index value aside so whatever it held can still be inspected. The
 * rebuild that replaces it needs each document type's parser, which this module does not
 * know; see `rebuildDocumentIndex` in document-workspace-service.ts.
 */
export function parkCorruptDocumentIndex(raw: string): LocalStorageWriteResult {
  if (!isBrowser()) return { ok: true };

  return safeSetLocalStorageItem(window.localStorage, `${DOCUMENT_INDEX_STORAGE_KEY}:corrupt`, raw);
}

/** Every localStorage key, for prefix scans (index rebuild, workspace clear). */
export function listLocalStorageKeys(): string[] {
  if (!isBrowser()) return [];

  const storage = window.localStorage;
  const keys: string[] = [];

  for (let index = 0; index < (storage.length ?? 0); index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }

  return keys;
}

/** Writes the index, bumping `revision` so revision-keyed caches invalidate. */
export function writeDocumentIndex(index: DocumentIndex): LocalStorageWriteResult {
  if (!isBrowser()) return { ok: true };

  const nextRevision = index.revision + 1;

  const result = safeSetLocalStorageItem(
    window.localStorage,
    DOCUMENT_INDEX_STORAGE_KEY,
    JSON.stringify({ ...index, version: DOCUMENT_INDEX_VERSION, revision: nextRevision }),
  );

  if (!result.ok) return result;

  index.revision = nextRevision;
  cachedRevision = nextRevision;
  lastReadWasCorrupt = false;

  return result;
}

/**
 * Current index revision without re-parsing storage when it is already known, so the
 * document library's cache key is one integer rather than the library's raw JSON.
 */
export function getDocumentIndexRevision(): number {
  if (cachedRevision >= 0) return cachedRevision;
  return readDocumentIndex().revision;
}

/** Test/`storage`-event hook: forces the next revision read to hit localStorage. */
export function invalidateDocumentIndexCache() {
  cachedRevision = -1;
}

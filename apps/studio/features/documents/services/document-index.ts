"use client";

import type { DocumentIndex } from "@/types/document";

import {
  safeSetLocalStorageItem,
  type LocalStorageWriteResult,
} from "./storage/safe-local-storage";
import { DOCUMENT_INDEX_STORAGE_KEY } from "./storage-keys";

export { DOCUMENT_INDEX_STORAGE_KEY };

export const DOCUMENT_INDEX_VERSION = 3;

export type DocumentIndexRevisionListener = (revision: number) => void;

const revisionListeners = new Set<DocumentIndexRevisionListener>();

/**
 * Mirrors `index.revision` in memory so callers can read it without a localStorage
 * round trip. `-1` means "not read yet"; the first {@link readDocumentIndex} fills it.
 */
let cachedRevision = -1;

function emptyIndex(): DocumentIndex {
  return { version: DOCUMENT_INDEX_VERSION, revision: 0, items: {} };
}

function isBrowser() {
  return typeof window !== "undefined";
}

/**
 * Reads the shared document index, self-healing on corrupted JSON.
 *
 * A throw here would propagate into autosave and the fire-and-forget sync worker,
 * so a bad value is cleared and treated as empty rather than surfaced — the documents
 * themselves live under separate keys and are recovered by the index rebuild below.
 */
export function readDocumentIndex(): DocumentIndex {
  if (!isBrowser()) return emptyIndex();

  const raw = window.localStorage.getItem(DOCUMENT_INDEX_STORAGE_KEY);

  if (!raw) {
    cachedRevision = 0;
    return emptyIndex();
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      window.localStorage.removeItem(DOCUMENT_INDEX_STORAGE_KEY);
      cachedRevision = 0;
      return emptyIndex();
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
    window.localStorage.removeItem(DOCUMENT_INDEX_STORAGE_KEY);
    cachedRevision = 0;
    return emptyIndex();
  }
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

  for (const listener of revisionListeners) listener(nextRevision);

  return result;
}

/**
 * Current index revision without re-parsing storage when it is already known.
 *
 * This is the whole point of the revision counter: the document library's cache key
 * used to be the concatenated raw JSON of every collection (~563KB at 50 documents,
 * rebuilt on every React render). Now it is one integer.
 */
export function getDocumentIndexRevision(): number {
  if (cachedRevision >= 0) return cachedRevision;
  return readDocumentIndex().revision;
}

/**
 * Notifies on same-tab index writes. Cross-tab changes still arrive via the native
 * `storage` event; this covers the same-tab case without a storage round trip.
 */
export function subscribeToDocumentIndexRevision(listener: DocumentIndexRevisionListener) {
  revisionListeners.add(listener);
  return () => revisionListeners.delete(listener);
}

/** Test/`storage`-event hook: forces the next revision read to hit localStorage. */
export function invalidateDocumentIndexCache() {
  cachedRevision = -1;
}

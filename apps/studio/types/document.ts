import type { SyncStatus } from "@/features/documents/services/sync-engine";

export interface DocumentSyncState {
  enabled: boolean;
  status: SyncStatus;
  cloudDocumentId: string | null;
  lastSyncedAt: string | null;
  revision: number;
}

export interface BaseDocumentData {
  id: string;
  updatedAt: string;
  sync: DocumentSyncState;
  templateId: string;
}

export interface DocumentCollection<T extends BaseDocumentData> {
  version: number;
  items: Record<string, T>;
}

/**
 * The list-view projection of a document, held in the shared index key.
 *
 * Everything the document library, workspace search, and the sync worker's
 * pending-scan need — and nothing else. Keeping bodies out of here is what makes
 * those paths O(1) in library size instead of loading and validating every
 * document to render a list of cards.
 */
export interface DocumentIndexEntry {
  id: string;
  type: string;
  title: string;
  templateId: string;
  /** Card subtitle, e.g. a resume's role or a cover letter's "Job at Company". */
  description: string;
  updatedAt: string;
  sync: DocumentSyncState;
}

export interface DocumentIndex {
  version: number;
  /** Increments on every write. Cache keys read this instead of hashing the library. */
  revision: number;
  /** Keyed by `TYPE:id` so one index can span every document type. */
  items: Record<string, DocumentIndexEntry>;
}

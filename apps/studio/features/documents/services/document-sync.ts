"use client";

import type { BaseDocument } from "@/features/documents/core/types";

import type { SaveDocumentResult } from "./local-storage-service";

import { getDocumentDefinition } from "@/features/documents/core/registry";
import { DOCUMENT_TYPES, type DocumentType } from "@/features/documents/core/document-types";
import { getWorkspaceStorage } from "@/features/documents/services/document-workspace-service";

import {
  type SyncResult,
  type SyncWorkerOptions,
  DocumentSyncService,
} from "./document-sync-service";
import { SyncEngine, type OutboxItem, type SyncTelemetry } from "./sync-engine";
import {
  DOCUMENT_STORAGE_UPDATED_EVENT,
  DOCUMENT_SYNC_OUTBOX_UPDATED_EVENT,
} from "./storage-keys";

export type { SyncResult, SyncTelemetry, SyncWorkerOptions };
export { DOCUMENT_STORAGE_UPDATED_EVENT, DOCUMENT_SYNC_OUTBOX_UPDATED_EVENT };

type SharedDocumentSyncService = {
  syncNow(id: string): Promise<SyncResult>;
  keepLocalOnly(id: string): SyncResult;
  resolveConflictUseLocal(id: string): Promise<SyncResult>;
  resolveConflictUseCloud(id: string): Promise<SyncResult>;
  startWorker(options: SyncWorkerOptions): void;
  syncAllPending(): Promise<SyncResult[]>;
  setAllSyncEnabled(enabled: boolean): SaveDocumentResult;
  hydrateById(id: string, force?: boolean): Promise<SyncResult>;
  hydrate(options?: { force?: boolean; minIntervalMs?: number }): Promise<SyncResult>;
};

function createGenericDocumentSyncService(type: DocumentType) {
  // Reuse the exact same LocalStorageService instance the editor autosave path
  // uses (document-workspace-service.ts) instead of instantiating a second,
  // independent client against the same storage keys. See storage-keys.ts.
  const storage = getWorkspaceStorage(type);

  return new DocumentSyncService<BaseDocument>({
    documentType: type,
    localStorage: storage,
    updatedEventName: DOCUMENT_STORAGE_UPDATED_EVENT,
    parseItem: (input) => getDocumentDefinition(type).parse(input),
    getDocumentTitle: (item) => item.title,
  });
}

function createDocumentSyncService(type: DocumentType): SharedDocumentSyncService {
  return createGenericDocumentSyncService(type);
}

const documentSyncServices = Object.fromEntries(
  DOCUMENT_TYPES.map((type) => [type, createDocumentSyncService(type)]),
) as Record<DocumentType, SharedDocumentSyncService>;

function getService(type: DocumentType) {
  return documentSyncServices[type];
}

export async function syncDocumentNow(type: DocumentType, id: string): Promise<SyncResult> {
  return getService(type).syncNow(id);
}

export function keepDocumentLocalOnly(type: DocumentType, id: string): SyncResult {
  return getService(type).keepLocalOnly(id);
}

export async function resolveDocumentConflictUseLocal(type: DocumentType, id: string) {
  return getService(type).resolveConflictUseLocal(id);
}

export async function resolveDocumentConflictUseCloud(type: DocumentType, id: string) {
  return getService(type).resolveConflictUseCloud(id);
}

export function startDocumentSyncWorker(type: DocumentType, options: SyncWorkerOptions) {
  getService(type).startWorker(options);
}

export async function syncAllPendingDocuments(type?: DocumentType): Promise<SyncResult[]> {
  if (type) return getService(type).syncAllPending();

  const results = await Promise.all(
    DOCUMENT_TYPES.map((documentType) => syncAllPendingDocuments(documentType)),
  );

  return results.flat();
}

export function setDocumentSyncEnabled(type: DocumentType, enabled: boolean) {
  return getService(type).setAllSyncEnabled(enabled);
}

export function setAllDocumentsSyncEnabled(enabled: boolean): SaveDocumentResult {
  let lastResult: SaveDocumentResult = { ok: true, queued: false };

  for (const type of DOCUMENT_TYPES) {
    lastResult = setDocumentSyncEnabled(type, enabled);
    if (!lastResult.ok) return lastResult;
  }

  return lastResult;
}

export async function hydrateCloudDocumentByIdToLocalStorage(
  type: DocumentType,
  id: string,
  force?: boolean,
) {
  return getService(type).hydrateById(id, force);
}

export async function hydrateCloudDocumentsToLocalStorage(
  type: DocumentType,
  options?: {
    force?: boolean;
    minIntervalMs?: number;
  },
) {
  return getService(type).hydrate(options);
}

export function getDocumentSyncTelemetry(type: DocumentType, id: string): SyncTelemetry {
  return SyncEngine.getTelemetry(id, type);
}

export function getDocumentSyncTelemetryByDocs(
  docs: Array<{ id: string; type: DocumentType }>,
): Record<string, SyncTelemetry> {
  return docs.reduce<Record<string, SyncTelemetry>>((result, doc) => {
    result[doc.id] = getDocumentSyncTelemetry(doc.type, doc.id);
    return result;
  }, {});
}

export function getWorkspaceSyncTelemetry(type?: DocumentType) {
  const outbox: Record<string, OutboxItem> = type
    ? SyncEngine.getOutbox(type)
    : DOCUMENT_TYPES.reduce<Record<string, OutboxItem>>(
        (result, documentType) => ({
          ...result,
          ...SyncEngine.getOutbox(documentType),
        }),
        {},
      );

  const values = Object.values(outbox);

  const maxAttempt = Math.max(...values.map((i) => i.updatedAt), 0);

  return {
    lastAttemptAt: maxAttempt ? new Date(maxAttempt).toISOString() : null,
    lastSuccessAt: null,
  };
}

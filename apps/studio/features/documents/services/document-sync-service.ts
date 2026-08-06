"use client";

import { BaseDocumentData } from "@/types/document";
import { SyncEngine, type SyncStatus } from "./sync-engine";
import { DocumentApi, type CloudDocument, type DocumentType } from "./document-api";
import { LocalStorageService, type SaveDocumentResult } from "./local-storage-service";

/**
 * Max concurrent document syncs. Browsers allow ~6 connections per host, so going
 * wider just queues requests until they time out while holding every document in the
 * "syncing" state.
 */
const SYNC_CONCURRENCY = 4;

export type SyncResult = {
  ok: boolean;
  message: string;
  reason?: "conflict" | "auth" | "forbidden" | "not-found" | "network" | "unknown";
};

export interface SyncNowOptions {
  force?: boolean;
}

export interface SyncWorkerOptions {
  enabled: boolean;
  idleDelayMs?: number;
}

export interface HydrateOptions {
  force?: boolean;
  minIntervalMs?: number;
}

export interface DocumentSyncConfig<T extends BaseDocumentData> {
  documentType: DocumentType;
  localStorage: LocalStorageService<T>;
  updatedEventName: string;
  parseItem: (input: unknown) => T | null;
  getDocumentTitle: (item: T) => string;
}

export class DocumentSyncService<T extends BaseDocumentData> {
  private workerTickTimer: number | null = null;
  private workerEnabled = false;
  private listenersAttached = false;
  private workerTickInFlight = false;
  private workerIdleDelayMs = 12_000;
  private cloudHydrateMetaKey: string;

  private readonly DEFAULT_MIN_HYDRATE_INTERVAL_MS = 2 * 60 * 1000;

  constructor(private config: DocumentSyncConfig<T>) {
    this.cloudHydrateMetaKey = `veriworkly:cloud-hydrate-meta:${config.documentType.toLowerCase()}`;
  }

  private isBrowser() {
    return typeof window !== "undefined";
  }

  private toTimestamp(value: string | null | undefined) {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private scheduleWorkerTick(delayMs: number) {
    if (!this.isBrowser()) return;

    if (this.workerTickTimer !== null) window.clearTimeout(this.workerTickTimer);

    this.workerTickTimer = window.setTimeout(
      () => {
        this.workerTickTimer = null;
        void this.runWorkerTick();
      },
      Math.max(0, delayMs),
    );
  }

  private getNextDueOutboxItem() {
    const now = Date.now();

    const outbox = SyncEngine.getOutbox(this.config.documentType);
    const items = Object.values(outbox)
      .filter((item) => item.state !== "conflicted")
      .sort((left, right) => left.nextAttemptAt - right.nextAttemptAt);

    if (items.length === 0) return null;

    const first = items[0];

    return {
      item: first,
      delayMs: Math.max(0, first.nextAttemptAt - now),
    };
  }

  private async runWorkerTick() {
    if (!this.workerEnabled || this.workerTickInFlight) return;

    const due = this.getNextDueOutboxItem();

    if (!due) return;

    if (due.delayMs > 0) {
      this.scheduleWorkerTick(due.delayMs);
      return;
    }

    this.workerTickInFlight = true;

    try {
      const item = this.config.localStorage.loadById(due.item.id);

      if (item && item.sync.enabled) {
        await this.syncNow(due.item.id);
      } else {
        SyncEngine.removeOutboxItem(due.item.id, this.config.documentType);
      }
    } finally {
      this.workerTickInFlight = false;
      const nextDue = this.getNextDueOutboxItem();
      if (this.workerEnabled && nextDue) this.scheduleWorkerTick(nextDue.delayMs);
    }
  }

  private attachWorkerListeners() {
    if (!this.isBrowser() || this.listenersAttached) return;

    const requeueAndRun = (event: Event) => {
      if (!this.workerEnabled) return;

      const isManualSave = event.type === this.config.updatedEventName;
      this.queuePendingForSync(isManualSave);

      const nextDue = this.getNextDueOutboxItem();

      if (nextDue) this.scheduleWorkerTick(nextDue.delayMs);
    };

    window.addEventListener(this.config.updatedEventName, requeueAndRun);
    window.addEventListener("online", requeueAndRun);
    window.addEventListener("focus", requeueAndRun);
    window.addEventListener("visibilitychange", requeueAndRun);

    this.listenersAttached = true;
  }

  /**
   * Ids of documents waiting to sync.
   *
   * Reads the storage index, not document bodies: `sync.enabled`/`sync.status` are both
   * mirrored there. This runs on every storage-updated event (i.e. on every autosave),
   * so loading and re-validating the whole library here was a per-keystroke cost.
   */
  private listPendingIds(): string[] {
    return this.config.localStorage
      .listIndex()
      .filter((entry) => entry.sync.enabled && entry.sync.status === "pending")
      .map((entry) => entry.id);
  }

  private queuePendingForSync(forceImmediate = false) {
    for (const id of this.listPendingIds()) {
      if (forceImmediate) {
        SyncEngine.upsertOutboxItem(id, { nextAttemptAt: Date.now() }, this.config.documentType);
      } else {
        SyncEngine.upsertOutboxItem(id, {}, this.config.documentType);
      }
    }
  }

  startWorker(options: SyncWorkerOptions) {
    this.workerEnabled = options.enabled;
    this.workerIdleDelayMs = Math.max(2_000, options.idleDelayMs ?? 12_000);
    this.attachWorkerListeners();

    if (this.workerEnabled) {
      this.queuePendingForSync(false);
      const nextDue = this.getNextDueOutboxItem();
      if (nextDue) this.scheduleWorkerTick(nextDue.delayMs);
    }
  }

  /**
   * Syncs every pending document, at most {@link SYNC_CONCURRENCY} in flight.
   *
   * Previously a bare `Promise.all` over all pending ids. With a large library that
   * fired one request per document at once — well past the browser's ~6-per-host limit,
   * so the tail queued until it timed out — and each `syncNow` also writes to storage,
   * so the unbounded version produced a matching storm of storage events.
   */
  async syncAllPending() {
    const pendingIds = this.listPendingIds();
    const results: SyncResult[] = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < pendingIds.length) {
        const index = cursor;
        cursor += 1;
        results.push(await this.syncNow(pendingIds[index]));
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(SYNC_CONCURRENCY, pendingIds.length) }, worker),
    );

    return results;
  }

  setAllSyncEnabled(enabled: boolean): SaveDocumentResult {
    const items = this.config.localStorage.list();

    if (items.length === 0) {
      return { ok: true, queued: false };
    }

    // One index write for the whole batch rather than one per document.
    const updated = items.map(
      (item) =>
        ({
          ...item,
          sync: {
            ...item.sync,
            enabled,
            status: enabled ? "pending" : "local-only",
          },
        }) as T,
    );

    const result = this.config.localStorage.persistMany(updated);

    if (!result.ok) return { ok: false, reason: result.reason };

    return { ok: true, queued: false };
  }

  async syncNow(id: string): Promise<SyncResult> {
    const item = this.config.localStorage.loadById(id);

    if (!item) return { ok: false, message: "Document not found locally.", reason: "not-found" };

    this.setLocalSyncState(id, "syncing");
    SyncEngine.updateTelemetry(
      id,
      { lastAttemptAt: new Date().toISOString() },
      this.config.documentType,
    );
    SyncEngine.upsertOutboxItem(id, { state: "syncing" }, this.config.documentType);

    try {
      const isNew = !item.sync.cloudDocumentId;

      let cloud: CloudDocument;

      if (isNew) {
        cloud = await DocumentApi.create({
          id: item.id,
          type: this.config.documentType,
          title: this.config.getDocumentTitle(item),
          content: item,
          templateId: item.templateId,
        });
      } else {
        cloud = await DocumentApi.update(item.id, {
          title: this.config.getDocumentTitle(item),
          content: item,
          templateId: item.templateId,
          revision: item.sync.revision,
        });
      }

      // Re-patch only the sync sub-object onto whatever is currently in storage —
      // the user may have kept editing (and autosaving new content) while the network
      // request above was in flight, so `item` here is a stale pre-await snapshot and
      // must never be written back wholesale (see patchSync doc comment).
      const syncPatch = this.applyCloudSyncMetadata(item, cloud).sync;
      this.config.localStorage.patchSync(id, syncPatch);
      SyncEngine.removeOutboxItem(id, this.config.documentType);
      SyncEngine.updateTelemetry(
        id,
        { lastSuccessAt: new Date().toISOString() },
        this.config.documentType,
      );

      return { ok: true, message: "Document synced successfully." };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const isConflict = message.includes("Conflict");
      this.setLocalSyncState(id, isConflict ? "conflicted" : "pending");

      SyncEngine.upsertOutboxItem(
        id,
        {
          state: isConflict ? "conflicted" : "pending",
          nextAttemptAt: Date.now() + (isConflict ? 60000 : this.workerIdleDelayMs),
        },
        this.config.documentType,
      );

      SyncEngine.updateTelemetry(
        id,
        {
          lastErrorAt: new Date().toISOString(),
          lastErrorMessage: message,
        },
        this.config.documentType,
      );

      return {
        ok: false,
        message: message,
        reason: isConflict ? "conflict" : "network",
      };
    }
  }

  private setLocalSyncState(id: string, status: SyncStatus) {
    const item = this.config.localStorage.loadById(id);

    if (!item) return;
    this.config.localStorage.persist({
      ...item,
      sync: { ...item.sync, status },
    });
  }

  private applyCloudSyncMetadata(item: T, record: CloudDocument): T {
    return {
      ...item,
      sync: {
        ...item.sync,
        enabled: true,
        status: "synced",
        cloudDocumentId: record.id,
        lastSyncedAt: record.lastSyncedAt ?? record.updatedAt,
        revision: record.revision,
      },
    } as T;
  }

  async hydrateById(id: string, force = false): Promise<SyncResult> {
    try {
      const record = await DocumentApi.get(id);
      const merged = this.mergeCloudDocumentsIntoLocalStorage([record], force);
      return merged.ok
        ? { ok: true, message: "Cloud document loaded successfully." }
        : { ok: false, message: "Unable to merge the cloud document." };
    } catch (error: unknown) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async hydrate(options?: HydrateOptions): Promise<SyncResult> {
    if (!this.shouldHydrate(options)) {
      return { ok: true, message: "Fresh enough." };
    }

    try {
      const meta = this.getHydrateMeta();

      // Only pull what changed since the last successful hydrate. `includeContent` is
      // required here (unlike list views) because merging needs the document bodies.
      // A forced hydrate re-pulls everything so it can repair divergence.
      const records = await DocumentApi.list(this.config.documentType, {
        includeContent: true,
        updatedSince: options?.force ? undefined : meta.lastServerCursor,
      });

      const requestedAt = new Date().toISOString();
      const merged = this.mergeCloudDocumentsIntoLocalStorage(records);

      this.setLastHydrateMeta({
        lastHydratedAt: Date.now(),
        lastServerCursor: requestedAt,
      });

      return merged.ok
        ? { ok: true, message: `Merged ${merged.mergedCount} documents.` }
        : { ok: false, message: "Merge failed." };
    } catch (error: unknown) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private mergeCloudDocumentsIntoLocalStorage(records: CloudDocument[], force = false) {
    // Compare against the index (which mirrors updatedAt) rather than loading every
    // local body, then write only the documents that actually won the comparison.
    const localUpdatedAtById = new Map(
      this.config.localStorage.listIndex().map((entry) => [entry.id, entry.updatedAt]),
    );

    const toPersist: T[] = [];

    for (const record of records) {
      const cloudItem = this.config.parseItem(record.content);

      if (!cloudItem) continue;

      const hasLocal = localUpdatedAtById.has(cloudItem.id);
      const localUpdatedAt = this.toTimestamp(localUpdatedAtById.get(cloudItem.id));
      const cloudUpdatedAt = this.toTimestamp(record.updatedAt);

      if (force || !hasLocal || cloudUpdatedAt > localUpdatedAt) {
        toPersist.push(this.applyCloudSyncMetadata(cloudItem, record));
      }
    }

    if (toPersist.length > 0) {
      const result = this.config.localStorage.persistMany(toPersist);
      if (!result.ok) return { ok: false, mergedCount: 0 };
    }

    return { ok: true, mergedCount: toPersist.length };
  }

  keepLocalOnly(id: string): SyncResult {
    const item = this.config.localStorage.loadById(id);

    if (!item) return { ok: false, message: "Document not found.", reason: "not-found" };

    this.config.localStorage.persist({
      ...item,
      sync: {
        ...item.sync,
        enabled: false,
        status: "local-only",
        cloudDocumentId: null,
        revision: 1,
      },
    } as T);
    SyncEngine.removeOutboxItem(id, this.config.documentType);
    return { ok: true, message: "Sync disabled for this document." };
  }

  async resolveConflictUseLocal(id: string) {
    try {
      const record = await DocumentApi.get(id);
      const item = this.config.localStorage.loadById(id);
      if (item) {
        this.config.localStorage.persist({
          ...item,
          sync: {
            ...item.sync,
            revision: record.revision,
          },
        } as T);
      }
    } catch {
      const item = this.config.localStorage.loadById(id);
      if (item) {
        this.config.localStorage.persist({
          ...item,
          sync: {
            ...item.sync,
            cloudDocumentId: null,
            revision: 1,
          },
        } as T);
      }
    }
    return this.syncNow(id);
  }

  async resolveConflictUseCloud(id: string) {
    const result = await this.hydrateById(id, true);
    if (result.ok) SyncEngine.removeOutboxItem(id, this.config.documentType);

    return result;
  }

  private getHydrateMeta(): { lastHydratedAt: number; lastServerCursor?: string } {
    if (!this.isBrowser()) return { lastHydratedAt: 0 };
    const raw = localStorage.getItem(this.cloudHydrateMetaKey);
    if (!raw) return { lastHydratedAt: 0 };

    try {
      return JSON.parse(raw);
    } catch {
      // Self-heal: a corrupted value here must not throw uncaught inside
      // shouldHydrate()/hydrate(), which would otherwise silently break hydration.
      localStorage.removeItem(this.cloudHydrateMetaKey);
      return { lastHydratedAt: 0 };
    }
  }

  private setLastHydrateMeta(meta: { lastHydratedAt: number; lastServerCursor: string }) {
    if (!this.isBrowser()) return;

    localStorage.setItem(this.cloudHydrateMetaKey, JSON.stringify(meta));
  }

  private shouldHydrate(options?: HydrateOptions) {
    if (options?.force) return true;
    const minInterval = options?.minIntervalMs ?? this.DEFAULT_MIN_HYDRATE_INTERVAL_MS;

    return Date.now() - this.getHydrateMeta().lastHydratedAt >= minInterval;
  }
}

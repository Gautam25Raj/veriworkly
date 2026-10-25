import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import type { BaseDocument } from "@/features/documents/core/types";
import { defaultResume } from "@/features/resume/constants/default-resume";
import {
  DOCUMENT_INDEX_STORAGE_KEY,
  getDocumentKey,
  getLegacyDocumentCollectionKey,
} from "@/features/documents/services/storage-keys";

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    store,
    get length() {
      return store.size;
    },
    key: vi.fn((index: number) => [...store.keys()][index] ?? null),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

function createResumeDocument(id: string, role = "Engineer"): BaseDocument {
  const now = new Date().toISOString();
  const resume = {
    ...structuredClone(defaultResume),
    id,
    updatedAt: now,
    basics: { ...defaultResume.basics, fullName: `Resume ${id}`, role },
  };

  return {
    id,
    type: "RESUME",
    title: `Resume ${id}`,
    templateId: resume.templateId,
    content: resume,
    updatedAt: now,
    sync: resume.sync,
  };
}

let storageMock: ReturnType<typeof createLocalStorageMock>;

/**
 * The storage modules memoize both the per-type LocalStorageService and the index
 * revision, so each test needs a fresh module graph against a fresh mock.
 */
async function loadStorageModules() {
  vi.resetModules();

  return {
    workspace: await import("@/features/documents/services/document-workspace-service"),
    library: await import("@/features/documents/services/document-library"),
    index: await import("@/features/documents/services/document-index"),
    sync: await import("@/features/documents/services/sync-engine"),
  };
}

describe("document storage layout", () => {
  beforeEach(() => {
    storageMock = createLocalStorageMock();

    vi.stubGlobal("localStorage", storageMock);
    vi.stubGlobal("window", {
      localStorage: storageMock,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("stores each document under its own key rather than one shared blob", async () => {
    const { workspace } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a"), { flush: true });
    workspace.saveDocument(createResumeDocument("resume-b"), { flush: true });

    expect(storageMock.store.has(getDocumentKey("RESUME", "resume-a"))).toBe(true);
    expect(storageMock.store.has(getDocumentKey("RESUME", "resume-b"))).toBe(true);
    expect(storageMock.store.has(getLegacyDocumentCollectionKey("RESUME"))).toBe(false);
  }, 15000);

  it("keeps document bodies out of the index", async () => {
    const { workspace } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a", "Staff Engineer"), { flush: true });

    const index = JSON.parse(storageMock.store.get(DOCUMENT_INDEX_STORAGE_KEY) ?? "{}");
    const entry = index.items["RESUME:resume-a"];

    expect(entry).toMatchObject({
      id: "resume-a",
      type: "RESUME",
      title: "Resume resume-a",
      description: "Staff Engineer",
    });
    expect(entry).not.toHaveProperty("content");
  });

  it("does not read other documents' bodies when saving one document", async () => {
    const { workspace } = await loadStorageModules();

    for (let i = 0; i < 8; i += 1) {
      workspace.saveDocument(createResumeDocument(`resume-${i}`), { flush: true });
    }

    storageMock.getItem.mockClear();
    workspace.saveDocument(createResumeDocument("resume-3", "Updated"), { flush: true });

    const otherBodyReads = storageMock.getItem.mock.calls
      .map(([key]) => key)
      .filter(
        (key) =>
          key.startsWith("veriworkly:docs:v3:doc:") && key !== getDocumentKey("RESUME", "resume-3"),
      );

    expect(otherBodyReads).toEqual([]);
  });

  it("does not read any document body to build the library snapshot", async () => {
    const { workspace, library } = await loadStorageModules();

    for (let i = 0; i < 8; i += 1) {
      workspace.saveDocument(createResumeDocument(`resume-${i}`), { flush: true });
    }

    storageMock.getItem.mockClear();
    const snapshot = library.getDocumentLibrarySnapshot("ALL");

    expect(snapshot.docs).toHaveLength(8);
    expect(
      storageMock.getItem.mock.calls
        .map(([key]) => key)
        .filter((key) => key.startsWith("veriworkly:docs:v3:doc:")),
    ).toEqual([]);
  });

  it("serves a cached snapshot until the index revision changes", async () => {
    const { workspace, library } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a"), { flush: true });

    const first = library.getDocumentLibrarySnapshot("ALL");
    expect(library.getDocumentLibrarySnapshot("ALL")).toBe(first);

    workspace.saveDocument(createResumeDocument("resume-b"), { flush: true });

    const second = library.getDocumentLibrarySnapshot("ALL");
    expect(second).not.toBe(first);
    expect(second.docs).toHaveLength(2);
  });

  it("does not thrash the cache when two callers ask for different filters", async () => {
    const { workspace, library } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a"), { flush: true });

    const all = library.getDocumentLibrarySnapshot("ALL");
    const resumes = library.getDocumentLibrarySnapshot("RESUME");

    // Alternating filters must both stay cached — a single-slot cache made each of
    // these evict the other, which is what made search-while-filtered rebuild per keystroke.
    expect(library.getDocumentLibrarySnapshot("ALL")).toBe(all);
    expect(library.getDocumentLibrarySnapshot("RESUME")).toBe(resumes);
  });

  it("migrates a v2 collection blob into per-document keys once", async () => {
    const legacyA = createResumeDocument("legacy-a", "Designer");
    const legacyB = createResumeDocument("legacy-b", "Analyst");

    storageMock.store.set(
      getLegacyDocumentCollectionKey("RESUME"),
      JSON.stringify({ version: 2, items: { [legacyA.id]: legacyA, [legacyB.id]: legacyB } }),
    );

    const { workspace } = await loadStorageModules();

    expect(workspace.loadDocumentById("RESUME", "legacy-a")?.title).toBe("Resume legacy-a");
    expect(workspace.loadDocumentById("RESUME", "legacy-b")?.title).toBe("Resume legacy-b");

    expect(storageMock.store.has(getDocumentKey("RESUME", "legacy-a"))).toBe(true);
    expect(storageMock.store.has(getDocumentKey("RESUME", "legacy-b"))).toBe(true);

    // The legacy blob is removed only after every document has been rewritten.
    expect(storageMock.store.has(getLegacyDocumentCollectionKey("RESUME"))).toBe(false);

    expect(
      workspace
        .listDocumentIndexEntries("RESUME")
        .map((entry) => entry.description)
        .sort(),
    ).toEqual(["Analyst", "Designer"]);
  });

  it("keeps the legacy blob when migration cannot finish, so it retries", async () => {
    const legacy = createResumeDocument("legacy-quota");

    storageMock.store.set(
      getLegacyDocumentCollectionKey("RESUME"),
      JSON.stringify({ version: 2, items: { [legacy.id]: legacy } }),
    );

    storageMock.setItem.mockImplementation((key: string) => {
      if (key.startsWith("veriworkly:docs:v3:doc:")) {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      }
      storageMock.store.set(key, "{}");
    });

    const { workspace } = await loadStorageModules();
    workspace.loadDocumentById("RESUME", "legacy-quota");

    expect(storageMock.store.has(getLegacyDocumentCollectionKey("RESUME"))).toBe(true);
  });

  it("S-014/S-113: rebuilds a corrupt index from the document bodies", async () => {
    const { workspace } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a"), { flush: true });
    workspace.saveDocument(createResumeDocument("resume-b"), { flush: true });

    storageMock.store.set(DOCUMENT_INDEX_STORAGE_KEY, "{not json");

    const fresh = await loadStorageModules();

    expect(() => fresh.workspace.listDocumentIndexEntries("RESUME")).not.toThrow();

    fresh.workspace.prepareWorkspaceStorage();

    expect(
      fresh.workspace
        .listDocumentIndexEntries("RESUME")
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(["resume-a", "resume-b"]);
    expect(storageMock.store.get(`${DOCUMENT_INDEX_STORAGE_KEY}:corrupt`)).toBe("{not json");
  });

  it("S-014: a save against a corrupt index does not drop the other documents", async () => {
    const { workspace } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a"), { flush: true });
    storageMock.store.set(DOCUMENT_INDEX_STORAGE_KEY, "{not json");

    const fresh = await loadStorageModules();
    fresh.workspace.saveDocument(createResumeDocument("resume-b"), { flush: true });

    expect(
      fresh.workspace
        .listDocumentIndexEntries("RESUME")
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(["resume-a", "resume-b"]);
  });

  it("S-169: building the library snapshot never writes storage", async () => {
    const legacy = createResumeDocument("legacy-a");

    storageMock.store.set(
      getLegacyDocumentCollectionKey("RESUME"),
      JSON.stringify({ version: 2, items: { [legacy.id]: legacy } }),
    );

    const { library } = await loadStorageModules();
    storageMock.setItem.mockClear();
    storageMock.removeItem.mockClear();

    library.getDocumentLibrarySnapshot("ALL");

    expect(storageMock.setItem).not.toHaveBeenCalled();
    expect(storageMock.removeItem).not.toHaveBeenCalled();
  });

  it("S-015: parks an unparseable document body instead of deleting it", async () => {
    storageMock.store.set(getDocumentKey("RESUME", "broken"), "{truncated");

    const { workspace } = await loadStorageModules();

    expect(workspace.loadDocumentById("RESUME", "broken")).toBeNull();
    expect(storageMock.store.get(`${getDocumentKey("RESUME", "broken")}:corrupt`)).toBe(
      "{truncated",
    );
  });

  it("S-117: keeps the legacy blob and parks an item that fails to parse", async () => {
    const good = createResumeDocument("legacy-good");

    storageMock.store.set(
      getLegacyDocumentCollectionKey("RESUME"),
      JSON.stringify({ version: 2, items: { [good.id]: good, bad: { id: 42 } } }),
    );

    const { workspace } = await loadStorageModules();
    workspace.listDocumentIndexEntries("RESUME");
    workspace.loadDocumentById("RESUME", good.id);

    expect(storageMock.store.has(getLegacyDocumentCollectionKey("RESUME"))).toBe(true);
    expect(
      JSON.parse(storageMock.store.get(`${getLegacyDocumentCollectionKey("RESUME")}:corrupt`)!),
    ).toEqual({ items: { bad: { id: 42 } } });
    expect(workspace.loadDocumentById("RESUME", good.id)?.title).toBe("Resume legacy-good");
  });

  it("S-133: a migration whose index write fails is retried", async () => {
    const legacy = createResumeDocument("legacy-retry");

    storageMock.store.set(
      getLegacyDocumentCollectionKey("RESUME"),
      JSON.stringify({ version: 2, items: { [legacy.id]: legacy } }),
    );

    let failIndex = true;
    storageMock.setItem.mockImplementation((key: string, value: string) => {
      if (key === DOCUMENT_INDEX_STORAGE_KEY && failIndex) {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      }
      storageMock.store.set(key, value);
    });

    const { workspace } = await loadStorageModules();
    workspace.loadDocumentById("RESUME", legacy.id);

    expect(storageMock.store.has(getLegacyDocumentCollectionKey("RESUME"))).toBe(true);

    failIndex = false;
    workspace.loadDocumentById("RESUME", legacy.id);

    expect(storageMock.store.has(getLegacyDocumentCollectionKey("RESUME"))).toBe(false);
    expect(workspace.listDocumentIndexEntries("RESUME").map((entry) => entry.id)).toEqual([
      "legacy-retry",
    ]);
  });

  it("S-016: a delete whose index write fails leaves the document intact", async () => {
    const { workspace } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a"), { flush: true });

    storageMock.setItem.mockImplementation((key: string) => {
      if (key === DOCUMENT_INDEX_STORAGE_KEY) {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      }
    });

    expect(workspace.deleteDocument("RESUME", "resume-a").ok).toBe(false);
    expect(storageMock.store.has(getDocumentKey("RESUME", "resume-a"))).toBe(true);
    expect(workspace.listDocumentIndexEntries("RESUME").map((entry) => entry.id)).toEqual([
      "resume-a",
    ]);
  });

  it("S-002: a stale editor save keeps the cloud id and revision the sync recorded", async () => {
    const { workspace } = await loadStorageModules();
    const base = createResumeDocument("resume-a");
    const doc = { ...base, sync: { ...base.sync, enabled: true, status: "pending" as const } };

    workspace.saveDocument(doc, { flush: true });
    workspace
      .getWorkspaceStorage("RESUME")
      .patchSync("resume-a", { cloudDocumentId: "x", revision: 3, status: "synced" });

    const stale = {
      ...doc,
      content: {
        ...(doc.content as Record<string, unknown>),
        summary: "typed after the sync",
      },
    };
    workspace.saveDocument(stale, { flush: true });

    const saved = workspace.loadDocumentById("RESUME", "resume-a");
    expect(saved?.sync).toMatchObject({ cloudDocumentId: "x", revision: 3, status: "pending" });
    expect((saved?.content as { sync: { cloudDocumentId: string } }).sync.cloudDocumentId).toBe(
      "x",
    );
  });

  it("S-240: an edit to a conflicted document keeps it conflicted", async () => {
    const { workspace } = await loadStorageModules();
    const base = createResumeDocument("resume-a");
    const doc = { ...base, sync: { ...base.sync, enabled: true, status: "pending" as const } };

    workspace.saveDocument(doc, { flush: true });
    workspace.getWorkspaceStorage("RESUME").patchSync("resume-a", { status: "conflicted" });

    workspace.saveDocument(
      {
        ...doc,
        content: { ...(doc.content as Record<string, unknown>), summary: "next keystroke" },
      },
      { flush: true },
    );

    expect(workspace.loadDocumentById("RESUME", "resume-a")?.sync.status).toBe("conflicted");
  });

  it("an editor still holding a deleted document cannot write it back", async () => {
    const { workspace } = await loadStorageModules();
    const doc = createResumeDocument("resume-a");

    workspace.saveDocument(doc, { flush: true });
    workspace.deleteDocument("RESUME", "resume-a");

    expect(workspace.saveDocument(doc, { flush: true })).toEqual({ ok: false, reason: "removed" });
    expect(workspace.loadDocumentById("RESUME", "resume-a")).toBeNull();
  });

  it("a tab still editing a document deleted in another tab does not re-create it", async () => {
    const { workspace } = await loadStorageModules();
    const base = createResumeDocument("resume-a");
    // Cloud-linked, as the other tab's editor loaded it; then the document is gone.
    const doc = { ...base, sync: { ...base.sync, enabled: true, cloudDocumentId: "resume-a" } };

    expect(workspace.saveDocument(doc, { flush: true })).toEqual({ ok: false, reason: "removed" });
    expect(workspace.loadDocumentById("RESUME", "resume-a")).toBeNull();
  });

  it("an index repair that cannot be written fails the save instead of shrinking the index", async () => {
    const { workspace } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a"), { flush: true });
    workspace.saveDocument(createResumeDocument("resume-b"), { flush: true });
    storageMock.store.set(DOCUMENT_INDEX_STORAGE_KEY, "{not json");

    const fresh = await loadStorageModules();

    storageMock.setItem.mockImplementation((key: string, value: string) => {
      if (key === DOCUMENT_INDEX_STORAGE_KEY) {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      }
      storageMock.store.set(key, value);
    });

    expect(fresh.workspace.saveDocument(createResumeDocument("resume-c"), { flush: true }).ok).toBe(
      false,
    );
    expect(storageMock.store.get(DOCUMENT_INDEX_STORAGE_KEY)).toBe("{not json");
  });

  it("an editor save cannot change whether a document syncs", async () => {
    const { workspace } = await loadStorageModules();
    const base = createResumeDocument("resume-a");
    const doc = { ...base, sync: { ...base.sync, enabled: false, status: "local-only" as const } };

    workspace.saveDocument(doc, { flush: true });
    workspace.saveDocument(
      {
        ...doc,
        sync: { ...doc.sync, enabled: true, status: "pending" as const },
        content: { ...(doc.content as Record<string, unknown>), summary: "edited" },
      },
      { flush: true },
    );

    expect(workspace.loadDocumentById("RESUME", "resume-a")?.sync).toMatchObject({
      enabled: false,
      status: "local-only",
    });
  });

  it("a corrupt index is rebuilt even when there is no room to keep a copy of it", async () => {
    const { workspace } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a"), { flush: true });
    storageMock.store.set(DOCUMENT_INDEX_STORAGE_KEY, "{not json");

    const fresh = await loadStorageModules();

    storageMock.setItem.mockImplementation((key: string, value: string) => {
      if (key.endsWith(":corrupt")) {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      }
      storageMock.store.set(key, value);
    });

    expect(fresh.workspace.saveDocument(createResumeDocument("resume-b"), { flush: true }).ok).toBe(
      true,
    );
    expect(
      fresh.workspace
        .listDocumentIndexEntries("RESUME")
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(["resume-a", "resume-b"]);
  });

  it("S-020: saving unchanged content does not move updatedAt", async () => {
    const { workspace } = await loadStorageModules();
    const doc = { ...createResumeDocument("resume-a"), updatedAt: "2026-01-01T00:00:00.000Z" };

    workspace.saveDocument(doc, { flush: true });
    workspace.saveDocument({ ...doc, updatedAt: "2026-10-26T00:00:00.000Z" }, { flush: true });

    expect(workspace.loadDocumentById("RESUME", "resume-a")?.updatedAt).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("clearWorkspaceStorage removes every document, sync and master-profile key", async () => {
    const { workspace, sync } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a"), { flush: true });
    sync.SyncEngine.upsertOutboxItem("resume-a", {}, "RESUME");
    sync.SyncEngine.updateTelemetry("resume-a", { lastAttemptAt: "x" }, "RESUME");
    storageMock.store.set("veriworkly:master-profile", "{}");
    storageMock.store.set("veriworkly:master-profile:corrupt", "{");
    storageMock.store.set("veriworkly:cloud-hydrate-meta:resume", "{}");
    storageMock.store.set(`${getDocumentKey("RESUME", "old")}:corrupt`, "{");
    storageMock.store.set("veriworkly:workspace-settings", "{}");

    workspace.clearWorkspaceStorage();

    expect([...storageMock.store.keys()]).toEqual(["veriworkly:workspace-settings"]);
    expect(workspace.listDocumentIndexEntries()).toEqual([]);
  });

  it("removes the document body and index entry on delete", async () => {
    const { workspace } = await loadStorageModules();

    workspace.saveDocument(createResumeDocument("resume-a"), { flush: true });
    workspace.saveDocument(createResumeDocument("resume-b"), { flush: true });

    workspace.deleteDocument("RESUME", "resume-a");

    expect(storageMock.store.has(getDocumentKey("RESUME", "resume-a"))).toBe(false);
    expect(workspace.loadDocumentById("RESUME", "resume-a")).toBeNull();
    expect(workspace.listDocumentIndexEntries("RESUME").map((entry) => entry.id)).toEqual([
      "resume-b",
    ]);
  });
});

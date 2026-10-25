import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import type { ResumeData } from "@/types/resume";
import type { CoverLetterContent } from "@/features/cover-letter/types";

import { defaultResume } from "@/features/resume/constants/default-resume";
import { createDefaultCoverLetter } from "@/features/cover-letter/defaults";
import { getDocumentDefinition } from "@/features/documents/core/registry";
import { importDocumentFromJsonFile } from "@/features/documents/services/import-service";
import { loadDocumentById } from "@/features/documents/services/document-workspace-service";

/**
 * "Import JSON" is one shared menu item and must mean one thing.
 *
 * It used to mean two opposite things: the resume created a detached new document, while
 * the cover letter merged the file into whatever was open — keeping that document's `id`
 * and `cloudDocumentId`, so an imported file could be pushed over an unrelated cloud
 * document on the next sync. Both types now go through `DocumentDefinition.importJson`
 * plus `sanitizeImportedDocument`, which is the only place identity is minted.
 */

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
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

/** Minimal stand-in for the browser `File` the toolbar hands to the importer. */
function jsonFile(value: unknown): File {
  const text = JSON.stringify(value);

  return { text: () => Promise.resolve(text) } as unknown as File;
}

const FOREIGN_SYNC = {
  enabled: true,
  status: "synced",
  cloudDocumentId: "cloud-belonging-to-someone-elses-document",
  lastSyncedAt: "2026-01-01T00:00:00.000Z",
  revision: 42,
};

describe("document import contract", () => {
  beforeEach(() => {
    const localStorageMock = createLocalStorageMock();

    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("window", {
      localStorage: localStorageMock,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("imports a resume as a new saved document", async () => {
    const exported = {
      ...structuredClone(defaultResume),
      id: "resume-original",
      basics: { ...defaultResume.basics, fullName: "Ada Lovelace" },
    };

    const { document, saved } = await importDocumentFromJsonFile("RESUME", jsonFile(exported));

    expect(saved.ok).toBe(true);
    expect(document.id).not.toBe("resume-original");
    expect((document.content as ResumeData).basics.fullName).toBe("Ada Lovelace");
    expect(loadDocumentById("RESUME", document.id)?.id).toBe(document.id);
  });

  it("imports a cover letter as a new saved document, with the same outcome shape", async () => {
    const exported = createDefaultCoverLetter("cover-letter-original").content;

    const { document, saved } = await importDocumentFromJsonFile(
      "COVER_LETTER",
      jsonFile(exported),
    );

    expect(saved.ok).toBe(true);
    expect(document.type).toBe("COVER_LETTER");
    expect((document.content as CoverLetterContent).companyName).toBe("Acme Corp");
    expect(loadDocumentById("COVER_LETTER", document.id)?.id).toBe(document.id);
  });

  it("never lets an imported file carry over a foreign id or cloud linkage", async () => {
    const resumeFile = jsonFile({
      ...structuredClone(defaultResume),
      id: "resume-original",
      sync: FOREIGN_SYNC,
    });

    const coverLetterFile = jsonFile({
      ...createDefaultCoverLetter("cover-letter-original"),
      sync: FOREIGN_SYNC,
    });

    const resume = await importDocumentFromJsonFile("RESUME", resumeFile);
    const coverLetter = await importDocumentFromJsonFile("COVER_LETTER", coverLetterFile);

    for (const { document } of [resume, coverLetter]) {
      expect(document.id).not.toBe("resume-original");
      expect(document.id).not.toBe("cover-letter-original");
      expect(document.sync.cloudDocumentId).toBeNull();
      expect(document.sync.lastSyncedAt).toBeNull();
      expect(document.sync.enabled).toBe(false);
      expect(document.sync.status).toBe("local-only");
      expect(document.sync.revision).toBe(1);
    }

    // The resume's *content* carries its own id/sync copy, and the store round-trips
    // through it — so it has to be detached too, not just the envelope.
    const content = resume.document.content as ResumeData;

    expect(content.id).toBe(resume.document.id);
    expect(content.sync.cloudDocumentId).toBeNull();
    expect(content.sync.revision).toBe(1);
  });

  it("still rejects malformed input for both types", async () => {
    await expect(
      importDocumentFromJsonFile("RESUME", jsonFile("not a document")),
    ).rejects.toThrow();
    await expect(
      importDocumentFromJsonFile("COVER_LETTER", jsonFile("not a document")),
    ).rejects.toThrow();

    // Schema coercion, not just shape rejection: a NaN page margin must never reach state.
    const draft = getDocumentDefinition("COVER_LETTER").importJson({
      senderName: "Ada Lovelace",
      appearance: { pageMargin: "enormous", lineHeight: null },
      links: { items: [{ url: "https://example.com", type: "not-a-real-network" }] },
    });

    const content = draft?.content as CoverLetterContent;

    expect(Number.isFinite(content.appearance.pageMargin)).toBe(true);
    expect(Number.isFinite(content.appearance.lineHeight)).toBe(true);
    expect(content.links.items[0].type).toBe("custom");
  });

  it("accepts both the bare-content and full-envelope shapes for a cover letter", async () => {
    const envelope = createDefaultCoverLetter("cover-letter-original");

    const fromEnvelope = getDocumentDefinition("COVER_LETTER").importJson(envelope);
    const fromContent = getDocumentDefinition("COVER_LETTER").importJson(envelope.content);

    expect(fromEnvelope?.templateId).toBe(envelope.templateId);
    expect(fromEnvelope?.title).toBe(envelope.title);
    expect(fromContent?.content).toEqual(fromEnvelope?.content);
    // No envelope to read a title from, so it is derived from the target role and company.
    expect(fromContent?.title).toBe("Product Engineer - Acme Corp");
  });

  it("S-118: refuses a file that does not say what it is", async () => {
    for (const type of ["RESUME", "COVER_LETTER"] as const) {
      await expect(importDocumentFromJsonFile(type, jsonFile({}))).rejects.toThrow(
        "Invalid document JSON",
      );
    }
  });

  it("S-118: refuses another document type's export", async () => {
    const resumeExport = structuredClone(defaultResume);
    const coverLetterEnvelope = createDefaultCoverLetter("cover-letter-original");

    await expect(
      importDocumentFromJsonFile("RESUME", jsonFile(coverLetterEnvelope.content)),
    ).rejects.toThrow("Invalid document JSON");
    await expect(
      importDocumentFromJsonFile("RESUME", jsonFile(coverLetterEnvelope)),
    ).rejects.toThrow("Invalid document JSON");
    await expect(
      importDocumentFromJsonFile("COVER_LETTER", jsonFile(resumeExport)),
    ).rejects.toThrow("Invalid document JSON");
    await expect(
      importDocumentFromJsonFile(
        "COVER_LETTER",
        jsonFile({ id: "r", type: "RESUME", templateId: "x", content: resumeExport }),
      ),
    ).rejects.toThrow("Invalid document JSON");
  });

  it("S-164: an import follows the workspace auto-sync setting, like any new document", async () => {
    window.localStorage.setItem(
      "veriworkly:workspace-settings",
      JSON.stringify({ autoSyncEnabled: true }),
    );

    const { document, saved } = await importDocumentFromJsonFile(
      "RESUME",
      jsonFile({ ...structuredClone(defaultResume), sync: FOREIGN_SYNC }),
    );

    expect(saved.ok).toBe(true);
    expect(document.sync.enabled).toBe(true);
    expect(document.sync.status).toBe("pending");
    expect(document.sync.cloudDocumentId).toBeNull();
    expect((document.content as ResumeData).sync.enabled).toBe(true);
  });
});

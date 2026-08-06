"use client";

import type { ResumeData, ResumeSyncStatus } from "@/types/resume";
import type { BaseDocument } from "@/features/documents/core/types";

import { defaultResume } from "@/features/resume/constants/default-resume";
import { normalizeResumeData } from "@/features/resume/utils/normalize-data";
import { deriveResumeFromMasterProfile } from "@/features/resume/services/master-profile";
import { loadWorkspaceSettingsFromLocalStorage } from "@/features/documents/services/workspace-settings";

import {
  saveDocument,
  deleteDocument,
  clearDocuments,
  loadDocumentById,
  setActiveDocument,
  listDocumentIndexEntries,
  listFullDocuments,
} from "@/features/documents/services/document-workspace-service";

import { importDocumentFromFile } from "@/features/documents/services/import-service";
import { parseResumeDataInput } from "@/features/resume/schemas/resume-storage-schema";
import { DOCUMENT_ACTIVE_STORAGE_KEY } from "@/features/documents/services/storage-keys";

export type SaveResumeResult =
  { ok: true; queued: boolean } | { ok: false; reason: "quota-exceeded" | "unknown" };

export type SaveResumeOptions = {
  debounceMs?: number;
  flush?: boolean;
};

export interface ResumeListItem {
  id: string;
  title: string;
  templateId: string;
  role: string;
  updatedAt: string;
  sync: ResumeData["sync"];
}

function createId(): string {
  return `resume-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadResume(): ResumeData {
  if (typeof window !== "undefined") {
    const activeVal = window.localStorage.getItem(DOCUMENT_ACTIVE_STORAGE_KEY);

    if (activeVal) {
      const [type, id] = activeVal.split(":");

      if (type === "RESUME" && id) {
        const resume = loadResumeById(id);
        if (resume) return resume;
      }
    }
  }

  // Index lookup then a single body read, rather than loading every resume to take
  // the first one. This runs on editor mount.
  const newest = listDocumentIndexEntries("RESUME")[0];

  if (newest) {
    const resume = loadResumeById(newest.id);
    if (resume) return resume;
  }

  return normalizeResumeData(defaultResume);
}

export function saveResume(resume: ResumeData, options?: SaveResumeOptions): SaveResumeResult {
  const normalized = normalizeResumeData(resume);
  const now = new Date().toISOString();

  normalized.updatedAt = now;

  const doc: BaseDocument = {
    id: normalized.id,
    type: "RESUME",
    title: normalized.title || normalized.basics.fullName || "Untitled Resume",
    templateId: normalized.templateId,
    content: normalized,
    updatedAt: now,
    sync: normalized.sync,
  };

  return saveDocument(doc, options);
}

export function resetResume(): ResumeData {
  clearDocuments("RESUME");
  return defaultResume;
}

/**
 * Reads the storage index, so listing saved resumes never loads or validates a
 * resume body. `role` is the index's `description`, which is exactly what
 * `DocumentDefinition.describe` produces for a resume.
 */
export function listSavedResumes(): ResumeListItem[] {
  return listDocumentIndexEntries("RESUME").map((entry) => ({
    id: entry.id,
    title: entry.title,
    templateId: entry.templateId,
    role: entry.description,
    updatedAt: entry.updatedAt,
    sync: entry.sync,
  }));
}

export function deleteResumeById(resumeId: string): string | null {
  deleteDocument("RESUME", resumeId);

  // `delete` already repoints (or clears) the active-id pointer.
  return listDocumentIndexEntries("RESUME")[0]?.id ?? null;
}

export function loadResumeById(resumeId: string): ResumeData | null {
  const doc = loadDocumentById("RESUME", resumeId);

  if (!doc) {
    return null;
  }

  setActiveDocument("RESUME", doc.id);
  return normalizeResumeData(doc.content as ResumeData);
}

export function createResume(): ResumeData {
  const workspaceSettings = loadWorkspaceSettingsFromLocalStorage();
  const nextResume = deriveResumeFromMasterProfile(createId());

  nextResume.sync = {
    ...defaultResume.sync,
    enabled: workspaceSettings.autoSyncEnabled,
    status: (workspaceSettings.autoSyncEnabled ? "pending" : "local-only") as ResumeSyncStatus,
  };

  saveResume(nextResume);

  return nextResume;
}

export function createResumeWithTemplate(templateId: string): ResumeData {
  const workspaceSettings = loadWorkspaceSettingsFromLocalStorage();
  const nextResume = deriveResumeFromMasterProfile(createId());

  nextResume.templateId = templateId;

  nextResume.sync = {
    ...defaultResume.sync,
    enabled: workspaceSettings.autoSyncEnabled,
    status: (workspaceSettings.autoSyncEnabled ? "pending" : "local-only") as ResumeSyncStatus,
  };

  saveResume(nextResume);

  return nextResume;
}

export function deleteResume(resumeId: string): ResumeData | null {
  const nextId = deleteResumeById(resumeId);

  if (!nextId) {
    return null;
  }

  return loadResumeById(nextId);
}

export function setAllResumesSyncEnabled(enabled: boolean): SaveResumeResult {
  const collection = listFullDocuments("RESUME");

  if (collection.length === 0) {
    return { ok: true, queued: false };
  }

  const updated = collection.map((doc) => {
    const resume = doc.content as ResumeData;
    return {
      ...resume,
      sync: {
        ...resume.sync,
        enabled,
        status: (enabled ? "pending" : "local-only") as ResumeSyncStatus,
      },
    };
  });

  let lastResult: SaveResumeResult = { ok: true, queued: false };

  for (const resume of updated) {
    lastResult = saveResume(resume);

    if (!lastResult.ok) {
      return lastResult;
    }
  }

  return lastResult;
}

/**
 * Assigns a fresh id and resets sync/cloud-linkage metadata after import. Without
 * this, re-importing a previously-exported JSON file (duplicate, restored backup,
 * etc.) would carry over the original `id`/`cloudDocumentId`/`revision` verbatim —
 * risking the next autosync silently overwriting (or false-conflicting with) the
 * original cloud document instead of creating an independent new one.
 */
function sanitizeImportedResume(resume: ResumeData): ResumeData {
  return {
    ...resume,
    id: createId(),
    sync: {
      enabled: false,
      status: "local-only",
      cloudDocumentId: null,
      lastSyncedAt: null,
      revision: 1,
    },
  };
}

export async function importResumeFromFile(file: File) {
  return importDocumentFromFile(file, parseResumeDataInput, (data) =>
    sanitizeImportedResume(normalizeResumeData(data)),
  );
}

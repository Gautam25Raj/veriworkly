"use client";

import type { ReactNode } from "react";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState } from "react";

import { Button, Card } from "@veriworkly/ui";

import { useUserStore } from "@/store/useUserStore";

import type { CoverLetterContent } from "@/features/cover-letter/types";
import { parseCoverLetterContent } from "@/features/cover-letter/schema";

import { CoverLetterPreview } from "@/templates/cover-letter/web";
import { DocumentEditorShell } from "@/features/documents/editor/DocumentEditorShell";
import {
  startDocumentSyncWorker,
  hydrateCloudDocumentByIdToLocalStorage,
} from "@/features/documents/services/document-sync";
import { importCoverLetterMarkdownFile } from "@/features/cover-letter/markdown-import";
import { describeSaveResult } from "@/features/documents/services/save-failure-message";
import { loadWorkspaceSettingsFromLocalStorage } from "@/features/documents/services/workspace-settings";

import { useCoverLetterStore } from "@/features/cover-letter/store/cover-letter-store";

import { CoverLetterToolbar } from "./components/CoverLetterToolbar";
import CoverLetterEditorModals from "./components/CoverLetterEditorModals";
import { CoverLetterContentPanel } from "./components/CoverLetterContentPanel";
import { CoverLetterSettingsPanel } from "./components/CoverLetterSettingsPanel";

interface CoverLetterEditorProps {
  documentId: string;
}

/**
 * Structured to match `features/resume/editor/ResumeEditor.tsx`: hydrate from local
 * storage (falling back to the cloud), autosave on a debounce, start the sync worker,
 * and render the shared editor shell with a deferred preview.
 */
export default function CoverLetterEditor({ documentId }: CoverLetterEditorProps) {
  const router = useRouter();
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);

  const hasHydratedRef = useRef(false);

  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("Autosave ready");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const document = useCoverLetterStore((state) => state.document);
  const hydrateFromStorage = useCoverLetterStore((state) => state.hydrateFromStorage);
  const saveToStorage = useCoverLetterStore((state) => state.saveToStorage);
  const updateContent = useCoverLetterStore((state) => state.updateContent);
  const setDocument = useCoverLetterStore((state) => state.setDocument);

  const deferredDocument = useDeferredValue(document);

  const coverLetterPreviewId = `cover-letter-preview-${documentId}`;

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (hydrateFromStorage(documentId)) {
        hasHydratedRef.current = true;
        setHydrated(true);
        return;
      }

      const cloudResult = await hydrateCloudDocumentByIdToLocalStorage("COVER_LETTER", documentId);

      if (cancelled) return;

      if (cloudResult.ok) hydrateFromStorage(documentId);

      hasHydratedRef.current = true;
      setHydrated(true);
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [documentId, hydrateFromStorage]);

  // Autosave. Surfacing the result is the point: the previous implementation
  // discarded it, so a full-storage failure silently dropped the user's edits.
  useEffect(() => {
    if (!hasHydratedRef.current || !document) return;

    const failure = describeSaveResult(saveToStorage({ debounceMs: 300 }));

    setMessage(failure ?? "Saved locally");
    if (failure) toast.error(failure);
  }, [document, saveToStorage]);

  useEffect(() => {
    if (!hasHydratedRef.current || !isLoggedIn) return;

    const workspaceSettings = loadWorkspaceSettingsFromLocalStorage();

    startDocumentSyncWorker("COVER_LETTER", {
      enabled: isLoggedIn && workspaceSettings.autoSyncEnabled,
      idleDelayMs: 12_000,
    });
  }, [isLoggedIn, document?.id]);

  if (!hydrated) {
    return <CoverLetterStateCard title="Loading cover letter" message="Preparing your editor." />;
  }

  if (!document) {
    return (
      <CoverLetterStateCard
        title="Cover letter not found"
        message="Return to documents and choose another letter."
      >
        <Button onClick={() => router.push("/documents")} variant="secondary">
          Back to documents
        </Button>
      </CoverLetterStateCard>
    );
  }

  const currentDocument = document;

  function saveNow() {
    const failure = describeSaveResult(saveToStorage({ flush: true }));

    setMessage(failure ?? "Draft saved locally");
    if (failure) toast.error(failure);
  }

  async function importJson(file: File | undefined) {
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null;

      const importedShell = isRecord(parsed) && "content" in parsed ? parsed : undefined;
      const rawContent: unknown = importedShell ? importedShell.content : parsed;
      const rawContentRecord = isRecord(rawContent) ? rawContent : {};

      // Every field is coerced to its correct type here (numbers can never become NaN,
      // link `type` is allow-listed, etc.) — this is what previously bypassed schema
      // validation entirely and merged raw, untrusted JSON straight into live state.
      const validatedContent = parseCoverLetterContent(rawContentRecord);

      // Only overwrite fields the imported file actually specified, so a partial
      // export/backup still merges onto (rather than wiping) the current draft.
      const mergedContent: CoverLetterContent = { ...currentDocument.content };
      for (const key of Object.keys(validatedContent) as (keyof CoverLetterContent)[]) {
        if (key === "appearance") continue;
        if (key in rawContentRecord) {
          (mergedContent as unknown as Record<string, unknown>)[key] = validatedContent[key];
        }
      }

      const rawAppearance = isRecord(rawContentRecord.appearance)
        ? rawContentRecord.appearance
        : {};
      const mergedAppearance = { ...currentDocument.content.appearance };
      for (const key of Object.keys(validatedContent.appearance) as Array<
        keyof CoverLetterContent["appearance"]
      >) {
        if (key in rawAppearance) {
          (mergedAppearance as Record<string, unknown>)[key] = validatedContent.appearance[key];
        }
      }
      mergedContent.appearance = mergedAppearance;

      const importedTitle =
        importedShell && typeof importedShell.title === "string" ? importedShell.title : undefined;
      const importedTemplateId =
        importedShell && typeof importedShell.templateId === "string"
          ? importedShell.templateId
          : undefined;

      setDocument({
        ...currentDocument,
        title: importedTitle || currentDocument.title,
        templateId: importedTemplateId || currentDocument.templateId,
        updatedAt: new Date().toISOString(),
        content: mergedContent,
      });

      toast.success("Cover letter imported");
    } catch {
      toast.error("Import failed. Use a valid cover letter JSON file.");
    }
  }

  async function importMarkdown(file: File | undefined) {
    if (!file) return;

    try {
      const importedContent = await importCoverLetterMarkdownFile(file, currentDocument.content);

      updateContent(importedContent);
      toast.success("Cover letter markdown imported");
    } catch {
      toast.error("Import failed. Use a valid cover letter Markdown file.");
    }
  }

  const previewDocument = deferredDocument ?? currentDocument;

  return (
    <>
      <DocumentEditorShell
        toolbar={
          <CoverLetterToolbar
            documentId={documentId}
            message={message}
            onSave={saveNow}
            onSetMessage={setMessage}
            onImportJson={importJson}
            onImportMarkdown={importMarkdown}
            onOpenShare={() => setShareModalOpen(true)}
            onOpenDelete={() => setDeleteModalOpen(true)}
          />
        }
        modals={
          <CoverLetterEditorModals
            shareModalOpen={shareModalOpen}
            onShareModalClose={() => setShareModalOpen(false)}
            deleteModalOpen={deleteModalOpen}
            onDeleteModalClose={() => setDeleteModalOpen(false)}
          />
        }
        contentPanel={<CoverLetterContentPanel documentId={currentDocument.id} />}
        settingsPanel={<CoverLetterSettingsPanel />}
        preview={
          <CoverLetterPreview
            content={previewDocument.content}
            templateId={previewDocument.templateId}
          />
        }
        previewId={coverLetterPreviewId}
        previewTitle={previewDocument.title || "Cover Letter"}
        settingsLabel="Style settings"
      />
    </>
  );
}

function CoverLetterStateCard({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card className="space-y-3 text-center">
        <h1 className="text-foreground text-xl font-semibold">{title}</h1>
        <p className="text-muted text-sm">{message}</p>
        {children}
      </Card>
    </div>
  );
}

"use client";

import { toast } from "sonner";
import { useCallback, useDeferredValue } from "react";

import { CoverLetterPreview } from "@/templates/cover-letter/web";
import { DocumentEditorShell } from "@/features/documents/editor/DocumentEditorShell";
import { DocumentLoadStateCard } from "@/features/documents/editor/DocumentStateCard";
import { useDocumentTabTitle } from "@/features/documents/editor/editor-load-status";
import { useDocumentEditorSession } from "@/features/documents/editor/useDocumentEditorSession";
import { importCoverLetterMarkdownFile } from "@/features/cover-letter/markdown-import";
import { describeSaveResult } from "@/features/documents/services/save-failure-message";

import { useCoverLetterStore } from "@/features/cover-letter/store/cover-letter-store";

import { CoverLetterToolbar } from "./components/CoverLetterToolbar";
import CoverLetterEditorModals from "./components/CoverLetterEditorModals";
import { CoverLetterContentPanel } from "./components/CoverLetterContentPanel";
import { CoverLetterSettingsPanel } from "./components/CoverLetterSettingsPanel";

interface CoverLetterEditorProps {
  documentId: string;
}

export default function CoverLetterEditor({ documentId }: CoverLetterEditorProps) {
  const document = useCoverLetterStore((state) => state.document);
  const hydrateFromStorage = useCoverLetterStore((state) => state.hydrateFromStorage);
  const saveToStorage = useCoverLetterStore((state) => state.saveToStorage);
  const updateContent = useCoverLetterStore((state) => state.updateContent);

  // `storeDocumentId`: the store outlives the route, so after a client-side navigation it
  // can still hold the previous letter.
  const session = useDocumentEditorSession({
    type: "COVER_LETTER",
    documentId,
    loadIntoStore: hydrateFromStorage,
    saveToStorage,
    document,
    storeDocumentId: document?.id ?? null,
  });
  const { setMessage } = session;

  const deferredDocument = useDeferredValue(document);

  const tabTitle = document?.title || "Untitled Cover Letter";

  useDocumentTabTitle(tabTitle, session.isReady);

  const saveNow = useCallback(() => {
    const failure = describeSaveResult(saveToStorage({ flush: true }));

    setMessage(failure ?? "Saved on this device");
    if (failure) toast.error(failure);
  }, [saveToStorage, setMessage]);

  // JSON import creates a new document through the shared toolbar hook; Markdown import
  // stays here because it merges into the open letter's content.
  const importMarkdown = useCallback(
    async (file: File | undefined) => {
      const content = useCoverLetterStore.getState().document?.content;

      if (!file || !content) return;

      try {
        updateContent(await importCoverLetterMarkdownFile(file, content));
        toast.success("Cover letter markdown imported");
      } catch {
        toast.error("Import failed. Use a valid cover letter Markdown file.");
      }
    },
    [updateContent],
  );

  if (!session.isReady || !document) {
    return (
      <DocumentLoadStateCard
        noun="cover letter"
        load={session.load}
        isReady={session.isReady}
        onRetry={session.retryLoad}
        notFoundMessage="Return to documents and choose another letter."
      />
    );
  }

  const previewDocument = deferredDocument ?? document;

  return (
    <DocumentEditorShell
      toolbar={
        <CoverLetterToolbar
          documentId={documentId}
          message={session.message}
          onSave={saveNow}
          onSetMessage={setMessage}
          onImportMarkdown={importMarkdown}
          onOpenShare={session.openShare}
          onOpenDelete={session.openDelete}
        />
      }
      modals={
        <CoverLetterEditorModals
          shareModalOpen={session.shareModalOpen}
          onShareModalClose={session.closeShare}
          deleteModalOpen={session.deleteModalOpen}
          onDeleteModalClose={session.closeDelete}
        />
      }
      contentPanel={<CoverLetterContentPanel documentId={document.id} />}
      settingsPanel={<CoverLetterSettingsPanel />}
      preview={
        <CoverLetterPreview
          content={previewDocument.content}
          templateId={previewDocument.templateId}
        />
      }
      previewTitle={tabTitle}
      settingsLabel="Style settings"
    />
  );
}

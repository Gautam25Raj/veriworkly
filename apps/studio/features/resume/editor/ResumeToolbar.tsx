"use client";

import { toast } from "sonner";
import { memo } from "react";
import { useRouter } from "next/navigation";

import { useUserStore } from "@/store/useUserStore";

import {
  saveResume,
  toResumeDocument,
  importResumeFromMarkdownFile,
} from "@/features/resume/services/resume-service";
import { syncDocumentNow } from "@/features/documents/services/document-sync";

import ToolbarHeader from "@/features/documents/editor/toolbar/ToolbarHeader";
import ToolbarActionsMenu from "@/features/documents/editor/toolbar/ToolbarActionsMenu";
import ToolbarDownloadMenu from "@/features/documents/editor/toolbar/ToolbarDownloadMenu";
import { getSaveFailureMessage } from "@/features/documents/services/save-failure-message";
import { useDocumentDownloads } from "@/features/documents/editor/toolbar/useDocumentDownloads";
import { useDocumentJsonImport } from "@/features/documents/editor/toolbar/useDocumentJsonImport";
import { useHiddenFileInput } from "@/features/documents/editor/toolbar/useHiddenFileInput";
import ToolbarSaveButton from "@/features/documents/editor/toolbar/ToolbarSaveButton";

import { useResumeStore } from "@/features/resume/store/resume-store";
import { getMasterProfileForNewDocument } from "@/features/resume/services/master-profile";

import { getDocumentEditorPath, getDocumentPreviewPath } from "@/features/documents/core/routes";

interface ToolbarProps {
  resumeId: string;
  resumePreviewId: string;
  /**
   * Status line text. Owned by `ResumeEditor` — as in the cover letter editor — because
   * autosave lives there and needs to report save failures here.
   */
  message: string;
  onSetMessage: (message: string) => void;
  onOpenShare: () => void;
  onOpenDelete: () => void;
}

/**
 * Memoised, like the content and settings panels. It renders two `Menu` trees and two
 * hidden file inputs, all of which reconciled on every keystroke because the editor above
 * re-renders as the resume changes. Its props are stable now (the editor's callbacks are
 * `useCallback`ed), so the bail-out actually takes effect — except when `message` changes,
 * which is the one prop that genuinely has to reach the header.
 */
const ResumeToolbar = memo(function ResumeToolbar({
  resumeId,
  resumePreviewId,
  message,
  onSetMessage,
  onOpenShare,
  onOpenDelete,
}: ToolbarProps) {
  const router = useRouter();

  const resume = useResumeStore((state) => state.resume);
  const resetResume = useResumeStore((state) => state.resetResume);
  const emptyResume = useResumeStore((state) => state.emptyResume);
  const setResume = useResumeStore((state) => state.setResume);
  const updateTitle = useResumeStore((state) => state.updateTitle);
  const saveToStorage = useResumeStore((state) => state.saveToStorage);

  const isLoggedIn = useUserStore((state) => state.isLoggedIn);

  async function handleSync() {
    if (!isLoggedIn) {
      toast.error("Please log in to sync documents.");
      return;
    }

    onSetMessage("Syncing with cloud...");

    try {
      const result = await syncDocumentNow("RESUME", resumeId);

      if (!result.ok) {
        onSetMessage(`Sync failed: ${result.message}`);
        toast.error(result.message);
        return;
      }

      onSetMessage("Synced successfully");
      toast.success("Synced successfully");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Sync failed";
      onSetMessage(`Sync failed: ${errMsg}`);
      toast.error(errMsg);
    }
  }

  const {
    activeDownload,
    onDownloadPdf,
    onDownloadDocx,
    onDownloadHtml,
    onDownloadJson,
    onDownloadText,
    onDownloadMarkdown,
  } = useDocumentDownloads({
    // The store holds bare `ResumeData`; the shared export path takes the envelope.
    getDocument: () => toResumeDocument(resume),
    onMessage: onSetMessage,
    // Keeps "Export → HTML" on the WYSIWYG branch, which is what this button has always
    // produced — see export-html.ts.
    previewElementId: resumePreviewId,
  });

  const onImportResume = useDocumentJsonImport("RESUME", onSetMessage);

  async function onImportMarkdown(file: File | undefined) {
    if (!file) return;

    try {
      const importedResume = await importResumeFromMarkdownFile(file, resume);
      const saveResult = saveResume(importedResume);

      if (!saveResult.ok) {
        onSetMessage(getSaveFailureMessage(saveResult.reason));
        return;
      }

      setResume(importedResume);
      router.push(getDocumentEditorPath("RESUME", importedResume.id));
      onSetMessage("Markdown imported successfully");
    } catch {
      onSetMessage("Import failed. Please use a valid Markdown file");
    }
  }

  const jsonInput = useHiddenFileInput(onImportResume);
  const markdownInput = useHiddenFileInput(onImportMarkdown);

  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
      <ToolbarHeader
        message={message}
        title={resume.title ?? "Untitled Resume"}
        onBack={() => router.push("/documents")}
        onTitleChange={updateTitle}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ToolbarSaveButton
          onSave={() => {
            const saveResult = saveToStorage({ flush: true });

            onSetMessage(
              saveResult.ok ? "Saved on this device" : getSaveFailureMessage(saveResult.reason),
            );
          }}
        />

        <input
          type="file"
          className="hidden"
          ref={jsonInput.ref}
          accept="application/json"
          onChange={jsonInput.onChange}
        />

        <input
          type="file"
          className="hidden"
          ref={markdownInput.ref}
          accept="text/markdown,.md,.markdown"
          onChange={markdownInput.onChange}
        />

        <ToolbarDownloadMenu
          onDownloadPdf={onDownloadPdf}
          onDownloadDocx={onDownloadDocx}
          onDownloadHtml={onDownloadHtml}
          onDownloadText={onDownloadText}
          onDownloadJson={onDownloadJson}
          activeDownload={activeDownload}
          onDownloadMarkdown={onDownloadMarkdown}
        />

        <ToolbarActionsMenu
          documentLabel="resume"
          onShare={onOpenShare}
          onDelete={onOpenDelete}
          onImportJson={jsonInput.open}
          onImportMarkdown={markdownInput.open}
          onReset={async () => {
            // Same as a new resume: seeded from the profile, never the sample.
            const result = resetResume(await getMasterProfileForNewDocument());
            onSetMessage(
              result.ok ? "Resume reset to defaults" : getSaveFailureMessage(result.reason),
            );
          }}
          onEmptyFields={() => {
            const result = emptyResume();
            onSetMessage(result.ok ? "All fields cleared" : getSaveFailureMessage(result.reason));
          }}
          onSync={handleSync}
          onFullPreview={() => router.push(getDocumentPreviewPath("RESUME", resumeId))}
          onPdfDebug={
            process.env.NODE_ENV === "development"
              ? () =>
                  window.open(`/pdf-debug/resume/${resume.templateId}?id=${resume.id}`, "_blank")
              : undefined
          }
        />
      </div>
    </div>
  );
});

export default ResumeToolbar;

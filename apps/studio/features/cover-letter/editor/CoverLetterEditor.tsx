"use client";

import type { ReactNode } from "react";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { Button, Card } from "@veriworkly/ui";

import { useUserStore } from "@/store/useUserStore";

import type { CoverLetterContent } from "@/features/cover-letter/types";
import { parseCoverLetterContent } from "@/features/cover-letter/schema";

import { CoverLetterPreview } from "@/templates/cover-letter/web";
import ShareDocumentModal from "@/components/modals/ShareDocumentModal";
import { DocumentEditorShell } from "@/features/documents/editor/DocumentEditorShell";
import { startDocumentSyncWorker } from "@/features/documents/services/document-sync";
import { importCoverLetterMarkdownFile } from "@/features/cover-letter/markdown-import";
import { deleteDocument } from "@/features/documents/services/document-workspace-service";
import { loadWorkspaceSettingsFromLocalStorage } from "@/features/documents/services/workspace-settings";

import { CoverLetterToolbar } from "./components/CoverLetterToolbar";
import { useCoverLetterDocument } from "./hooks/useCoverLetterDocument";
import { CoverLetterContentPanel } from "./components/CoverLetterContentPanel";
import { CoverLetterSettingsPanel } from "./components/CoverLetterSettingsPanel";

interface CoverLetterEditorProps {
  documentId: string;
}

export default function CoverLetterEditor({ documentId }: CoverLetterEditorProps) {
  const router = useRouter();
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const {
    doc,
    hydrated,
    message,
    setMessage,
    updateDocument,
    updateContent,
    updateAppearance,
    updateLinks,
    addLink,
    updateLink,
    removeLink,
    saveCurrentDocument,
  } = useCoverLetterDocument(documentId);

  useEffect(() => {
    if (!hydrated || !isLoggedIn) return;

    const workspaceSettings = loadWorkspaceSettingsFromLocalStorage();

    startDocumentSyncWorker("COVER_LETTER", {
      enabled: isLoggedIn && workspaceSettings.autoSyncEnabled,
      idleDelayMs: 12_000,
    });
  }, [hydrated, isLoggedIn, doc?.id]);

  const links = useMemo(
    () => doc?.content.links ?? { displayMode: "icon-username" as const, items: [] },
    [doc?.content.links],
  );

  /**
   * The preview renders deferred content so typing stays responsive.
   *
   * Both cover letter templates re-measure their pagination in a layout effect
   * whenever content changes. Without this, every keystroke ran that measuring pass at
   * blocking priority — the resume editor already deferred its preview this way, and
   * the cover letter did not.
   *
   * Hook order requires this above the `hydrated`/`doc` early returns, so it reads
   * through the optional `doc`.
   */
  const deferredContent = useDeferredValue(doc?.content);
  const deferredTemplateId = useDeferredValue(doc?.templateId);

  if (!hydrated) {
    return <CoverLetterStateCard title="Loading cover letter" message="Preparing your editor." />;
  }

  if (!doc) {
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

  const currentDoc = doc;

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
      const mergedContent: CoverLetterContent = { ...currentDoc.content };
      for (const key of Object.keys(validatedContent) as (keyof CoverLetterContent)[]) {
        if (key === "appearance") continue;
        if (key in rawContentRecord) {
          (mergedContent as unknown as Record<string, unknown>)[key] = validatedContent[key];
        }
      }

      const rawAppearance = isRecord(rawContentRecord.appearance)
        ? rawContentRecord.appearance
        : {};
      const mergedAppearance = { ...currentDoc.content.appearance };
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

      updateDocument(
        {
          ...currentDoc,
          title: importedTitle || currentDoc.title,
          templateId: importedTemplateId || currentDoc.templateId,
          updatedAt: new Date().toISOString(),
          content: mergedContent,
        },
        { flush: true },
      );

      toast.success("Cover letter imported");
    } catch {
      toast.error("Import failed. Use a valid cover letter JSON file.");
    }
  }

  async function importMarkdown(file: File | undefined) {
    if (!file) return;

    try {
      const importedContent = await importCoverLetterMarkdownFile(file, currentDoc.content);

      updateDocument(
        {
          ...currentDoc,
          title: importedContent.jobTitle || currentDoc.title,
          updatedAt: new Date().toISOString(),
          content: importedContent,
        },
        { flush: true },
      );

      toast.success("Cover letter markdown imported");
    } catch {
      toast.error("Import failed. Use a valid cover letter Markdown file.");
    }
  }

  function deleteCurrentDocument() {
    const confirmed = window.confirm(`Delete "${currentDoc.title}"? This cannot be undone.`);
    if (!confirmed) return;

    deleteDocument("COVER_LETTER", currentDoc.id);
    router.push("/documents");
  }

  const content = currentDoc.content;

  return (
    <>
      <DocumentEditorShell
        toolbar={
          <CoverLetterToolbar
            document={currentDoc}
            message={message}
            onDelete={deleteCurrentDocument}
            onImportJson={importJson}
            onImportMarkdown={importMarkdown}
            onOpenShare={() => setShareModalOpen(true)}
            onSave={saveCurrentDocument}
            onSetMessage={setMessage}
            onUpdateDocument={updateDocument}
          />
        }
        contentPanel={
          <CoverLetterContentPanel
            content={content}
            documentId={currentDoc.id}
            links={links}
            onAddLink={addLink}
            onRemoveLink={removeLink}
            onUpdateContent={updateContent}
            onUpdateLink={updateLink}
            onUpdateLinks={updateLinks}
          />
        }
        settingsPanel={
          <CoverLetterSettingsPanel
            document={currentDoc}
            appearance={content.appearance}
            onUpdateDocument={updateDocument}
            onUpdateAppearance={updateAppearance}
          />
        }
        preview={
          <CoverLetterPreview
            content={deferredContent ?? content}
            templateId={deferredTemplateId ?? currentDoc.templateId}
          />
        }
        previewTitle={currentDoc.title || "Cover Letter"}
      />

      {shareModalOpen ? (
        <ShareDocumentModal
          documentId={null}
          document={{
            source: "document",
            id: currentDoc.id,
            type: "COVER_LETTER",
            title: currentDoc.title,
            description: content.subject || content.jobTitle || "Cover letter",
            templateId: currentDoc.templateId,
            templateName: "Cover Letter",
            templateDescription: "Cover letter",
            previewImage: "",
            updatedAt: currentDoc.updatedAt,
            sync: currentDoc.sync,
          }}
          onClose={() => setShareModalOpen(false)}
        />
      ) : null}
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

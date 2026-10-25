"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";

import type { SaveDocumentResult } from "@/features/documents/services/local-storage-service";

import { getDocumentEditorPath } from "@/features/documents/core/routes";

import { Button } from "@veriworkly/ui";

import { useUserStore } from "@/store/useUserStore";

import { CoverLetterPreview } from "@/templates/cover-letter/web";
import { DocumentEditorShell } from "@/features/documents/editor/DocumentEditorShell";
import { DocumentStateCard } from "@/features/documents/editor/DocumentStateCard";
import {
  loadStateFor,
  INITIAL_LOAD_STATE,
  cloudLoadFailureState,
  useDocumentTabTitle,
  type KeyedLoadState,
} from "@/features/documents/editor/editor-load-status";
import {
  startDocumentSyncWorker,
  subscribeToRemoteDeletions,
  hydrateCloudDocumentByIdToLocalStorage,
} from "@/features/documents/services/document-sync";
import { importCoverLetterMarkdownFile } from "@/features/cover-letter/markdown-import";
import {
  describeSaveResult,
  SAVE_QUEUED_MESSAGE,
  SAVE_PERSISTED_MESSAGE,
} from "@/features/documents/services/save-failure-message";
import { loadWorkspaceSettingsFromLocalStorage } from "@/features/documents/services/workspace-settings";
import { useFlushPendingSavesOnExit } from "@/features/documents/editor/useFlushPendingSavesOnExit";

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
  const accountAutoSync = useUserStore((state) => state.user?.autoSyncEnabled);

  const hasHydratedRef = useRef(false);
  const lastSaveFailureRef = useRef<string | null>(null);

  const [loadState, setLoadState] = useState<KeyedLoadState>(INITIAL_LOAD_STATE);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [message, setMessage] = useState("Autosave ready");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const document = useCoverLetterStore((state) => state.document);
  const hydrateFromStorage = useCoverLetterStore((state) => state.hydrateFromStorage);
  const saveToStorage = useCoverLetterStore((state) => state.saveToStorage);
  const updateContent = useCoverLetterStore((state) => state.updateContent);

  const deferredDocument = useDeferredValue(document);

  const load = loadStateFor(loadState, documentId);
  // The same gate as `ResumeEditor`, plus the store holding the letter loaded for this URL:
  // the store outlives the route, so after a client-side navigation it can still hold the
  // previous letter.
  const isReady = load.status === "ready" && document?.id === loadState.id;

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (hydrateFromStorage(documentId)) {
        hasHydratedRef.current = true;
        setLoadState({ id: documentId, status: "ready" });
        return;
      }

      const cloudResult = await hydrateCloudDocumentByIdToLocalStorage("COVER_LETTER", documentId);

      if (cancelled) return;

      if (cloudResult.ok && hydrateFromStorage(documentId)) {
        hasHydratedRef.current = true;
        setLoadState({ id: documentId, status: "ready" });
        return;
      }

      setLoadState({ id: documentId, ...cloudLoadFailureState(cloudResult) });
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [documentId, loadAttempt, hydrateFromStorage]);

  const tabTitle = document?.title || "Untitled Cover Letter";

  useDocumentTabTitle(tabTitle, isReady);

  const reportSaveResult = useCallback((failure: string | null) => {
    setMessage(failure ?? SAVE_PERSISTED_MESSAGE);

    // Only on transition — a persistent failure would otherwise toast per keystroke.
    if (failure && failure !== lastSaveFailureRef.current) {
      toast.error(failure);
    }

    lastSaveFailureRef.current = failure;
  }, []);

  // A save refused because the document was deleted (here, or on another device by the sync
  // worker) has nothing left to edit: say so and leave the dead editor.
  // The document moved to a new id (its cloud copy had been deleted). The store switches to
  // it before the route does, so typing in between is saved to the new id, not the old one.
  const followMove = useCallback(
    (newId: string) => {
      // Already loaded: no "loading" flash that would unmount the field being typed in.
      if (hydrateFromStorage(newId)) {
        setLoadState({ id: newId, movedFrom: documentId, status: "ready" });
      }

      router.replace(getDocumentEditorPath("COVER_LETTER", newId));
    },
    [documentId, router, hydrateFromStorage],
  );

  const handleSaveResult = useCallback(
    (result: SaveDocumentResult) => {
      reportSaveResult(describeSaveResult(result));

      if (result.ok && result.movedTo) followMove(result.movedTo);
      if (!result.ok && result.reason === "removed") router.replace("/documents");
    },
    [followMove, reportSaveResult, router],
  );

  useEffect(
    () =>
      subscribeToRemoteDeletions((detail) => {
        if (detail.type !== "COVER_LETTER" || detail.id !== documentId) return;

        if (detail.newId) {
          toast.info(detail.message);
          followMove(detail.newId);
          return;
        }

        if (detail.kept) {
          toast.warning(detail.message);
          return;
        }

        toast.error(detail.message);
        router.replace("/documents");
      }),
    [documentId, followMove, router],
  );

  // Autosave. Surfacing the result is the point: the previous implementation discarded it,
  // so a full-storage failure silently dropped the user's edits. Inspecting the returned
  // value was still not enough — a debounced save returns `{ queued: true }` before the
  // write happens, so the real result (and "Saved on this device") only ever comes from `onFlush`.
  useEffect(() => {
    if (!hasHydratedRef.current || !document) return;

    const receipt = saveToStorage({
      debounceMs: 300,
      onFlush: handleSaveResult,
    });

    if (receipt.ok && receipt.queued) {
      // The autosave itself is the external system this effect drives; the status line is
      // that system reporting back, and the queued half of it is only knowable here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessage(SAVE_QUEUED_MESSAGE);
      return;
    }

    handleSaveResult(receipt);
  }, [document, saveToStorage, handleSaveResult]);

  useFlushPendingSavesOnExit("COVER_LETTER");

  // Keyed on the ready state rather than a ref, so the worker starts even when the store
  // already held this letter; `accountAutoSync` re-runs it when sign-in changes the setting
  // (`AuthInitializer` writes it to the workspace settings read here).
  useEffect(() => {
    if (!isReady || !isLoggedIn) return;

    startDocumentSyncWorker("COVER_LETTER", {
      enabled: loadWorkspaceSettingsFromLocalStorage().autoSyncEnabled,
      idleDelayMs: 12_000,
    });
  }, [isReady, isLoggedIn, accountAutoSync, documentId]);

  /*
   * Declared above the early returns and wrapped in `useCallback` so the memoised toolbar
   * and modals below actually bail out. Inline arrow props are new objects on every render,
   * which would make `memo` on those components pure overhead.
   */
  const saveNow = useCallback(() => {
    const failure = describeSaveResult(saveToStorage({ flush: true }));

    setMessage(failure ?? "Saved on this device");
    if (failure) toast.error(failure);
  }, [saveToStorage]);

  /*
   * JSON import used to live here as sixty lines of merge-into-the-open-document logic.
   * It now lives in `features/cover-letter/import.ts` behind
   * `DocumentDefinition.importJson`, and the shared toolbar hook drives it — so "Import
   * JSON" creates a new document for both types instead of overwriting this draft.
   * Markdown import stays local because it genuinely merges into the current content.
   */
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

  const openShare = useCallback(() => setShareModalOpen(true), []);
  const closeShare = useCallback(() => setShareModalOpen(false), []);
  const openDelete = useCallback(() => setDeleteModalOpen(true), []);
  const closeDelete = useCallback(() => setDeleteModalOpen(false), []);

  if (load.status === "not-found") {
    return (
      <DocumentStateCard
        title="Cover letter not found"
        message="Return to documents and choose another letter."
      >
        <Button onClick={() => router.push("/documents")} variant="secondary">
          Back to documents
        </Button>
      </DocumentStateCard>
    );
  }

  if (load.status === "error") {
    return (
      <DocumentStateCard title="Could not load this cover letter" message={load.message}>
        <div className="flex justify-center gap-2">
          <Button
            onClick={() => {
              setLoadState(INITIAL_LOAD_STATE);
              setLoadAttempt((attempt) => attempt + 1);
            }}
          >
            Try again
          </Button>
          <Button onClick={() => router.push("/documents")} variant="secondary">
            Back to documents
          </Button>
        </div>
      </DocumentStateCard>
    );
  }

  if (!isReady || !document) {
    return <DocumentStateCard title="Loading cover letter" message="Preparing your editor." />;
  }

  const currentDocument = document;
  const previewDocument = deferredDocument ?? currentDocument;

  return (
    <DocumentEditorShell
      toolbar={
        <CoverLetterToolbar
          documentId={documentId}
          message={message}
          onSave={saveNow}
          onSetMessage={setMessage}
          onImportMarkdown={importMarkdown}
          onOpenShare={openShare}
          onOpenDelete={openDelete}
        />
      }
      modals={
        <CoverLetterEditorModals
          shareModalOpen={shareModalOpen}
          onShareModalClose={closeShare}
          deleteModalOpen={deleteModalOpen}
          onDeleteModalClose={closeDelete}
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
      previewTitle={tabTitle}
      settingsLabel="Style settings"
    />
  );
}

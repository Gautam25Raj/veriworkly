"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createElement, useCallback, useDeferredValue, useEffect, useRef, useState } from "react";

import type { SaveDocumentResult } from "@/features/documents/services/local-storage-service";

import { getDocumentEditorPath } from "@/features/documents/core/routes";

import { Button } from "@veriworkly/ui";

import { loadResumeById } from "@/features/resume/services/resume-service";
import {
  startDocumentSyncWorker,
  subscribeToRemoteDeletions,
  hydrateCloudDocumentByIdToLocalStorage,
} from "@/features/documents/services/document-sync";
import { DocumentEditorShell } from "@/features/documents/editor/DocumentEditorShell";
import { DocumentStateCard } from "@/features/documents/editor/DocumentStateCard";
import {
  describeSaveResult,
  SAVE_QUEUED_MESSAGE,
  SAVE_PERSISTED_MESSAGE,
} from "@/features/documents/services/save-failure-message";
import { loadWorkspaceSettingsFromLocalStorage } from "@/features/documents/services/workspace-settings";
import { useFlushPendingSavesOnExit } from "@/features/documents/editor/useFlushPendingSavesOnExit";

import { loadTemplateComponentById } from "@/templates";
import { useTemplateComponent } from "@/templates/shared/use-template-component";

import ResumeToolbar from "./ResumeToolbar";
import ResumeEditorModals from "./ResumeEditorModals";
import EditorContentPanel from "./EditorContentPanel";
import EditorSettingsPanel from "./EditorSettingsPanel";
import { ResumePagedPreview } from "./ResumePagedPreview";

import { useUserStore } from "@/store/useUserStore";
import { useResumeStore } from "@/features/resume/store/resume-store";

interface ResumeEditorProps {
  documentId: string;
}

/** Mirrors the `hydrated` / `document` gate in `CoverLetterEditor`. */
type HydrationStatus = "loading" | "ready" | "not-found";

const ResumeEditor = ({ documentId }: ResumeEditorProps) => {
  // No `useSearchParams` any more: it was only read by the dead `documentId === "new"`
  // branch, and it forces a Suspense boundary in the App Router.
  const router = useRouter();

  const hasHydratedRef = useRef(false);
  const lastSaveFailureRef = useRef<string | null>(null);

  const isLoggedIn = useUserStore((state) => state.isLoggedIn);

  // Narrow selectors, matching how the toolbar and the section components read the store.
  // `useResume()` was `useResumeStore()` with no selector, which in zustand subscribes to
  // every state change — and this component sits above the shell and rebuilds the toolbar,
  // modals, and preview elements on each render. Action identities are stable, so the
  // effect dependency arrays below stay correct.
  const resume = useResumeStore((state) => state.resume);
  const setResume = useResumeStore((state) => state.setResume);
  const saveToStorage = useResumeStore((state) => state.saveToStorage);

  const [status, setStatus] = useState<HydrationStatus>("loading");
  const [message, setMessage] = useState("Autosave ready");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const deferredResume = useDeferredValue(resume);

  const resumePreviewId = `resume-preview-${resume.id}`;

  useEffect(() => {
    let cancelled = false;

    /*
     * No `documentId === "new"` branch: the route's server component intercepts `new`
     * before this component is reached and renders `EditorEntryRedirect` instead, so the
     * branch that used to sit here could never run. It was also the only caller of the
     * master-profile-aware constructor, which made that feature look wired up while every
     * live route bypassed it — see the registry's `wrapResumeDocument`, which is now where
     * master-profile derivation actually happens for all creation routes.
     */
    const hydrate = async () => {
      if (!documentId) {
        setStatus("not-found");

        return;
      }

      const routeResume = loadResumeById(documentId);

      if (routeResume) {
        setResume(routeResume);
        hasHydratedRef.current = true;
        setStatus("ready");

        return;
      }

      const cloudResult = await hydrateCloudDocumentByIdToLocalStorage("RESUME", documentId);

      if (cancelled) {
        return;
      }

      if (cloudResult.ok) {
        const hydratedResume = loadResumeById(documentId);

        if (hydratedResume) {
          setResume(hydratedResume);
          hasHydratedRef.current = true;
          setStatus("ready");

          return;
        }
      }

      // Deliberately no fallback to the active-or-newest resume: that loaded a *different*
      // document while the URL kept showing this id, so autosave then wrote the user's
      // edits onto the wrong resume.
      setStatus("not-found");
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [documentId, setResume]);

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
      const moved = loadResumeById(newId);
      if (moved) setResume(moved);
      router.replace(getDocumentEditorPath("RESUME", newId));
    },
    [router, setResume],
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
        if (detail.type !== "RESUME" || detail.id !== documentId) return;

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
  // so a full-storage failure silently dropped the user's edits. The returned value is only
  // a queue receipt — the write lands 300ms later — so `onFlush` is where the real result
  // (including a quota failure) arrives, and only it may say "Saved locally".
  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

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
  }, [resume, saveToStorage, handleSaveResult]);

  useFlushPendingSavesOnExit("RESUME");

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    if (!isLoggedIn) {
      return;
    }

    const workspaceSettings = loadWorkspaceSettingsFromLocalStorage();

    startDocumentSyncWorker("RESUME", {
      enabled: isLoggedIn && workspaceSettings.autoSyncEnabled,
      idleDelayMs: 12_000,
    });
  }, [isLoggedIn, resume.id]);

  // Stable identities so the memoised toolbar and modals below can bail out; inline arrows
  // would hand them new props on every keystroke and make `memo` pure overhead.
  const openShare = useCallback(() => setShareModalOpen(true), []);
  const closeShare = useCallback(() => setShareModalOpen(false), []);
  const openDelete = useCallback(() => setDeleteModalOpen(true), []);
  const closeDelete = useCallback(() => setDeleteModalOpen(false), []);

  const TemplateComponent = useTemplateComponent(
    loadTemplateComponentById,
    deferredResume.templateId,
  );

  // `createElement` rather than JSX: the template is resolved at runtime, and the React
  // compiler lint treats a capitalized hook result in JSX position as a component
  // declared during render.
  const preview = TemplateComponent ? (
    <ResumePagedPreview>
      {createElement(TemplateComponent, { resume: deferredResume })}
    </ResumePagedPreview>
  ) : null;

  if (status === "loading") {
    return <DocumentStateCard title="Loading resume" message="Preparing your editor." />;
  }

  if (status === "not-found") {
    return (
      <DocumentStateCard
        title="Resume not found"
        message="Return to documents and choose another resume."
      >
        <Button onClick={() => router.push("/documents")} variant="secondary">
          Back to documents
        </Button>
      </DocumentStateCard>
    );
  }

  return (
    <DocumentEditorShell
      toolbar={
        <ResumeToolbar
          resumeId={documentId}
          message={message}
          onSetMessage={setMessage}
          resumePreviewId={resumePreviewId}
          onOpenShare={openShare}
          onOpenDelete={openDelete}
        />
      }
      modals={
        <ResumeEditorModals
          shareModalOpen={shareModalOpen}
          onShareModalClose={closeShare}
          deleteModalOpen={deleteModalOpen}
          onDeleteModalClose={closeDelete}
        />
      }
      contentPanel={<EditorContentPanel />}
      settingsPanel={<EditorSettingsPanel />}
      preview={preview}
      previewId={resumePreviewId}
      previewTitle={deferredResume.basics.fullName || "Untitled Resume"}
      settingsLabel="Style settings"
    />
  );
};

export default ResumeEditor;

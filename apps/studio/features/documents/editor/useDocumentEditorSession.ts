"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DocumentType } from "@/features/documents/core/document-types";
import type {
  SaveDocumentOptions,
  SaveDocumentResult,
} from "@/features/documents/services/local-storage-service";

import { getDocumentEditorPath } from "@/features/documents/core/routes";
import {
  startDocumentSyncWorker,
  subscribeToRemoteDeletions,
  hydrateCloudDocumentByIdToLocalStorage,
} from "@/features/documents/services/document-sync";
import {
  loadStateFor,
  INITIAL_LOAD_STATE,
  cloudLoadFailureState,
  type KeyedLoadState,
} from "@/features/documents/editor/editor-load-status";
import {
  describeSaveResult,
  SAVE_QUEUED_MESSAGE,
  SAVE_PERSISTED_MESSAGE,
} from "@/features/documents/services/save-failure-message";
import { loadWorkspaceSettingsFromLocalStorage } from "@/features/documents/services/workspace-settings";
import { useFlushPendingSavesOnExit } from "@/features/documents/editor/useFlushPendingSavesOnExit";

import { useUserStore } from "@/store/useUserStore";

interface DocumentEditorSessionOptions {
  type: DocumentType;
  documentId: string;
  /** Puts the locally stored document with this id into the editor store; false when absent. */
  loadIntoStore: (id: string) => boolean;
  saveToStorage: (options?: SaveDocumentOptions) => SaveDocumentResult;
  /** The store's document. Every change to it is autosaved once the session has loaded. */
  document: unknown;
  /**
   * The id of the document the store holds, when the store can outlive the route and still
   * hold the previous document after a client-side navigation.
   */
  storeDocumentId?: string | null;
}

/**
 * Everything an open document editor does besides rendering: resolve the URL id (local
 * first, then the cloud), autosave on a debounce and report the result, follow a document
 * that moved to a new id, react to remote deletions, run the sync worker, and flush pending
 * saves on exit.
 */
export function useDocumentEditorSession({
  type,
  documentId,
  loadIntoStore,
  saveToStorage,
  document,
  storeDocumentId,
}: DocumentEditorSessionOptions) {
  const router = useRouter();

  const hasHydratedRef = useRef(false);
  const lastSaveFailureRef = useRef<string | null>(null);

  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const accountAutoSync = useUserStore((state) => state.user?.autoSyncEnabled);

  const [loadState, setLoadState] = useState<KeyedLoadState>(INITIAL_LOAD_STATE);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [message, setMessage] = useState("Autosave ready");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const load = loadStateFor(loadState, documentId);
  const isReady =
    load.status === "ready" && (storeDocumentId === undefined || storeDocumentId === loadState.id);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!documentId) {
        setLoadState({ id: documentId, status: "not-found" });
        return;
      }

      if (loadIntoStore(documentId)) {
        hasHydratedRef.current = true;
        setLoadState({ id: documentId, status: "ready" });
        return;
      }

      const cloudResult = await hydrateCloudDocumentByIdToLocalStorage(type, documentId);

      if (cancelled) return;

      if (cloudResult.ok && loadIntoStore(documentId)) {
        hasHydratedRef.current = true;
        setLoadState({ id: documentId, status: "ready" });
        return;
      }

      // Deliberately no fallback to another document: autosave would then write the user's
      // edits onto a document the URL does not name.
      setLoadState({ id: documentId, ...cloudLoadFailureState(cloudResult) });
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [type, documentId, loadAttempt, loadIntoStore]);

  const retryLoad = useCallback(() => {
    setLoadState(INITIAL_LOAD_STATE);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const reportSaveResult = useCallback((failure: string | null) => {
    setMessage(failure ?? SAVE_PERSISTED_MESSAGE);

    // Only on transition — a persistent failure would otherwise toast per keystroke.
    if (failure && failure !== lastSaveFailureRef.current) {
      toast.error(failure);
    }

    lastSaveFailureRef.current = failure;
  }, []);

  // The document moved to a new id (its cloud copy had been deleted). The store switches to
  // it before the route does, so typing in between is saved to the new id, not the old one.
  const followMove = useCallback(
    (newId: string) => {
      // Already loaded: no "loading" flash that would unmount the field being typed in.
      if (loadIntoStore(newId)) {
        setLoadState({ id: newId, movedFrom: documentId, status: "ready" });
      }

      router.replace(getDocumentEditorPath(type, newId));
    },
    [type, documentId, router, loadIntoStore],
  );

  // A save refused because the document was deleted (here, or on another device by the sync
  // worker) has nothing left to edit: say so and leave the dead editor.
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
        if (detail.type !== type || detail.id !== documentId) return;

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
    [type, documentId, followMove, router],
  );

  // Autosave. A debounced save returns `{ queued: true }` before the write happens, so the
  // real result (a quota failure, or "Saved on this device") only ever comes from `onFlush`.
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

  useFlushPendingSavesOnExit(type);

  // Keyed on the ready state rather than a ref, so the worker starts even when the store
  // already held this document; `accountAutoSync` re-runs it when sign-in changes the setting
  // (`AuthInitializer` writes it to the workspace settings read here).
  useEffect(() => {
    if (!isReady || !isLoggedIn) return;

    startDocumentSyncWorker(type, {
      enabled: loadWorkspaceSettingsFromLocalStorage().autoSyncEnabled,
      idleDelayMs: 12_000,
    });
  }, [type, isReady, isLoggedIn, accountAutoSync, documentId]);

  // Stable identities so the memoised toolbar and modals can bail out.
  const openShare = useCallback(() => setShareModalOpen(true), []);
  const closeShare = useCallback(() => setShareModalOpen(false), []);
  const openDelete = useCallback(() => setDeleteModalOpen(true), []);
  const closeDelete = useCallback(() => setDeleteModalOpen(false), []);

  return {
    load,
    isReady,
    retryLoad,
    message,
    setMessage,
    shareModalOpen,
    openShare,
    closeShare,
    deleteModalOpen,
    openDelete,
    closeDelete,
  };
}

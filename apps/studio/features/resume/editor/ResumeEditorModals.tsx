"use client";

import { toast } from "sonner";
import { memo, useState } from "react";
import { useRouter } from "next/navigation";

import { useResumeStore } from "@/features/resume/store/resume-store";
import { getDocumentEditorPath } from "@/features/documents/core/routes";
import { trackUsageEvent } from "@/features/analytics/services/usage-metrics";
import { createResume, readResumeById } from "@/features/resume/services/resume-service";
import {
  deleteDocumentEverywhere,
  listDocumentIndexEntries,
} from "@/features/documents/services/document-workspace-service";

import ConfirmDialog, { documentDeleteNotice } from "@/components/modals/ConfirmDialog";
import ShareDocumentModal from "@/components/modals/ShareDocumentModal";

interface EditorModalsProps {
  shareModalOpen: boolean;
  onShareModalClose: () => void;
  deleteModalOpen: boolean;
  onDeleteModalClose: () => void;
}

/**
 * Memoised for the same reason as the toolbar: it hangs off the editor, which re-renders
 * on every keystroke, and it renders two modals whose props are otherwise unchanged.
 */
const EditorModals = memo(function EditorModals({
  shareModalOpen,
  onShareModalClose,
  deleteModalOpen,
  onDeleteModalClose,
}: EditorModalsProps) {
  const router = useRouter();
  const resume = useResumeStore((state) => state.resume);
  const setResume = useResumeStore((state) => state.setResume);
  const [isDeleting, setIsDeleting] = useState(false);

  async function onDeleteResume() {
    setIsDeleting(true);

    try {
      await deleteDocumentEverywhere("RESUME", resume);

      const nextId = listDocumentIndexEntries("RESUME")[0]?.id;
      const nextResume = nextId ? readResumeById(nextId) : null;

      if (!nextResume) {
        const fallback = await createResume();
        setResume(fallback);
        router.push(getDocumentEditorPath("RESUME", fallback.id));
      } else {
        setResume(nextResume);
        router.push(getDocumentEditorPath("RESUME", nextResume.id));
      }

      trackUsageEvent({ event: "resume_deleted" });
      toast.success("Resume deleted successfully");
      onDeleteModalClose();
    } catch (error) {
      toast.error(
        `Could not delete the resume: ${error instanceof Error ? error.message : "please try again."}`,
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      {shareModalOpen && (
        <ShareDocumentModal
          documentId={resume.id}
          documentType="RESUME"
          documentTitle={resume.basics.fullName || "Untitled Resume"}
          onClose={onShareModalClose}
        />
      )}

      <ConfirmDialog
        tone="destructive"
        confirmPhrase="DELETE"
        loading={isDeleting}
        open={deleteModalOpen}
        onConfirm={onDeleteResume}
        onClose={onDeleteModalClose}
        title={"Delete Resume?"}
        cancelLabel={`Keep ${resume.title || "resume"}`}
        description={documentDeleteNotice(Boolean(resume.sync.cloudDocumentId))}
      />
    </>
  );
});

export default EditorModals;

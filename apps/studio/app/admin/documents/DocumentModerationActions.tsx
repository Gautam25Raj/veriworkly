"use client";

import AdminActionDialog from "@/components/admin/AdminActionDialog";
import {
  deleteAdminDocument,
  restoreAdminDocument,
  updateAdminDocumentVisibility,
} from "@/features/admin/services/admin-actions";

import type { Visibility } from "@/features/admin/types/admin-types";

interface DocumentModerationActionsProps {
  documentId: string;
  title: string;
  visibility: Visibility;
  deleted: boolean;
}

/**
 * Moderation is deliberately one-directional: an admin can pull a document toward private but
 * never publish someone else's private document. The API enforces this too — the visibility
 * enum it accepts stops at UNLISTED.
 */
const DocumentModerationActions = ({
  documentId,
  title,
  visibility,
  deleted,
}: DocumentModerationActionsProps) => {
  if (deleted) {
    return (
      <AdminActionDialog
        trigger="Restore"
        triggerVariant="primary"
        title="Restore this document"
        description={`"${title}" becomes visible to its owner again.`}
        confirmLabel="Restore document"
        onConfirm={async (reason) => {
          await restoreAdminDocument(documentId, reason);
        }}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {visibility !== "PRIVATE" ? (
        <AdminActionDialog
          trigger="Make private"
          title="Force this document private"
          description={`"${title}" stops being reachable by anyone but its owner. Existing share links stop resolving.`}
          confirmLabel="Make private"
          onConfirm={async (reason) => {
            await updateAdminDocumentVisibility(documentId, "PRIVATE", reason);
          }}
        />
      ) : null}

      {visibility === "PUBLIC" ? (
        <AdminActionDialog
          trigger="Unlist"
          title="Unlist this document"
          description={`"${title}" stays reachable by direct link but is removed from public listings.`}
          confirmLabel="Unlist"
          onConfirm={async (reason) => {
            await updateAdminDocumentVisibility(documentId, "UNLISTED", reason);
          }}
        />
      ) : null}

      <AdminActionDialog
        trigger="Delete"
        triggerClassName="text-destructive"
        title="Delete this document"
        description={`"${title}" is soft-deleted — it disappears from the owner's workspace but can be restored from this page.`}
        confirmLabel="Delete document"
        onConfirm={async (reason) => {
          await deleteAdminDocument(documentId, reason);
        }}
      />
    </div>
  );
};

export default DocumentModerationActions;

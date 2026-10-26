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
        description={`"${title}" is restored on the server and its share links resolve again. A document whose content was already erased (30 days after deletion) cannot be restored.`}
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
          description={`"${title}" is set to private and a portfolio published from it is taken offline. Its existing share links keep working: revoke them on the Share links page to stop them.`}
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
        description={`"${title}" is deleted on the server: its share links stop resolving and a portfolio published from it is taken offline. A copy already in the owner's browser is not removed. It can be restored from this page until its content is erased, 30 days after deletion.`}
        confirmLabel="Delete document"
        onConfirm={async (reason) => {
          await deleteAdminDocument(documentId, reason);
        }}
      />
    </div>
  );
};

export default DocumentModerationActions;

import { prisma } from "#lib/prisma";
import { ADMIN_AUDIT_ACTIONS } from "#services/admin/adminAuditService";

/*
 * Kept apart from shareService on purpose: portfolioService needs this check too (a takedown must
 * stop a republish), and shareService pulls in userService and its auth configuration.
 */

/**
 * Whether the last moderation decision on this document made it private: the admin console's
 * "Make private" (a visibility decision whose new visibility is PRIVATE), or a portfolio takedown
 * (force-unpublish, which forces its document private; its audit entry names the document in
 * `metadata.documentId`). The audit entry is the record of it: nothing else tells a document a
 * moderator hid from one that is private because nobody ever shared it. A later "Make unlisted"
 * lifts either.
 */
export async function madePrivateByModerator(documentId: string) {
  const latest = await prisma.adminAuditEntry.findFirst({
    where: {
      OR: [
        {
          targetType: "Document",
          targetId: documentId,
          action: ADMIN_AUDIT_ACTIONS.documentVisibility,
        },
        {
          action: ADMIN_AUDIT_ACTIONS.portfolioUnpublish,
          metadata: { path: ["documentId"], equals: documentId },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { action: true, metadata: true },
  });
  if (!latest) return false;
  if (latest.action === ADMIN_AUDIT_ACTIONS.portfolioUnpublish) return true;

  const metadata = latest.metadata;

  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    metadata.visibility === "PRIVATE"
  );
}

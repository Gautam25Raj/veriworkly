import type { Prisma } from "@prisma/client";

import { prisma } from "#lib/prisma";
import { ADMIN_AUDIT_ACTIONS } from "#services/admin/adminAuditService";

/*
 * Kept apart from shareService on purpose: portfolioService needs this check too (a takedown must
 * stop a republish), and shareService pulls in userService and its auth configuration.
 */

type ModerationEntry = { action: string; targetId: string | null; metadata: Prisma.JsonValue };

function metadataField(metadata: Prisma.JsonValue, field: string) {
  return typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
    ? metadata[field]
    : undefined;
}

/** The document an entry is about: the visibility decision's target, or the takedown's document. */
function entryDocumentId(entry: ModerationEntry) {
  if (entry.action === ADMIN_AUDIT_ACTIONS.portfolioUnpublish) {
    const documentId = metadataField(entry.metadata, "documentId");
    return typeof documentId === "string" ? documentId : null;
  }
  return entry.targetId;
}

/** Whether the latest moderation entry about a document left it private. */
function leftPrivate(entry: ModerationEntry) {
  if (entry.action === ADMIN_AUDIT_ACTIONS.portfolioUnpublish) return true;
  return metadataField(entry.metadata, "visibility") === "PRIVATE";
}

/**
 * Which of these documents the last moderation decision made private: the admin console's "Make
 * private" (a visibility decision whose new visibility is PRIVATE), or a portfolio takedown
 * (force-unpublish, which forces its document private; its audit entry names the document in
 * `metadata.documentId`). The audit entry is the record of it: nothing else tells a document a
 * moderator hid from one that is private because nobody ever shared it. A later "Make unlisted"
 * lifts either. One query for the whole set, so an admin list page can carry it per row (V-199).
 */
export async function moderatorPrivateDocumentIds(documentIds: readonly string[]) {
  const ids = [...new Set(documentIds)];
  if (ids.length === 0) return new Set<string>();

  // One indexed read bounded to these ids: the visibility decisions by target, the takedowns by
  // the document their metadata names. Newest first (id as the tiebreak), so the first entry seen
  // per document is its latest.
  const entries = await prisma.$queryRaw<ModerationEntry[]>`
    SELECT "action", "targetId", "metadata"
    FROM "AdminAuditEntry"
    WHERE ("targetType" = 'Document'
        AND "action" = ${ADMIN_AUDIT_ACTIONS.documentVisibility}
        AND "targetId" = ANY(${ids}::text[]))
      OR ("action" = ${ADMIN_AUDIT_ACTIONS.portfolioUnpublish}
        AND "metadata"->>'documentId' = ANY(${ids}::text[]))
    ORDER BY "createdAt" DESC, "id" DESC
  `;

  const decided = new Set<string>();
  const privateIds = new Set<string>();
  for (const entry of entries) {
    const documentId = entryDocumentId(entry);
    if (!documentId || decided.has(documentId) || !ids.includes(documentId)) continue;
    decided.add(documentId);
    if (leftPrivate(entry)) privateIds.add(documentId);
  }
  return privateIds;
}

/** `moderatorPrivateDocumentIds` for one document. */
export async function madePrivateByModerator(documentId: string) {
  return (await moderatorPrivateDocumentIds([documentId])).has(documentId);
}

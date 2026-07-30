import { adminHandler } from "#controllers/admin/adminRequestHandler";

import * as AdminDocumentService from "#services/admin/adminDocumentService";
import { ADMIN_AUDIT_ACTIONS, recordAdminAudit } from "#services/admin/adminAuditService";

import { adminIdParamSchema } from "#validators/admin/adminCommonValidator";
import {
  adminDocumentDeleteSchema,
  adminDocumentListQuerySchema,
  adminDocumentVisibilitySchema,
  adminShareLinkListQuerySchema,
  adminShareLinkRevokeSchema,
} from "#validators/admin/adminDocumentValidator";

export const AdminDocumentController = {
  /** GET /admin/documents/summary */
  summary: adminHandler(
    () => AdminDocumentService.getDocumentSummary(),
    "Document summary fetched successfully",
  ),

  /** GET /admin/documents */
  list: adminHandler(async ({ req }) => {
    const query = adminDocumentListQuerySchema.parse(req.query);
    return AdminDocumentService.listDocuments(query);
  }, "Documents fetched successfully"),

  /** GET /admin/documents/:id — metadata and share links, never the résumé content itself. */
  detail: adminHandler(async ({ req }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    return AdminDocumentService.getDocumentDetail(id);
  }, "Document fetched successfully"),

  /** PATCH /admin/documents/:id — pull a document back to private or unlisted. */
  updateVisibility: adminHandler(async ({ req, actorId }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const input = adminDocumentVisibilitySchema.parse(req.body);

    const { document, previousVisibility } = await AdminDocumentService.updateDocumentVisibility(
      id,
      input.visibility,
    );

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.documentVisibility,
      targetType: "Document",
      targetId: id,
      reason: input.reason,
      metadata: {
        previousVisibility,
        visibility: input.visibility,
        ownerId: document.user.id,
      },
    });

    return document;
  }, "Document visibility updated successfully"),

  /** DELETE /admin/documents/:id — soft delete, reversible via the restore endpoint. */
  remove: adminHandler(async ({ req, actorId }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const input = adminDocumentDeleteSchema.parse(req.body);

    const document = await AdminDocumentService.softDeleteDocument(id);

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.documentDelete,
      targetType: "Document",
      targetId: id,
      reason: input.reason,
      metadata: { ownerId: document.user.id, title: document.title },
    });

    return document;
  }, "Document deleted successfully"),

  /** POST /admin/documents/:id/restore */
  restore: adminHandler(async ({ req, actorId }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const input = adminDocumentDeleteSchema.parse(req.body);

    const document = await AdminDocumentService.restoreDocument(id);

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.documentRestore,
      targetType: "Document",
      targetId: id,
      reason: input.reason,
      metadata: { ownerId: document.user.id, title: document.title },
    });

    return document;
  }, "Document restored successfully"),
};

export const AdminShareLinkController = {
  /** GET /admin/share-links */
  list: adminHandler(async ({ req }) => {
    const query = adminShareLinkListQuerySchema.parse(req.query);
    return AdminDocumentService.listShareLinks(query);
  }, "Share links fetched successfully"),

  /** DELETE /admin/share-links/:id — kills a public URL immediately. */
  revoke: adminHandler(async ({ req, actorId }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const input = adminShareLinkRevokeSchema.parse(req.body);

    const result = await AdminDocumentService.revokeShareLink(id);

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.shareLinkRevoke,
      targetType: "ShareLink",
      targetId: id,
      reason: input.reason,
      metadata: { slug: result.slug },
    });

    return result;
  }, "Share link revoked successfully"),
};

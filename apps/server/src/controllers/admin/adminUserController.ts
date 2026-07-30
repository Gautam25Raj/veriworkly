import { adminHandler } from "#controllers/admin/adminRequestHandler";

import * as AdminUserService from "#services/admin/adminUserService";
import { ADMIN_AUDIT_ACTIONS, recordAdminAudit } from "#services/admin/adminAuditService";

import { adminIdParamSchema } from "#validators/admin/adminCommonValidator";
import {
  adminUserDeleteSchema,
  adminUserListQuerySchema,
  adminUserSessionRevokeSchema,
  adminUserUpdateSchema,
} from "#validators/admin/adminUserValidator";

export const AdminUserController = {
  /** GET /admin/users — searchable, filterable roster. */
  list: adminHandler(async ({ req }) => {
    const query = adminUserListQuerySchema.parse(req.query);
    return AdminUserService.listUsers(query);
  }, "Users fetched successfully"),

  /** GET /admin/users/:id — full account view used by the support workflow. */
  detail: adminHandler(async ({ req }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    return AdminUserService.getUserDetail(id);
  }, "User fetched successfully"),

  /** PATCH /admin/users/:id — profile fields and role. */
  update: adminHandler(async ({ req, actorId }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const input = adminUserUpdateSchema.parse(req.body);

    const { user, previousRole } = await AdminUserService.updateUser(id, input);

    await recordAdminAudit({
      actorId,
      action:
        input.role && input.role !== previousRole
          ? ADMIN_AUDIT_ACTIONS.userRoleChange
          : ADMIN_AUDIT_ACTIONS.userUpdate,
      targetType: "User",
      targetId: id,
      reason: input.reason,
      metadata: {
        ...(input.role ? { previousRole, nextRole: input.role } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.emailVerified !== undefined ? { emailVerified: input.emailVerified } : {}),
        ...(input.autoSyncEnabled !== undefined ? { autoSyncEnabled: input.autoSyncEnabled } : {}),
      },
    });

    // A role change that leaves live sessions in place lets the user keep their old
    // privileges until every cached session expires.
    if (input.role && input.role !== previousRole) await AdminUserService.revokeUserSessions(id);

    return user;
  }, "User updated successfully"),

  /** POST /admin/users/:id/revoke-sessions — force sign-out everywhere. */
  revokeSessions: adminHandler(async ({ req, actorId }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const input = adminUserSessionRevokeSchema.parse(req.body);

    const result = await AdminUserService.revokeUserSessions(id);

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.userSessionsRevoke,
      targetType: "User",
      targetId: id,
      reason: input.reason,
      metadata: { revoked: result.revoked },
    });

    return result;
  }, "Sessions revoked successfully"),

  /** DELETE /admin/users/:id — permanent, cascading account deletion. */
  remove: adminHandler(async ({ req, actorId }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const input = adminUserDeleteSchema.parse(req.body);

    // Audited before the delete: `AdminAuditEntry.actorId` survives, but the target row will
    // not, so writing afterwards risks losing the record if the delete succeeds and the audit
    // write then fails.
    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.userDelete,
      targetType: "User",
      targetId: id,
      reason: input.reason,
      metadata: { confirmEmail: input.confirmEmail },
    });

    return AdminUserService.deleteUser(id, input.confirmEmail);
  }, "User deleted successfully"),
};

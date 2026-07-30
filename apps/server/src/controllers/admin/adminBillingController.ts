import { adminHandler } from "#controllers/admin/adminRequestHandler";

import * as AdminBillingService from "#services/admin/adminBillingService";
import { ADMIN_AUDIT_ACTIONS, recordAdminAudit } from "#services/admin/adminAuditService";

import { adminIdParamSchema } from "#validators/admin/adminCommonValidator";
import {
  adminCreditAdjustmentSchema,
  adminCreditWalletListQuerySchema,
  adminEntitlementListQuerySchema,
  adminEntitlementRevokeSchema,
  adminEntitlementSchema,
  adminSubscriptionListQuerySchema,
  adminSubscriptionUpdateSchema,
  adminWebhookListQuerySchema,
  adminWebhookReplaySchema,
} from "#validators/admin/adminBillingValidator";

export const AdminBillingController = {
  /** GET /admin/billing/summary — MRR-adjacent counters, credit float and webhook health. */
  summary: adminHandler(
    () => AdminBillingService.getBillingSummary(),
    "Billing summary fetched successfully",
  ),

  /** GET /admin/billing/subscriptions */
  listSubscriptions: adminHandler(async ({ req }) => {
    const query = adminSubscriptionListQuerySchema.parse(req.query);
    return AdminBillingService.listSubscriptions(query);
  }, "Subscriptions fetched successfully"),

  /**
   * PATCH /admin/billing/subscriptions/:id — support override for an account whose webhook
   * was lost. The provider stays authoritative: the next webhook will overwrite this.
   */
  updateSubscription: adminHandler(async ({ req, actorId }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const input = adminSubscriptionUpdateSchema.parse(req.body);

    const { subscription, previous } = await AdminBillingService.updateSubscription(id, input);

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.subscriptionUpdate,
      targetType: "Subscription",
      targetId: id,
      reason: input.reason,
      metadata: {
        userId: previous.userId,
        previousStatus: previous.status,
        ...(input.status ? { status: input.status } : {}),
        ...(input.cancelAtPeriodEnd !== undefined
          ? { cancelAtPeriodEnd: input.cancelAtPeriodEnd }
          : {}),
      },
    });

    return subscription;
  }, "Subscription updated successfully"),

  /** GET /admin/billing/credits — wallet balances across accounts. */
  listWallets: adminHandler(async ({ req }) => {
    const query = adminCreditWalletListQuerySchema.parse(req.query);
    return AdminBillingService.listCreditWallets(query);
  }, "Credit wallets fetched successfully"),

  /** POST /admin/billing/credits — grant (positive) or claw back (negative) credits. */
  adjustCredits: adminHandler(async ({ req, actorId }) => {
    const input = adminCreditAdjustmentSchema.parse(req.body);

    const transaction = await AdminBillingService.adjustCredits(
      input.userId,
      input.amount,
      input.reason,
    );

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.creditGrant,
      targetType: "User",
      targetId: input.userId,
      reason: input.reason,
      metadata: { amount: input.amount },
    });

    return transaction;
  }, "Credits adjusted successfully"),

  /** GET /admin/billing/entitlements */
  listEntitlements: adminHandler(async ({ req }) => {
    const query = adminEntitlementListQuerySchema.parse(req.query);
    return AdminBillingService.listEntitlements(query);
  }, "Entitlements fetched successfully"),

  /** POST /admin/billing/entitlements — manual grant, optionally time-boxed. */
  grantEntitlement: adminHandler(async ({ req, actorId }) => {
    const input = adminEntitlementSchema.parse(req.body);

    const grant = await AdminBillingService.grantEntitlement({ ...input, actorId });

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.entitlementGrant,
      targetType: "User",
      targetId: input.userId,
      reason: input.reason,
      metadata: { key: input.key, endsAt: input.endsAt ?? null, grantId: grant.id },
    });

    return grant;
  }, "Entitlement granted successfully"),

  /** DELETE /admin/billing/entitlements/:id */
  revokeEntitlement: adminHandler(async ({ req, actorId }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const input = adminEntitlementRevokeSchema.parse(req.body);

    const grant = await AdminBillingService.revokeEntitlement(id, input.reason, actorId);

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.entitlementRevoke,
      targetType: "EntitlementGrant",
      targetId: id,
      reason: input.reason,
      metadata: { key: grant.key, userId: grant.userId },
    });

    return grant;
  }, "Entitlement revoked successfully"),

  /** GET /admin/billing/webhooks — the provider event log, newest first. */
  listWebhooks: adminHandler(async ({ req }) => {
    const query = adminWebhookListQuerySchema.parse(req.query);
    return AdminBillingService.listWebhookEvents(query);
  }, "Webhook events fetched successfully"),

  /** GET /admin/billing/webhooks/:id — includes the raw provider payload. */
  webhookDetail: adminHandler(async ({ req }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    return AdminBillingService.getWebhookEvent(id);
  }, "Webhook event fetched successfully"),

  /** POST /admin/billing/webhooks/:id/replay — recovery path for a transiently failed event. */
  replayWebhook: adminHandler(async ({ req, actorId }) => {
    const { id } = adminIdParamSchema.parse(req.params);
    const input = adminWebhookReplaySchema.parse(req.body);

    const result = await AdminBillingService.replayWebhookEvent(id);

    await recordAdminAudit({
      actorId,
      action: ADMIN_AUDIT_ACTIONS.webhookReplay,
      targetType: "BillingWebhookEvent",
      targetId: id,
      reason: input.reason,
      metadata: { providerEventId: result.providerEventId, duplicate: result.duplicate },
    });

    return result;
  }, "Webhook event replayed successfully"),
};

import type { Prisma } from "@prisma/client";

import { prisma } from "#lib/prisma";
import { logger } from "#lib/logger";
import { toCreatedAtFilter } from "#validators/admin/adminCommonValidator";

import type { AdminAuditListQuery } from "#validators/admin/adminAuditValidator";

/**
 * Canonical action names. Every mutating admin endpoint writes one of these, so the audit
 * filter dropdown can be built from a constant instead of a `SELECT DISTINCT action` that
 * grows a new stray value each time someone hand-types a string at a call site.
 */
export const ADMIN_AUDIT_ACTIONS = {
  userUpdate: "user.update",
  userRoleChange: "user.role.change",
  userDelete: "user.delete",
  userSessionsRevoke: "user.sessions.revoke",

  affiliateUpdate: "affiliate.update",
  affiliateCommissionCreate: "affiliate.commission.create",
  affiliateCommissionUpdate: "affiliate.commission.update",
  affiliateWithdrawalUpdate: "affiliate.withdrawal.update",

  ambassadorApprove: "ambassador.application.approve",
  ambassadorReject: "ambassador.application.reject",

  portfolioStatusChange: "portfolio.status.change",
  portfolioUnpublish: "portfolio.unpublish",

  documentVisibility: "document.visibility.change",
  documentDelete: "document.delete",
  documentRestore: "document.restore",
  shareLinkRevoke: "share_link.revoke",

  subscriptionUpdate: "billing.subscription.update",
  creditGrant: "billing.credit.adjust",
  entitlementGrant: "billing.entitlement.grant",
  entitlementRevoke: "billing.entitlement.revoke",
  webhookReplay: "billing.webhook.replay",

  apiKeyUpdate: "api_key.update",
  apiKeyRevoke: "api_key.revoke",

  githubSync: "system.github.sync",
  cacheFlush: "system.cache.flush",

  // Roadmap and changelog writes publish directly to pages users read. They were the only
  // admin mutations that wrote no audit entry at all, which meant a public-facing edit was the
  // one action the log could not attribute.
  roadmapCreate: "roadmap.feature.create",
  roadmapUpdate: "roadmap.feature.update",
  roadmapDelete: "roadmap.feature.delete",

  changelogCreate: "changelog.entry.create",
  changelogUpdate: "changelog.entry.update",
  changelogDelete: "changelog.entry.delete",
  changelogSync: "changelog.sync",
} as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[keyof typeof ADMIN_AUDIT_ACTIONS];

export interface AdminAuditInput {
  actorId: string;
  action: AdminAuditAction;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Records an admin action.
 *
 * Deliberately never throws: an audit-write failure (Postgres hiccup, unique-index surprise)
 * must not roll back an operator action that already succeeded, or the caller would retry a
 * non-idempotent mutation. The failure is logged at error level so it still surfaces.
 */
export async function recordAdminAudit(input: AdminAuditInput) {
  try {
    return await prisma.adminAuditEntry.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        reason: input.reason ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    logger.error("Failed to write admin audit entry", { action: input.action, error });
    return null;
  }
}

export async function listAuditEntries(query: AdminAuditListQuery) {
  const where: Prisma.AdminAuditEntryWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.targetId ? { targetId: query.targetId } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(toCreatedAtFilter(query) ?? {}),
    ...(query.query
      ? {
          OR: [
            { action: { contains: query.query, mode: "insensitive" } },
            { targetType: { contains: query.query, mode: "insensitive" } },
            { targetId: { contains: query.query, mode: "insensitive" } },
            { reason: { contains: query.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.adminAuditEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
    prisma.adminAuditEntry.count({ where }),
  ]);

  return { items, total, limit: query.limit, offset: query.offset };
}

export async function getAuditFilters() {
  const [targetTypes, actors] = await Promise.all([
    prisma.adminAuditEntry.findMany({
      distinct: ["targetType"],
      select: { targetType: true },
      orderBy: { targetType: "asc" },
      take: 100,
    }),
    prisma.adminAuditEntry.findMany({
      distinct: ["actorId"],
      where: { actorId: { not: null } },
      select: { actor: { select: { id: true, name: true, email: true } } },
      take: 50,
    }),
  ]);

  return {
    actions: Object.values(ADMIN_AUDIT_ACTIONS),
    targetTypes: targetTypes.map((entry) => entry.targetType),
    actors: actors.map((entry) => entry.actor).filter((actor) => actor !== null),
  };
}

/** Recent activity strip shown on the admin overview. */
export async function getRecentAuditEntries(take = 15) {
  return prisma.adminAuditEntry.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
}

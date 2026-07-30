import { prisma } from "#lib/prisma";

import { getAffiliateSummary } from "#services/admin/adminAffiliateService";
import { getAmbassadorSummary } from "#services/admin/adminAmbassadorService";
import { getApiKeySummary } from "#services/admin/adminApiKeyService";
import { getBillingSummary } from "#services/admin/adminBillingService";
import { getDocumentSummary } from "#services/admin/adminDocumentService";
import { getPortfolioSummary } from "#services/admin/adminPortfolioService";
import { getRecentAuditEntries } from "#services/admin/adminAuditService";
import { getJobStatus, getSystemHealth } from "#services/admin/adminSystemService";

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function getUserSummary(days: number) {
  const since = daysAgo(days);
  const previousWindowStart = daysAgo(days * 2);

  const [total, newInWindow, previousWindow, byRole, verified, activeSessions] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: previousWindowStart, lt: since } } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
  ]);

  return {
    total,
    newInWindow,
    previousWindow,
    // Percent change against the immediately preceding window of the same length. A zero
    // baseline has no meaningful percentage, so it is reported as null rather than as Infinity.
    growthPercent:
      previousWindow === 0
        ? null
        : Number((((newInWindow - previousWindow) / previousWindow) * 100).toFixed(1)),
    byRole: Object.fromEntries(byRole.map((row) => [row.role, row._count._all])),
    verified,
    activeSessions,
  };
}

/**
 * The single payload behind `/admin` — every domain summary in one request.
 *
 * Each section is an independent aggregate query set, so this deliberately runs them in
 * parallel: serialized, the overview took long enough that the page felt broken on cold cache.
 */
export async function getAdminOverview(days: number) {
  const [
    users,
    billing,
    portfolios,
    documents,
    affiliates,
    ambassadors,
    apiKeys,
    jobs,
    health,
    recentActivity,
  ] = await Promise.all([
    getUserSummary(days),
    getBillingSummary(),
    getPortfolioSummary(),
    getDocumentSummary(),
    getAffiliateSummary(),
    getAmbassadorSummary(),
    getApiKeySummary(),
    getJobStatus(),
    getSystemHealth(),
    getRecentAuditEntries(15),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    windowDays: days,
    users,
    billing,
    portfolios,
    documents,
    affiliates,
    ambassadors,
    apiKeys,
    jobs,
    health,
    recentActivity,
    /**
     * Everything on this list is a queue an operator is expected to drain. It is computed here
     * rather than in the UI so the nav badge and the dashboard can never disagree.
     */
    actionQueue: {
      pendingAmbassadorApplications: ambassadors.pending,
      pendingWithdrawals: affiliates.pendingWithdrawals.count,
      pendingCommissions: affiliates.commissionsByStatus.PENDING?.count ?? 0,
      failedWebhooks: billing.webhooks.failed,
      suspendedPortfolios: portfolios.suspended,
      pendingPortfolioAssets: jobs.pendingPortfolioAssets,
    },
  };
}

/**
 * Recent signups, publishes and subscriptions in one strip. Separate from the overview because
 * it is cheap to poll and the summary aggregates are not.
 */
export async function getRecentActivity() {
  const [signups, publications, subscriptions, applications] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, image: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.portfolioPublication.findMany({
      select: {
        id: true,
        subdomain: true,
        status: true,
        publishedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 10,
    }),
    prisma.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIALING"] } },
      select: {
        id: true,
        productKey: true,
        status: true,
        interval: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.ambassadorApplication.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        collegeName: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return { signups, publications, subscriptions, applications };
}

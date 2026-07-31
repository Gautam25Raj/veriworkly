import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Card } from "@veriworkly/ui";

import { AuthInitializer } from "@/providers/auth-provider";
import AdminActionButtons from "@/app/admin/components/AdminActionButtons";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";

import { fetchCurrentUser } from "@/features/auth/services/current-user";
import {
  fetchAdminOverview,
  fetchAdminRecentActivity,
} from "@/features/admin/services/admin-server";
import {
  formatCents,
  formatCompactNumber,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  humanizeKey,
} from "@/features/admin/utils/admin-format";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Monitor platform metrics, moderation queues, and admin controls.",
  robots: { index: false, follow: false },
};

/** Queues an operator is expected to drain, each linking to the page that can drain it. */
const ACTION_QUEUE_ITEMS: Array<{
  key: keyof Awaited<ReturnType<typeof fetchAdminOverview>>["actionQueue"];
  label: string;
  href: string;
}> = [
  {
    key: "pendingAmbassadorApplications",
    label: "Ambassador applications",
    href: "/admin/ambassadors?status=PENDING",
  },
  {
    key: "pendingWithdrawals",
    label: "Affiliate withdrawals",
    href: "/admin/affiliates/withdrawals?status=REQUESTED",
  },
  {
    key: "pendingCommissions",
    label: "Commissions to review",
    href: "/admin/affiliates/commissions?status=PENDING",
  },
  {
    key: "failedWebhooks",
    label: "Failed webhooks",
    href: "/admin/billing/webhooks?status=FAILED",
  },
  {
    key: "suspendedPortfolios",
    label: "Suspended portfolios",
    href: "/admin/portfolios?status=SUSPENDED",
  },
  { key: "pendingPortfolioAssets", label: "Pending assets", href: "/admin/system" },
];

export default async function AdminPage() {
  const [user, overview, activity] = await Promise.all([
    fetchCurrentUser(),
    fetchAdminOverview(30),
    fetchAdminRecentActivity(),
  ]);

  const openQueues = ACTION_QUEUE_ITEMS.filter((item) => overview.actionQueue[item.key] > 0);

  return (
    <>
      <AuthInitializer initialUser={user} />

      <div className="space-y-8">
        <AdminPageHeader
          eyebrow="Admin Control Panel"
          title="Operations Dashboard"
          description={`Signed in as ${user?.email ?? "admin"}. Figures cover the last ${overview.windowDays} days unless stated otherwise.`}
          actions={<AdminActionButtons />}
        />

        {/* Anything needing a human decision is surfaced first — everything below is context. */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-foreground text-lg font-semibold tracking-tight">
              Needs attention
            </h2>

            <AdminStatusBadge status={overview.health.status} />
          </div>

          {openQueues.length === 0 ? (
            <Card className="rounded-3xl p-6">
              <p className="text-muted text-sm">
                Every queue is clear — no pending applications, payouts, or failed webhooks.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {openQueues.map((item) => (
                <AdminStatCard
                  key={item.key}
                  label={item.label}
                  value={formatNumber(overview.actionQueue[item.key])}
                  tone={item.key === "failedWebhooks" ? "critical" : "warning"}
                  hint="Open the queue"
                  href={item.href}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-foreground text-lg font-semibold tracking-tight">Platform</h2>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label="Total users"
              value={formatNumber(overview.users.total)}
              hint={`${formatNumber(overview.users.newInWindow)} new · ${formatPercent(overview.users.growthPercent)} vs previous period`}
              tone={
                overview.users.growthPercent !== null && overview.users.growthPercent < 0
                  ? "warning"
                  : "default"
              }
              href="/admin/users"
            />

            <AdminStatCard
              label="Paying subscriptions"
              value={formatNumber(overview.billing.subscriptions.paying)}
              hint={`${formatNumber(overview.billing.subscriptions.cancelingAtPeriodEnd)} canceling at period end`}
              href="/admin/billing"
            />

            <AdminStatCard
              label="Live portfolios"
              value={formatNumber(overview.portfolios.live)}
              hint={`${formatCompactNumber(overview.portfolios.views.last30Days)} views in 30 days`}
              href="/admin/portfolios?status=LIVE"
            />

            <AdminStatCard
              label="Documents"
              value={formatNumber(overview.documents.active)}
              hint={`${formatNumber(overview.documents.shareLinks)} share links · ${formatCompactNumber(overview.documents.shareViews)} views`}
              href="/admin/documents"
            />

            <AdminStatCard
              label="Affiliate payouts owed"
              value={formatCents(
                overview.affiliates.wallets.pendingCents +
                  overview.affiliates.wallets.availableCents,
              )}
              hint={`${formatCents(overview.affiliates.wallets.paidCents)} paid to date`}
              href="/admin/affiliates"
            />

            <AdminStatCard
              label="Active ambassadors"
              value={formatNumber(overview.ambassadors.activeAmbassadors)}
              hint={`${formatNumber(overview.ambassadors.applicationsLast7Days)} applications in 7 days`}
              href="/admin/ambassadors/roster"
            />

            <AdminStatCard
              label="Credit float"
              value={formatNumber(overview.billing.credits.balance)}
              hint={`${formatNumber(overview.billing.credits.spentLast30Days)} spent in 30 days`}
              href="/admin/billing/credits"
            />

            <AdminStatCard
              label="Active API keys"
              value={formatNumber(overview.apiKeys.active)}
              hint={`${formatNumber(overview.apiKeys.usedLast7Days)} used in 7 days`}
              href="/admin/api-keys"
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Users by role</h3>

            <div className="space-y-2 text-sm">
              {Object.entries(overview.users.byRole).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <AdminStatusBadge status={role} />
                  <span className="text-foreground font-medium">{formatNumber(count)}</span>
                </div>
              ))}

              <div className="border-border/60 flex items-center justify-between border-t pt-2">
                <span className="text-muted">Verified email</span>
                <span className="text-foreground font-medium">
                  {formatNumber(overview.users.verified)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted">Active sessions</span>
                <span className="text-foreground font-medium">
                  {formatNumber(overview.users.activeSessions)}
                </span>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">System</h3>

            <div className="space-y-2 text-sm">
              {overview.health.checks.map((check) => (
                <div key={check.name} className="flex items-center justify-between">
                  <span className="text-muted">{humanizeKey(check.name)}</span>

                  <span className="flex items-center gap-2">
                    <span className="text-muted text-xs">{check.latencyMs}ms</span>
                    <AdminStatusBadge status={check.status} />
                  </span>
                </div>
              ))}

              <div className="border-border/60 flex items-center justify-between border-t pt-2">
                <span className="text-muted">Uptime</span>
                <span className="text-foreground font-medium">
                  {formatDuration(overview.health.uptimeSeconds)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted">Last usage-metric flush</span>
                <span className="text-foreground font-medium">
                  {formatRelativeTime(overview.jobs.lastUsageMetricFlush?.createdAt)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted">Last view flush</span>
                <span className="text-foreground font-medium">
                  {formatRelativeTime(overview.jobs.lastViewFlush?.createdAt)}
                </span>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold tracking-tight">Newest signups</h3>
              <Link href="/admin/users" className="text-accent text-xs font-semibold">
                View all
              </Link>
            </div>

            <div className="divide-border/50 divide-y">
              {activity.signups.length === 0 ? (
                <p className="text-muted py-4 text-sm">No signups yet.</p>
              ) : (
                activity.signups.map((signup) => (
                  <div key={signup.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/users/${signup.id}`}
                        className="text-foreground truncate text-sm font-medium hover:underline"
                      >
                        {signup.name || signup.email}
                      </Link>
                      <p className="text-muted truncate text-xs">{signup.email}</p>
                    </div>

                    <span className="text-muted shrink-0 text-xs">
                      {formatRelativeTime(signup.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold tracking-tight">Recently published</h3>
              <Link href="/admin/portfolios" className="text-accent text-xs font-semibold">
                View all
              </Link>
            </div>

            <div className="divide-border/50 divide-y">
              {activity.publications.length === 0 ? (
                <p className="text-muted py-4 text-sm">No published portfolios yet.</p>
              ) : (
                activity.publications.map((publication) => (
                  <div
                    key={publication.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/portfolios/${publication.id}`}
                        className="text-foreground truncate text-sm font-medium hover:underline"
                      >
                        {publication.subdomain}
                      </Link>
                      <p className="text-muted truncate text-xs">
                        {publication.user.name || publication.user.email}
                      </p>
                    </div>

                    <span className="flex shrink-0 items-center gap-2">
                      <AdminStatusBadge status={publication.status} />
                      <span className="text-muted text-xs">
                        {formatRelativeTime(publication.publishedAt)}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>

        <Card className="space-y-3 rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground font-semibold tracking-tight">Recent admin activity</h3>
            <Link href="/admin/audit" className="text-accent text-xs font-semibold">
              Open audit log
            </Link>
          </div>

          <div className="divide-border/50 divide-y">
            {overview.recentActivity.length === 0 ? (
              <p className="text-muted py-4 text-sm">No admin actions recorded yet.</p>
            ) : (
              overview.recentActivity.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Badge className="bg-background/70">{humanizeKey(entry.action)}</Badge>

                  <span className="text-muted text-xs">
                    {entry.targetType}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </span>

                  <span className="text-muted ml-auto text-xs">
                    {entry.actor?.email ?? "system"} · {formatRelativeTime(entry.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

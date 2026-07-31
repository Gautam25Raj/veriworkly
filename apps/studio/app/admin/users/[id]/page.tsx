import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@veriworkly/ui";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import UserAdminActions from "@/app/admin/users/[id]/UserAdminActions";

import { fetchAdminUserDetail } from "@/features/admin/services/admin-server";
import {
  formatCents,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  humanizeKey,
  truncate,
} from "@/features/admin/utils/admin-format";

export const metadata: Metadata = {
  title: "Admin · User",
  robots: { index: false, follow: false },
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const detail = await fetchAdminUserDetail(id).catch(() => null);
  if (!detail) notFound();

  const { user } = detail;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="User"
        title={user.name || user.email}
        description={`${user.email} · joined ${formatDate(user.createdAt)} · id ${user.id}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge status={user.role} />
            <AdminStatusBadge status={user.emailVerified ? "ACTIVE" : "PENDING"} />
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Documents" value={formatNumber(user._count.resumes)} />
        <AdminStatCard label="Share links" value={formatNumber(user._count.shareLinks)} />
        <AdminStatCard
          label="Credit balance"
          value={formatNumber(detail.credits.wallet?.balance ?? 0)}
          hint={`${formatNumber(detail.credits.wallet?.reserved ?? 0)} reserved`}
        />
        <AdminStatCard
          label="Affiliate earnings"
          value={formatCents(detail.affiliate.wallet?.paidCents ?? 0)}
          hint={`${formatCents(detail.affiliate.wallet?.availableCents ?? 0)} available`}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Account</h3>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Username</dt>
                <dd className="text-foreground">{user.username || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Auto sync</dt>
                <dd className="text-foreground">{user.autoSyncEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Affiliate code</dt>
                <dd className="text-foreground">{user.affiliateCode || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Affiliate status</dt>
                <dd>
                  <AdminStatusBadge status={user.affiliateStatus} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Ambassador</dt>
                <dd>
                  <AdminStatusBadge status={user.ambassadorStatus} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Last GitHub import</dt>
                <dd className="text-foreground">{formatRelativeTime(user.lastGithubImportAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Subscriptions</h3>

            {detail.subscriptions.length === 0 ? (
              <p className="text-muted text-sm">No subscription history.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {detail.subscriptions.map((subscription) => (
                  <div
                    key={subscription.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <p className="text-foreground font-medium">{subscription.productKey}</p>
                      <p className="text-muted text-xs">
                        {subscription.provider} · {subscription.interval ?? "no interval"}
                        {subscription.cancelAtPeriodEnd ? " · cancels at period end" : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-muted text-xs">
                        renews {formatDate(subscription.currentPeriodEnd)}
                      </span>
                      <AdminStatusBadge status={subscription.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Entitlements</h3>

            {detail.entitlements.length === 0 ? (
              <p className="text-muted text-sm">No active entitlements.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {detail.entitlements.map((grant) => (
                  <div
                    key={grant.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <span className="text-foreground font-medium">{humanizeKey(grant.key)}</span>

                    <span className="text-muted text-xs">
                      {grant.source} · expires {grant.endsAt ? formatDate(grant.endsAt) : "never"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Documents</h3>

            {detail.documents.length === 0 ? (
              <p className="text-muted text-sm">No documents.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {detail.documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/documents?query=${document.id}`}
                        className="text-foreground truncate font-medium hover:underline"
                      >
                        {document.title}
                      </Link>
                      <p className="text-muted text-xs">
                        {humanizeKey(document.type)} · updated{" "}
                        {formatRelativeTime(document.updatedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {document.deletedAt ? <AdminStatusBadge status="REJECTED" /> : null}
                      <AdminStatusBadge status={document.visibility} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Credit transactions</h3>

            {detail.credits.transactions.length === 0 ? (
              <p className="text-muted text-sm">No credit activity.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {detail.credits.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">
                        {humanizeKey(transaction.type)}
                        {transaction.action ? ` · ${humanizeKey(transaction.action)}` : ""}
                      </p>
                      <p className="text-muted truncate text-xs">
                        {truncate(transaction.reason, 70)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={
                          transaction.amount >= 0
                            ? "font-medium text-emerald-600"
                            : "font-medium text-red-600"
                        }
                      >
                        {transaction.amount >= 0 ? "+" : ""}
                        {formatNumber(transaction.amount)}
                      </p>
                      <p className="text-muted text-xs">
                        balance {formatNumber(transaction.balanceAfter)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Admin history</h3>

            {detail.auditEntries.length === 0 ? (
              <p className="text-muted text-sm">No admin actions against this account.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {detail.auditEntries.map((entry) => (
                  <div key={entry.id} className="space-y-0.5 py-2.5 text-sm">
                    <p className="text-foreground font-medium">{humanizeKey(entry.action)}</p>
                    <p className="text-muted text-xs">
                      {entry.actor?.email ?? "system"} · {formatDateTime(entry.createdAt)}
                      {entry.reason ? ` · ${entry.reason}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <UserAdminActions detail={detail} />

          {detail.publication ? (
            <Card className="space-y-2 rounded-3xl p-6">
              <h3 className="text-foreground font-semibold tracking-tight">Portfolio</h3>

              <Link
                href={`/admin/portfolios/${detail.publication.id}`}
                className="text-accent text-sm font-medium hover:underline"
              >
                {detail.publication.subdomain}
              </Link>

              <AdminStatusBadge status={detail.publication.status} />

              {detail.publication.suspensionReason ? (
                <p className="text-muted text-xs">{detail.publication.suspensionReason}</p>
              ) : null}
            </Card>
          ) : null}

          {detail.ambassadorApplication ? (
            <Card className="space-y-2 rounded-3xl p-6">
              <h3 className="text-foreground font-semibold tracking-tight">Ambassador</h3>

              <Link
                href={`/admin/ambassadors/${detail.ambassadorApplication.id}`}
                className="text-accent text-sm font-medium hover:underline"
              >
                {detail.ambassadorApplication.collegeName}
              </Link>

              <AdminStatusBadge status={detail.ambassadorApplication.status} />
            </Card>
          ) : null}

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">API keys</h3>

            {detail.apiKeys.length === 0 ? (
              <p className="text-muted text-sm">No API keys.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {detail.apiKeys.map((key) => (
                  <div key={key.id} className="space-y-1 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground font-medium">{key.name}</span>
                      <AdminStatusBadge
                        status={key.revokedAt ? "REJECTED" : key.isActive ? "ACTIVE" : "INACTIVE"}
                      />
                    </div>
                    <p className="text-muted font-mono text-xs">
                      {key.keyPrefix}…{key.keySuffix}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Sessions</h3>

            {detail.sessions.length === 0 ? (
              <p className="text-muted text-sm">No active sessions.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {detail.sessions.map((session) => (
                  <div key={session.id} className="space-y-0.5 py-2 text-xs">
                    <p className="text-foreground">{session.ipAddress || "unknown ip"}</p>
                    <p className="text-muted">{truncate(session.userAgent, 44)}</p>
                    <p className="text-muted">expires {formatRelativeTime(session.expiresAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

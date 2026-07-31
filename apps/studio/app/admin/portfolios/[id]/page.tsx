import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@veriworkly/ui";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import PortfolioModerationActions from "@/app/admin/portfolios/PortfolioModerationActions";

import { fetchAdminPortfolioDetail } from "@/features/admin/services/admin-server";
import {
  formatCompactNumber,
  formatDate,
  formatDateTime,
  formatNumber,
  humanizeKey,
} from "@/features/admin/utils/admin-format";

export const metadata: Metadata = {
  title: "Admin · Portfolio",
  robots: { index: false, follow: false },
};

export default async function AdminPortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = await fetchAdminPortfolioDetail(id, 30).catch(() => null);
  if (!data) notFound();

  const { publication, totalViews, dailyViews, topReferrers, auditEntries } = data;

  const peakDay = dailyViews.reduce((max, point) => (point.count > max ? point.count : max), 0);

  const windowViews = dailyViews.reduce((sum, point) => sum + point.count, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Portfolio"
        title={publication.subdomain}
        description={`${publication.document.title} · template ${publication.templateId} · published ${formatDate(publication.publishedAt)}`}
        actions={
          <PortfolioModerationActions
            publicationId={publication.id}
            subdomain={publication.subdomain}
            status={publication.status}
          />
        }
      />

      {publication.status === "SUSPENDED" && publication.suspensionReason ? (
        <Card className="rounded-3xl border-red-500/30 bg-red-500/5 p-5">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Suspended {formatDateTime(publication.suspendedAt)}
          </p>
          <p className="text-muted mt-1 text-sm">{publication.suspensionReason}</p>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Lifetime views" value={formatCompactNumber(totalViews)} />
        <AdminStatCard label="Views (30d)" value={formatCompactNumber(windowViews)} />
        <AdminStatCard label="Peak day" value={formatNumber(peakDay)} />
        <AdminStatCard
          label="Published revision"
          value={formatNumber(publication.publishedRevision)}
          hint={`Document is at revision ${publication.document.revision}`}
          tone={
            publication.document.revision > publication.publishedRevision ? "warning" : "default"
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="space-y-4 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Views, last 30 days</h3>

            {dailyViews.length === 0 ? (
              <p className="text-muted text-sm">No views recorded in this window.</p>
            ) : (
              /* A bar per day. Heights are relative to the peak so a quiet portfolio still
                 shows shape rather than a flat line of 1px bars. */
              <div className="flex h-40 items-end gap-1">
                {dailyViews.map((point) => (
                  <div
                    key={point.date}
                    className="bg-accent/70 hover:bg-accent min-h-[2px] flex-1 rounded-t transition"
                    style={{ height: `${peakDay ? (point.count / peakDay) * 100 : 0}%` }}
                    title={`${point.date}: ${point.count} view(s)`}
                  />
                ))}
              </div>
            )}

            {dailyViews.length > 0 ? (
              <div className="text-muted flex justify-between text-xs">
                <span>{dailyViews[0]?.date}</span>
                <span>{dailyViews[dailyViews.length - 1]?.date}</span>
              </div>
            ) : null}
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Moderation history</h3>

            {auditEntries.length === 0 ? (
              <p className="text-muted text-sm">No admin actions on this portfolio.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {auditEntries.map((entry) => (
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
          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Owner</h3>

            <Link
              href={`/admin/users/${publication.user.id}`}
              className="text-accent text-sm font-medium hover:underline"
            >
              {publication.user.name || publication.user.email}
            </Link>

            <p className="text-muted text-xs">{publication.user.email}</p>

            <div className="flex items-center gap-2">
              <AdminStatusBadge status={publication.user.role} />
              <span className="text-muted text-xs">
                joined {formatDate(publication.user.createdAt)}
              </span>
            </div>
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Top referrers (30d)</h3>

            {topReferrers.length === 0 ? (
              <p className="text-muted text-sm">No referrer data.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {topReferrers.map((referrer) => (
                  <div key={referrer.host} className="flex items-center justify-between gap-3">
                    <span className="text-muted truncate">{referrer.host}</span>
                    <span className="text-foreground font-medium">
                      {formatNumber(referrer.count)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-2 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Source document</h3>

            <p className="text-foreground text-sm">{publication.document.title}</p>
            <AdminStatusBadge status={publication.document.visibility} />

            <Link
              href={`/admin/documents?query=${publication.document.id}`}
              className="text-accent block text-xs font-semibold hover:underline"
            >
              Open in documents →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

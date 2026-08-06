import type { Metadata } from "next";
import Link from "next/link";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import Panel from "@/components/admin/Panel";
import { CacheFlushControls, GithubSyncControls } from "@/app/admin/system/SystemActions";

import {
  fetchAdminGithubStatus,
  fetchAdminJobStatus,
  fetchAdminRequestLogs,
  fetchAdminSystemHealth,
  fetchAdminUsageMetrics,
} from "@/features/admin/services/admin-server";
import type { AdminRequestLogRow } from "@/features/admin/types/admin-types";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelativeTime,
  humanizeKey,
  truncate,
} from "@/features/admin/utils/admin-format";

export const metadata: Metadata = {
  title: "Admin · System",
  robots: { index: false, follow: false },
};

const logColumns: Array<AdminTableColumn<AdminRequestLogRow>> = [
  {
    key: "request",
    header: "Request",
    render: (row) => (
      <div className="min-w-0">
        <p className="text-foreground truncate font-mono text-xs">
          {row.method} {row.path}
        </p>
        <p className="text-muted truncate text-xs">{row.ip ?? "unknown ip"}</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span
        className={
          row.status >= 500
            ? "text-destructive font-medium"
            : row.status >= 400
              ? "text-warning font-medium"
              : "text-muted"
        }
      >
        {row.status}
      </span>
    ),
  },
  {
    key: "error",
    header: "Error",
    hideOnMobile: true,
    className: "max-w-sm",
    render: (row) => (
      <span className="text-destructive text-xs">{row.error ? truncate(row.error, 80) : "—"}</span>
    ),
  },
  {
    key: "when",
    header: "When",
    render: (row) => (
      <span className="text-muted text-xs whitespace-nowrap">{formatDateTime(row.createdAt)}</span>
    ),
  },
];

export default async function AdminSystemPage() {
  const [health, jobs, metrics, github, errorLogs] = await Promise.all([
    fetchAdminSystemHealth(),
    fetchAdminJobStatus(),
    fetchAdminUsageMetrics({ days: 14 }),
    fetchAdminGithubStatus(),
    // Only the failures — a full request log is noise on an ops page.
    fetchAdminRequestLogs({ errorsOnly: "true", limit: 15 }),
  ]);

  // Roll the per-event series up to a daily total for the sparkline.
  const dailyTotals = new Map<string, number>();
  for (const point of metrics.series) {
    dailyTotals.set(point.date, (dailyTotals.get(point.date) ?? 0) + point.count);
  }

  const dailySeries = [...dailyTotals.entries()].sort(([a], [b]) => a.localeCompare(b));
  const peak = dailySeries.reduce((max, [, count]) => (count > max ? count : max), 0);

  const topEvents = Object.entries(metrics.totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Platform"
        title="System & operations"
        description="Dependency health, background job freshness, usage metrics, and the controls to force a GitHub sync or flush a cache prefix."
        actions={<AdminStatusBadge status={health.status} />}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Uptime"
          value={formatDuration(health.uptimeSeconds)}
          hint={`Node ${health.nodeVersion}`}
        />
        <AdminStatCard
          label="Memory (RSS)"
          value={formatBytes(health.memory.rssBytes)}
          hint={`${formatBytes(health.memory.heapUsedBytes)} heap in use`}
        />
        <AdminStatCard
          label="Unresolved webhooks"
          value={formatNumber(jobs.unresolvedWebhookEvents)}
          tone={jobs.unresolvedWebhookEvents > 0 ? "warning" : "default"}
          href="/admin/billing/webhooks?status=FAILED"
        />
        <AdminStatCard
          label="Pending assets"
          value={formatNumber(jobs.pendingPortfolioAssets)}
          hint="Uploads that never completed"
        />
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="space-y-3 rounded-xl p-4">
          <h3 className="text-foreground font-semibold tracking-tight">Dependencies</h3>

          <div className="space-y-2 text-sm">
            {health.checks.map((check) => (
              <div key={check.name} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">{humanizeKey(check.name)}</span>

                  <span className="flex items-center gap-2">
                    <span className="text-muted text-xs">{check.latencyMs}ms</span>
                    <AdminStatusBadge status={check.status} />
                  </span>
                </div>

                {check.error ? <p className="text-destructive text-xs">{check.error}</p> : null}
              </div>
            ))}
          </div>

          <p className="text-muted border-border/60 border-t pt-3 text-xs">
            Checked {formatRelativeTime(health.timestamp)}
          </p>
        </Panel>

        <Panel className="space-y-3 rounded-xl p-4">
          <h3 className="text-foreground font-semibold tracking-tight">Background jobs</h3>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Usage-metric flush</span>
              <span className="text-foreground">
                {formatRelativeTime(jobs.lastUsageMetricFlush?.createdAt)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">View flush</span>
              <span className="text-foreground">
                {formatRelativeTime(jobs.lastViewFlush?.createdAt)}
              </span>
            </div>
          </div>

          <p className="text-muted border-border/60 border-t pt-3 text-xs leading-5">
            Both run nightly. A timestamp older than about a day means the scheduler has stopped.
          </p>
        </Panel>

        <Panel className="space-y-3 rounded-xl p-4">
          <h3 className="text-foreground font-semibold tracking-tight">GitHub sync</h3>

          {github.latestSync ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Last run</span>
                <span className="text-foreground">
                  {formatRelativeTime(github.latestSync.syncedAt)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Result</span>
                <span className="text-foreground">{github.latestSync.lastSyncStatus ?? "—"}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Issues / PRs</span>
                <span className="text-foreground">
                  {formatNumber(github.latestSync.issueCount)} /{" "}
                  {formatNumber(github.latestSync.prCount)}
                </span>
              </div>

              {github.latestSync.lastError ? (
                <p className="text-destructive text-xs">{github.latestSync.lastError}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted text-sm">No sync has run yet.</p>
          )}

          <div className="border-border/60 border-t pt-3">
            <GithubSyncControls nextSyncAt={github.latestSync?.nextSyncAt ?? null} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
        <Panel className="space-y-4 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground font-semibold tracking-tight">
              Usage events, last 14 days
            </h3>
            <span className="text-muted text-xs">
              {formatNumber(dailySeries.reduce((sum, [, count]) => sum + count, 0))} events
            </span>
          </div>

          {dailySeries.length === 0 ? (
            <p className="text-muted text-sm">No usage metrics recorded in this window.</p>
          ) : (
            <>
              <div className="flex h-32 items-end gap-1">
                {dailySeries.map(([date, count]) => (
                  <div
                    key={date}
                    className="bg-accent/70 hover:bg-accent min-h-[2px] flex-1 rounded-t transition"
                    style={{ height: `${peak ? (count / peak) * 100 : 0}%` }}
                    title={`${date}: ${count} event(s)`}
                  />
                ))}
              </div>

              <div className="text-muted flex justify-between text-xs">
                <span>{dailySeries[0]?.[0]}</span>
                <span>{dailySeries[dailySeries.length - 1]?.[0]}</span>
              </div>
            </>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel className="space-y-3 rounded-xl p-4">
            <h3 className="text-foreground font-semibold tracking-tight">Top events (all time)</h3>

            {topEvents.length === 0 ? (
              <p className="text-muted text-sm">No events recorded.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {topEvents.map(([event, count]) => (
                  <div key={event} className="flex items-center justify-between gap-3">
                    <span className="text-muted truncate">{humanizeKey(event)}</span>
                    <span className="text-foreground font-medium">{formatNumber(count)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="space-y-3 rounded-xl p-4">
            <h3 className="text-foreground font-semibold tracking-tight">Cache</h3>
            <CacheFlushControls />
          </Panel>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-foreground text-lg font-semibold tracking-tight">
            Recent request errors
          </h3>

          <Link href="/admin/audit" className="text-accent text-xs font-semibold">
            Admin audit log →
          </Link>
        </div>

        <AdminTable
          columns={logColumns}
          rows={errorLogs.items}
          rowKey={(row) => row.id}
          emptyMessage="No request errors logged."
          caption="Requests the API answered with an error, newest first."
        />
      </section>
    </div>
  );
}

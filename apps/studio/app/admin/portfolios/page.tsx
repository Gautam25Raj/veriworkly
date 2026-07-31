import type { Metadata } from "next";
import Link from "next/link";

import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import PortfolioModerationActions from "@/app/admin/portfolios/PortfolioModerationActions";

import { fetchAdminOverview, fetchAdminPortfolios } from "@/features/admin/services/admin-server";
import type { AdminPortfolioRow } from "@/features/admin/types/admin-types";
import {
  formatCompactNumber,
  formatNumber,
  formatRelativeTime,
} from "@/features/admin/utils/admin-format";
import {
  toSingleValueParams,
  type AdminSearchParams,
} from "@/features/admin/utils/admin-search-params";

export const metadata: Metadata = {
  title: "Admin · Portfolios",
  robots: { index: false, follow: false },
};

const FILTERS = [
  {
    name: "status",
    label: "Status",
    options: [
      { label: "Any status", value: "" },
      { label: "Live", value: "LIVE" },
      { label: "Grace", value: "GRACE" },
      { label: "Suspended", value: "SUSPENDED" },
    ],
  },
  {
    name: "sort",
    label: "Sort",
    options: [
      { label: "Recently updated", value: "updated" },
      { label: "Newest published", value: "newest" },
      { label: "Most viewed (this page)", value: "views" },
    ],
  },
];

const columns: Array<AdminTableColumn<AdminPortfolioRow>> = [
  {
    key: "portfolio",
    header: "Portfolio",
    render: (row) => (
      <div className="min-w-0">
        <Link
          href={`/admin/portfolios/${row.id}`}
          className="text-foreground font-medium hover:underline"
        >
          {row.subdomain}
        </Link>
        <p className="text-muted truncate text-xs">{row.document.title}</p>
      </div>
    ),
  },
  {
    key: "owner",
    header: "Owner",
    render: (row) => (
      <div className="min-w-0">
        <Link
          href={`/admin/users/${row.user.id}`}
          className="text-foreground text-sm hover:underline"
        >
          {row.user.name || row.user.email}
        </Link>
        <p className="text-muted truncate text-xs">{row.user.email}</p>
      </div>
    ),
  },
  {
    key: "template",
    header: "Template",
    hideOnMobile: true,
    render: (row) => <span className="text-muted text-xs">{row.templateId}</span>,
  },
  {
    key: "views",
    header: "Views",
    hideOnMobile: true,
    render: (row) => (
      <span className="text-foreground text-sm">{formatCompactNumber(row.totalViews)}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <div className="space-y-1">
        <AdminStatusBadge status={row.status} />
        <p className="text-muted text-xs">updated {formatRelativeTime(row.updatedAt)}</p>
      </div>
    ),
  },
  {
    key: "actions",
    header: "",
    className: "text-right",
    render: (row) => (
      <PortfolioModerationActions
        compact
        publicationId={row.id}
        subdomain={row.subdomain}
        status={row.status}
      />
    ),
  },
];

export default async function AdminPortfoliosPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = toSingleValueParams(await searchParams);

  const [overview, data] = await Promise.all([
    fetchAdminOverview(30),
    fetchAdminPortfolios(params),
  ]);

  const summary = overview.portfolios;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Content"
        title="Published portfolios"
        description="Every live subdomain, who owns it, how much traffic it gets, and the moderation controls to take one down."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Live"
          value={formatNumber(summary.live)}
          hint={`${formatNumber(summary.publishedLast30Days)} published in 30 days`}
          tone="positive"
        />
        <AdminStatCard
          label="Suspended"
          value={formatNumber(summary.suspended)}
          tone={summary.suspended > 0 ? "warning" : "default"}
          href="/admin/portfolios?status=SUSPENDED"
        />
        <AdminStatCard
          label="Views (30d)"
          value={formatCompactNumber(summary.views.last30Days)}
          hint={`${formatCompactNumber(summary.views.last7Days)} in the last 7 days`}
        />
        <AdminStatCard
          label="Lifetime views"
          value={formatCompactNumber(summary.views.total)}
          hint={
            summary.topTemplates[0]
              ? `Top template: ${summary.topTemplates[0].templateId}`
              : undefined
          }
        />
      </section>

      <AdminFilterBar
        basePath="/admin/portfolios"
        searchPlaceholder="Subdomain, owner email, or document title"
        selects={FILTERS}
      />

      <AdminTable
        columns={columns}
        rows={data.items}
        rowKey={(row) => row.id}
        emptyMessage="No portfolios match these filters."
      />

      <AdminPagination
        total={data.total}
        limit={data.limit}
        offset={data.offset}
        basePath="/admin/portfolios"
        params={params}
      />
    </div>
  );
}

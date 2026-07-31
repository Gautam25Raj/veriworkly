import type { Metadata } from "next";
import Link from "next/link";

import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import ApiKeyActions from "@/app/admin/api-keys/ApiKeyActions";

import { fetchAdminApiKeySummary, fetchAdminApiKeys } from "@/features/admin/services/admin-server";
import type { AdminApiKeyRow } from "@/features/admin/types/admin-types";
import { formatDate, formatNumber, formatRelativeTime } from "@/features/admin/utils/admin-format";
import {
  toSingleValueParams,
  type AdminSearchParams,
} from "@/features/admin/utils/admin-search-params";

export const metadata: Metadata = {
  title: "Admin · API keys",
  robots: { index: false, follow: false },
};

const FILTERS = [
  {
    name: "active",
    label: "State",
    options: [
      { label: "Any", value: "" },
      { label: "Active", value: "true" },
      { label: "Disabled or revoked", value: "false" },
    ],
  },
  {
    name: "sort",
    label: "Sort",
    options: [
      { label: "Newest", value: "newest" },
      { label: "Recently used", value: "lastUsed" },
    ],
  },
];

const columns: Array<AdminTableColumn<AdminApiKeyRow>> = [
  {
    key: "key",
    header: "Key",
    render: (row) => (
      <div className="min-w-0">
        <p className="text-foreground truncate font-medium">{row.name}</p>
        <p className="text-muted truncate font-mono text-xs">
          {row.keyPrefix}…{row.keySuffix}
        </p>
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
    key: "scopes",
    header: "Scopes",
    hideOnMobile: true,
    className: "max-w-xs",
    render: (row) => <span className="text-muted text-xs">{row.scopes.join(", ") || "none"}</span>,
  },
  {
    key: "limit",
    header: "Rate limit",
    hideOnMobile: true,
    render: (row) => <span className="text-muted text-xs">{formatNumber(row.rateLimit)}/min</span>,
  },
  {
    key: "state",
    header: "State",
    render: (row) => (
      <div className="space-y-1">
        <AdminStatusBadge
          status={row.revokedAt ? "REJECTED" : row.isActive ? "ACTIVE" : "INACTIVE"}
        />
        <p className="text-muted text-xs">used {formatRelativeTime(row.lastUsed)}</p>
      </div>
    ),
  },
  {
    key: "expires",
    header: "Expires",
    hideOnMobile: true,
    render: (row) => <span className="text-muted text-xs">{formatDate(row.expiresAt)}</span>,
  },
  {
    key: "actions",
    header: "",
    className: "text-right",
    render: (row) => (
      <ApiKeyActions
        id={row.id}
        name={row.name}
        isActive={row.isActive}
        revoked={Boolean(row.revokedAt)}
      />
    ),
  },
];

export default async function AdminApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = toSingleValueParams(await searchParams);

  const [summary, data] = await Promise.all([fetchAdminApiKeySummary(), fetchAdminApiKeys(params)]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Platform"
        title="API keys"
        description="Every issued key, its scopes, and its quota. Key material is never readable here — only the prefix and suffix are stored in a form this page can show."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard label="Total" value={formatNumber(summary.total)} />
        <AdminStatCard label="Active" value={formatNumber(summary.active)} tone="positive" />
        <AdminStatCard label="Revoked" value={formatNumber(summary.revoked)} />
        <AdminStatCard
          label="Expired"
          value={formatNumber(summary.expired)}
          tone={summary.expired > 0 ? "warning" : "default"}
        />
        <AdminStatCard label="Used (7d)" value={formatNumber(summary.usedLast7Days)} />
      </section>

      <AdminFilterBar
        basePath="/admin/api-keys"
        searchPlaceholder="Key name, prefix, or owner email"
        selects={FILTERS}
      />

      <AdminTable
        columns={columns}
        rows={data.items}
        rowKey={(row) => row.id}
        emptyMessage="No API keys match these filters."
      />

      <AdminPagination
        total={data.total}
        limit={data.limit}
        offset={data.offset}
        basePath="/admin/api-keys"
        params={params}
      />
    </div>
  );
}

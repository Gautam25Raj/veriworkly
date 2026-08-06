import type { Metadata } from "next";
import Link from "next/link";

import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import ShareLinkActions from "@/app/admin/share-links/ShareLinkActions";

import { fetchAdminShareLinks } from "@/features/admin/services/admin-server";
import type { AdminShareLinkRow } from "@/features/admin/types/admin-types";
import {
  formatDate,
  formatNumber,
  formatRelativeTime,
  humanizeKey,
} from "@/features/admin/utils/admin-format";
import {
  toSingleValueParams,
  type AdminSearchParams,
} from "@/features/admin/utils/admin-search-params";

export const metadata: Metadata = {
  title: "Admin · Share links",
  robots: { index: false, follow: false },
};

const FILTERS = [
  {
    name: "sort",
    label: "Sort",
    options: [
      { label: "Newest", value: "newest" },
      { label: "Most viewed", value: "views" },
    ],
  },
];

const columns: Array<AdminTableColumn<AdminShareLinkRow>> = [
  {
    key: "link",
    header: "Share link",
    render: (row) => (
      <div className="min-w-0">
        <p className="text-foreground truncate font-medium">{row.slug}</p>
        <p className="text-muted truncate text-xs">
          {row.document.title} · {humanizeKey(row.document.type)}
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
    key: "protection",
    header: "Protection",
    hideOnMobile: true,
    render: (row) => (
      <div className="flex flex-wrap items-center gap-1">
        {row.passwordProtected ? (
          <AdminStatusBadge status="ACTIVE" tone="info" />
        ) : (
          <span className="text-muted text-xs">Open</span>
        )}
        {row.expiresAt ? (
          <span className="text-muted text-xs">expires {formatDate(row.expiresAt)}</span>
        ) : null}
      </div>
    ),
  },
  {
    key: "views",
    header: "Views",
    render: (row) => (
      <div>
        <p className="text-foreground text-sm">{formatNumber(row.viewCount)}</p>
        <p className="text-muted text-xs">last {formatRelativeTime(row.lastViewedAt)}</p>
      </div>
    ),
  },
  {
    key: "actions",
    header: "",
    className: "text-right",
    render: (row) => <ShareLinkActions id={row.id} slug={row.slug} />,
  },
];

export default async function AdminShareLinksPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = toSingleValueParams(await searchParams);
  const data = await fetchAdminShareLinks(params);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Content"
        title="Share links"
        description="Public document URLs, how much traffic each gets, and whether it is password protected. Revoking a link kills the URL immediately."
        actions={
          <Link href="/admin/documents" className="text-accent text-sm font-semibold">
            ← Documents
          </Link>
        }
      />

      <AdminFilterBar
        basePath="/admin/share-links"
        searchPlaceholder="Slug, document title, or owner email"
        selects={FILTERS}
      />

      <AdminTable
        columns={columns}
        rows={data.items}
        rowKey={(row) => row.id}
        emptyMessage="No share links match these filters."
      />

      <AdminPagination
        total={data.total}
        limit={data.limit}
        offset={data.offset}
        basePath="/admin/share-links"
        params={params}
      />
    </div>
  );
}

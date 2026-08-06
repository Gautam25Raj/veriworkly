import type { Metadata } from "next";
import Link from "next/link";

import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import DocumentModerationActions from "@/app/admin/documents/DocumentModerationActions";

import { fetchAdminDocuments, fetchAdminOverview } from "@/features/admin/services/admin-server";
import type { AdminDocumentRow } from "@/features/admin/types/admin-types";
import {
  formatCompactNumber,
  formatNumber,
  formatRelativeTime,
  humanizeKey,
} from "@/features/admin/utils/admin-format";
import {
  toSingleValueParams,
  type AdminSearchParams,
} from "@/features/admin/utils/admin-search-params";

export const metadata: Metadata = {
  title: "Admin · Documents",
  robots: { index: false, follow: false },
};

const FILTERS = [
  {
    name: "type",
    label: "Type",
    options: [
      { label: "Any type", value: "" },
      { label: "Resume", value: "RESUME" },
      { label: "Cover letter", value: "COVER_LETTER" },
      { label: "Portfolio", value: "PORTFOLIO" },
      { label: "Link in bio", value: "LINK_IN_BIO" },
    ],
  },
  {
    name: "visibility",
    label: "Visibility",
    options: [
      { label: "Any", value: "" },
      { label: "Private", value: "PRIVATE" },
      { label: "Unlisted", value: "UNLISTED" },
      { label: "Public", value: "PUBLIC" },
    ],
  },
  {
    name: "includeDeleted",
    label: "Deleted",
    options: [
      { label: "Hide deleted", value: "" },
      { label: "Include deleted", value: "true" },
    ],
  },
  {
    name: "sort",
    label: "Sort",
    options: [
      { label: "Recently updated", value: "updated" },
      { label: "Newest", value: "newest" },
    ],
  },
];

const columns: Array<AdminTableColumn<AdminDocumentRow>> = [
  {
    key: "document",
    header: "Document",
    render: (row) => (
      <div className="min-w-0">
        <p className="text-foreground truncate font-medium">{row.title}</p>
        <p className="text-muted truncate text-xs">
          {humanizeKey(row.type)} · {row.slug}
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
    key: "visibility",
    header: "Visibility",
    render: (row) => (
      <div className="flex flex-wrap items-center gap-1">
        <AdminStatusBadge status={row.visibility} />
        {row.deletedAt ? <AdminStatusBadge status="REJECTED" tone="danger" /> : null}
      </div>
    ),
  },
  {
    key: "shares",
    header: "Shares",
    hideOnMobile: true,
    render: (row) => (
      <span className="text-muted text-xs">{formatNumber(row._count.shareLinks)}</span>
    ),
  },
  {
    key: "updated",
    header: "Updated",
    hideOnMobile: true,
    render: (row) => (
      <span className="text-muted text-xs">{formatRelativeTime(row.updatedAt)}</span>
    ),
  },
  {
    key: "actions",
    header: "",
    className: "text-right",
    render: (row) => (
      <DocumentModerationActions
        documentId={row.id}
        title={row.title}
        visibility={row.visibility}
        deleted={Boolean(row.deletedAt)}
      />
    ),
  },
];

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = toSingleValueParams(await searchParams);

  const [overview, data] = await Promise.all([fetchAdminOverview(30), fetchAdminDocuments(params)]);

  const summary = overview.documents;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Content"
        title="Documents"
        description="Every resume, cover letter, and portfolio draft on the platform. Moderation can only reduce a document's reach — never widen it."
        actions={
          <Link href="/admin/share-links" className="text-accent text-sm font-semibold">
            Share links →
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Active documents"
          value={formatNumber(summary.active)}
          hint={`${formatNumber(summary.createdLast30Days)} created in 30 days`}
        />
        <AdminStatCard
          label="Soft-deleted"
          value={formatNumber(summary.softDeleted)}
          href="/admin/documents?includeDeleted=true"
        />
        <AdminStatCard
          label="Public / unlisted"
          value={formatNumber(
            (summary.byVisibility.PUBLIC ?? 0) + (summary.byVisibility.UNLISTED ?? 0),
          )}
          hint={`${formatNumber(summary.byVisibility.PRIVATE ?? 0)} private`}
        />
        <AdminStatCard
          label="Share link views"
          value={formatCompactNumber(summary.shareViews)}
          hint={`${formatNumber(summary.shareLinks)} links`}
          href="/admin/share-links"
        />
      </section>

      <AdminFilterBar
        basePath="/admin/documents"
        searchPlaceholder="Title, slug, document id, or owner email"
        selects={FILTERS}
      />

      <AdminTable
        columns={columns}
        rows={data.items}
        rowKey={(row) => row.id}
        emptyMessage="No documents match these filters."
      />

      <AdminPagination
        total={data.total}
        limit={data.limit}
        offset={data.offset}
        basePath="/admin/documents"
        params={params}
      />
    </div>
  );
}

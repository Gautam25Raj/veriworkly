import type { Metadata } from "next";
import Link from "next/link";

import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";

import { fetchAdminReferrals } from "@/features/admin/services/admin-server";
import type { AdminReferralRow } from "@/features/admin/types/admin-types";
import { formatDateTime, formatRelativeTime } from "@/features/admin/utils/admin-format";
import {
  toSingleValueParams,
  type AdminSearchParams,
} from "@/features/admin/utils/admin-search-params";

export const metadata: Metadata = {
  title: "Admin · Referrals",
  robots: { index: false, follow: false },
};

const FILTERS = [
  {
    name: "status",
    label: "Status",
    options: [
      { label: "Any status", value: "" },
      { label: "Signed up", value: "SIGNED_UP" },
      { label: "Converted", value: "CONVERTED" },
      { label: "Rejected", value: "REJECTED" },
    ],
  },
];

const columns: Array<AdminTableColumn<AdminReferralRow>> = [
  {
    key: "affiliate",
    header: "Affiliate",
    render: (row) => (
      <div className="min-w-0">
        <Link
          href={`/admin/affiliates/${row.affiliate.id}`}
          className="text-foreground font-medium hover:underline"
        >
          {row.affiliate.name || row.affiliate.email}
        </Link>
        <p className="text-muted truncate text-xs">{row.code}</p>
      </div>
    ),
  },
  {
    key: "referred",
    header: "Referred user",
    render: (row) => (
      <div className="min-w-0">
        <Link
          href={`/admin/users/${row.referredUser.id}`}
          className="text-foreground text-sm hover:underline"
        >
          {row.referredUser.name || row.referredUser.email}
        </Link>
        <p className="text-muted truncate text-xs">
          joined {formatRelativeTime(row.referredUser.createdAt)}
        </p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <AdminStatusBadge status={row.status} />,
  },
  {
    key: "converted",
    header: "Converted",
    hideOnMobile: true,
    render: (row) => (
      <span className="text-muted text-xs">
        {row.convertedAt ? formatDateTime(row.convertedAt) : "—"}
      </span>
    ),
  },
  {
    key: "created",
    header: "Referred",
    hideOnMobile: true,
    render: (row) => <span className="text-muted text-xs">{formatDateTime(row.createdAt)}</span>,
  },
];

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = toSingleValueParams(await searchParams);
  const data = await fetchAdminReferrals(params);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Revenue"
        title="Affiliate referrals"
        description="Every signup attributed to an affiliate code, and whether it has converted into a paying customer."
        actions={
          <Link href="/admin/affiliates" className="text-accent text-sm font-semibold">
            ← Affiliates
          </Link>
        }
      />

      <AdminFilterBar basePath="/admin/affiliates/referrals" selects={FILTERS} />

      <AdminTable
        columns={columns}
        rows={data.items}
        rowKey={(row) => row.id}
        emptyMessage="No referrals match these filters."
      />

      <AdminPagination
        total={data.total}
        limit={data.limit}
        offset={data.offset}
        basePath="/admin/affiliates/referrals"
        params={params}
      />
    </div>
  );
}

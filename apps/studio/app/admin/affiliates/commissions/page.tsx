import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@veriworkly/ui";

import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import { CommissionActions, CommissionCreateForm } from "@/app/admin/affiliates/AffiliateActions";

import { fetchAdminCommissions } from "@/features/admin/services/admin-server";
import type { AdminCommissionRow } from "@/features/admin/types/admin-types";
import { formatCents, formatDateTime } from "@/features/admin/utils/admin-format";
import {
  toSingleValueParams,
  type AdminSearchParams,
} from "@/features/admin/utils/admin-search-params";

export const metadata: Metadata = {
  title: "Admin · Commissions",
  robots: { index: false, follow: false },
};

const FILTERS = [
  {
    name: "status",
    label: "Status",
    options: [
      { label: "Any status", value: "" },
      { label: "Pending", value: "PENDING" },
      { label: "Available", value: "AVAILABLE" },
      { label: "Paid", value: "PAID" },
      { label: "Reversed", value: "REVERSED" },
    ],
  },
];

const columns: Array<AdminTableColumn<AdminCommissionRow>> = [
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
        <p className="text-muted truncate text-xs">{row.affiliate.affiliateCode || "no code"}</p>
      </div>
    ),
  },
  {
    key: "referred",
    header: "Referred user",
    hideOnMobile: true,
    render: (row) => (
      <span className="text-muted text-xs">{row.referral?.referredUser.email ?? "—"}</span>
    ),
  },
  {
    key: "amount",
    header: "Commission",
    render: (row) => (
      <div>
        <p className="text-foreground font-medium">{formatCents(row.amountCents)}</p>
        <p className="text-muted text-xs">{(row.rateBps / 100).toFixed(1)}% rate</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <div className="space-y-1">
        <AdminStatusBadge status={row.status} />
        <p className="text-muted text-xs">{formatDateTime(row.createdAt)}</p>
      </div>
    ),
  },
  {
    key: "actions",
    header: "",
    className: "text-right",
    render: (row) => (
      <CommissionActions id={row.id} status={row.status} amountCents={row.amountCents} />
    ),
  },
];

export default async function AdminCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = toSingleValueParams(await searchParams);
  const data = await fetchAdminCommissions(params);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Revenue"
        title="Affiliate commissions"
        description="Release pending commissions once the underlying payment has settled, or reverse them if it was refunded."
        actions={
          <Link href="/admin/affiliates" className="text-accent text-sm font-semibold">
            ← Affiliates
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <AdminFilterBar basePath="/admin/affiliates/commissions" selects={FILTERS} />

          <AdminTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No commissions match these filters."
            caption={`${formatCents(data.totalAmountCents)} across ${data.total} matching commission(s).`}
          />

          <AdminPagination
            total={data.total}
            limit={data.limit}
            offset={data.offset}
            basePath="/admin/affiliates/commissions"
            params={params}
          />
        </div>

        <Card className="h-fit space-y-4 rounded-3xl p-6">
          <div>
            <h3 className="text-foreground font-semibold tracking-tight">Manual commission</h3>
            <p className="text-muted mt-1 text-xs leading-5">
              For a payment that never produced a webhook. The referral must already exist and the
              affiliate must be active.
            </p>
          </div>

          <CommissionCreateForm />
        </Card>
      </div>
    </div>
  );
}

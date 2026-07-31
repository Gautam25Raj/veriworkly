import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@veriworkly/ui";

import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import AdminTable, { type AdminTableColumn } from "@/components/admin/AdminTable";
import { EntitlementGrantForm, EntitlementRevokeAction } from "@/app/admin/billing/BillingActions";

import { fetchAdminEntitlements } from "@/features/admin/services/admin-server";
import type { AdminEntitlementRow } from "@/features/admin/types/admin-types";
import { formatDate, humanizeKey } from "@/features/admin/utils/admin-format";
import {
  toSingleValueParams,
  type AdminSearchParams,
} from "@/features/admin/utils/admin-search-params";

export const metadata: Metadata = {
  title: "Admin · Entitlements",
  robots: { index: false, follow: false },
};

const FILTERS = [
  {
    name: "key",
    label: "Entitlement",
    options: [
      { label: "Any", value: "" },
      { label: "Portfolio publish", value: "portfolio_publish" },
      { label: "AI credits", value: "ai_credits" },
      { label: "Custom subdomain", value: "custom_subdomain" },
      { label: "SEO controls", value: "seo_controls" },
      { label: "Analytics", value: "analytics" },
      { label: "Watermark removal", value: "watermark_removal" },
    ],
  },
  {
    name: "active",
    label: "State",
    options: [
      { label: "Any", value: "" },
      { label: "Active only", value: "true" },
      { label: "Expired or revoked", value: "false" },
    ],
  },
];

/** An entitlement is live only when it has started, has not been revoked, and has not lapsed. */
function isActive(grant: AdminEntitlementRow) {
  if (grant.revokedAt) return false;
  if (new Date(grant.startsAt).getTime() > Date.now()) return false;

  return !grant.endsAt || new Date(grant.endsAt).getTime() > Date.now();
}

const columns: Array<AdminTableColumn<AdminEntitlementRow>> = [
  {
    key: "user",
    header: "Account",
    render: (row) => (
      <div className="min-w-0">
        <Link
          href={`/admin/users/${row.user.id}`}
          className="text-foreground font-medium hover:underline"
        >
          {row.user.name || row.user.email}
        </Link>
        <p className="text-muted truncate text-xs">{row.user.email}</p>
      </div>
    ),
  },
  {
    key: "key",
    header: "Entitlement",
    render: (row) => (
      <div>
        <p className="text-foreground text-sm">{humanizeKey(row.key)}</p>
        <p className="text-muted text-xs">{humanizeKey(row.source)}</p>
      </div>
    ),
  },
  {
    key: "window",
    header: "Window",
    hideOnMobile: true,
    render: (row) => (
      <span className="text-muted text-xs">
        {formatDate(row.startsAt)} → {row.endsAt ? formatDate(row.endsAt) : "no expiry"}
      </span>
    ),
  },
  {
    key: "state",
    header: "State",
    render: (row) => (
      <AdminStatusBadge
        status={row.revokedAt ? "REJECTED" : isActive(row) ? "ACTIVE" : "INACTIVE"}
      />
    ),
  },
  {
    key: "actions",
    header: "",
    className: "text-right",
    render: (row) => (
      <EntitlementRevokeAction
        id={row.id}
        entitlementKey={row.key}
        revoked={Boolean(row.revokedAt)}
      />
    ),
  },
];

export default async function AdminEntitlementsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  const params = toSingleValueParams(await searchParams);
  const data = await fetchAdminEntitlements(params);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Revenue"
        title="Entitlements"
        description="Feature access grants, whether they came from a subscription or a manual override. Revoking one takes effect immediately."
        actions={
          <Link href="/admin/billing" className="text-accent text-sm font-semibold">
            ← Billing
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <AdminFilterBar basePath="/admin/billing/entitlements" selects={FILTERS} />

          <AdminTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No entitlement grants match these filters."
          />

          <AdminPagination
            total={data.total}
            limit={data.limit}
            offset={data.offset}
            basePath="/admin/billing/entitlements"
            params={params}
          />
        </div>

        <Card className="h-fit space-y-4 rounded-3xl p-6">
          <div>
            <h3 className="text-foreground font-semibold tracking-tight">Grant entitlement</h3>
            <p className="text-muted mt-1 text-xs leading-5">
              A manual grant sits alongside subscription-derived access rather than replacing it.
              Leave the date empty for a permanent grant.
            </p>
          </div>

          <EntitlementGrantForm />
        </Card>
      </div>
    </div>
  );
}

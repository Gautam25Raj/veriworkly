import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@veriworkly/ui";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatCard from "@/components/admin/AdminStatCard";
import AdminStatusBadge from "@/components/admin/AdminStatusBadge";
import { AffiliateStandingActions } from "@/app/admin/affiliates/AffiliateActions";

import { fetchAdminAffiliateDetail } from "@/features/admin/services/admin-server";
import {
  formatCents,
  formatDate,
  formatDateTime,
  formatNumber,
} from "@/features/admin/utils/admin-format";

export const metadata: Metadata = {
  title: "Admin · Affiliate",
  robots: { index: false, follow: false },
};

export default async function AdminAffiliateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const data = await fetchAdminAffiliateDetail(id).catch(() => null);
  if (!data) notFound();

  const { affiliate, referrals, commissions, withdrawals, topReferrerHosts } = data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Affiliate"
        title={affiliate.name || affiliate.email}
        description={`${affiliate.email} · code ${affiliate.affiliateCode || "none"} · enrolled ${formatDate(affiliate.affiliateEnrolledAt)}`}
        actions={
          <AffiliateStandingActions
            userId={affiliate.id}
            status={affiliate.affiliateStatus}
            tier={affiliate.affiliateTier}
            email={affiliate.email}
          />
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard
          label="Pending"
          value={formatCents(affiliate.affiliateWallet?.pendingCents ?? 0)}
        />
        <AdminStatCard
          label="Available"
          value={formatCents(affiliate.affiliateWallet?.availableCents ?? 0)}
          tone="positive"
        />
        <AdminStatCard
          label="Paid"
          value={formatCents(affiliate.affiliateWallet?.paidCents ?? 0)}
        />
        <AdminStatCard
          label="Referrals"
          value={formatNumber(affiliate._count.affiliateReferrals)}
        />
        <AdminStatCard label="Clicks" value={formatNumber(affiliate._count.affiliateClicks)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card className="space-y-3 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold tracking-tight">Commissions</h3>
              <Link
                href={`/admin/affiliates/commissions?affiliateId=${affiliate.id}`}
                className="text-accent text-xs font-semibold"
              >
                Manage
              </Link>
            </div>

            {commissions.length === 0 ? (
              <p className="text-muted text-sm">No commissions yet.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {commissions.slice(0, 15).map((commission) => (
                  <div
                    key={commission.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <p className="text-foreground font-medium">
                        {formatCents(commission.amountCents)}
                      </p>
                      <p className="text-muted text-xs">
                        {(commission.rateBps / 100).toFixed(1)}% ·{" "}
                        {formatDateTime(commission.createdAt)}
                      </p>
                    </div>

                    <AdminStatusBadge status={commission.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Referrals</h3>

            {referrals.length === 0 ? (
              <p className="text-muted text-sm">No referrals yet.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {referrals.slice(0, 20).map((referral) => (
                  <div
                    key={referral.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/users/${referral.referredUser.id}`}
                        className="text-foreground truncate font-medium hover:underline"
                      >
                        {referral.referredUser.email}
                      </Link>
                      <p className="text-muted text-xs">{formatDateTime(referral.createdAt)}</p>
                    </div>

                    <AdminStatusBadge status={referral.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3 rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground font-semibold tracking-tight">Withdrawals</h3>
              <Link
                href="/admin/affiliates/withdrawals"
                className="text-accent text-xs font-semibold"
              >
                Manage
              </Link>
            </div>

            {withdrawals.length === 0 ? (
              <p className="text-muted text-sm">No withdrawal requests.</p>
            ) : (
              <div className="divide-border/50 divide-y">
                {withdrawals.map((withdrawal) => (
                  <div
                    key={withdrawal.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                  >
                    <div>
                      <p className="text-foreground font-medium">
                        {formatCents(withdrawal.amountCents)}
                      </p>
                      <p className="text-muted text-xs">{formatDateTime(withdrawal.createdAt)}</p>
                    </div>

                    <AdminStatusBadge status={withdrawal.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Top referrer hosts</h3>

            {topReferrerHosts.length === 0 ? (
              <p className="text-muted text-sm">No click sources recorded.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {topReferrerHosts.map((host) => (
                  <div key={host.host} className="flex items-center justify-between gap-3">
                    <span className="text-muted truncate">{host.host}</span>
                    <span className="text-foreground font-medium">{formatNumber(host.clicks)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-2 rounded-3xl p-6">
            <h3 className="text-foreground font-semibold tracking-tight">Account</h3>

            <Link
              href={`/admin/users/${affiliate.id}`}
              className="text-accent text-sm font-medium hover:underline"
            >
              Open full account →
            </Link>

            <div className="flex items-center gap-2">
              <AdminStatusBadge status={affiliate.affiliateStatus} />
              <AdminStatusBadge status={affiliate.affiliateTier} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

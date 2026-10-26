import type { AffiliateStatus, AffiliateTier } from "@/features/admin/types/admin-types";

export type AffiliateDashboard = {
  affiliateStatus: AffiliateStatus;
  affiliateTier: AffiliateTier;
  affiliateCode: string | null;
  clicks: number;
  conversions: number;
  wallet: { pendingCents: number; availableCents: number; paidCents: number };
  minimumWithdrawalCents: number;
  tierProgress: { currentConversions: number; nextTierConversions: number | null };
  tiers: Array<{
    key: string;
    name: string;
    rateBps: number;
    requiredConversions: number;
    perks: readonly string[];
  }>;
  // `totalReferrals` is the exact count and must be used for metrics/progress; `referrals` below
  // is a recency-limited (most recent 50) preview list for the activity feed only.
  totalReferrals: number;
  referrals: Array<{ id: string; status: string; createdAt: string; convertedAt: string | null }>;
  commissions: Array<{
    id: string;
    amountCents: number;
    /** ISO 4217; a commission keeps the currency of the purchase it came from. */
    currency: string;
    rateBps: number;
    status: string;
    createdAt: string;
  }>;
  withdrawals: Array<{
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
    /** The admin's rejection reason or payout reference, written to be shown here. */
    payoutNote: string | null;
  }>;
};

export type LeaderboardEntry = {
  rank: number;
  earningsCents: number;
  commissions: number;
  user: {
    name: string | null;
    username: string | null;
    image: string | null;
    affiliateTier: string;
  } | null;
};

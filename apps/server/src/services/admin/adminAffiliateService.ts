import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "#lib/prisma";
import { ApiError } from "#lib/errors";

import { invalidateAffiliate } from "#services/affiliate/cache";
import { createCommission, updateCommission } from "#services/affiliate/commissions";
import { updateWithdrawal } from "#services/affiliate/wallet";

import type {
  adminAffiliateListQuerySchema,
  adminCommissionListQuerySchema,
  adminReferralListQuerySchema,
  adminWithdrawalListQuerySchema,
} from "#validators/admin/adminAffiliateValidator";

type AffiliateListQuery = z.infer<typeof adminAffiliateListQuerySchema>;
type CommissionListQuery = z.infer<typeof adminCommissionListQuerySchema>;
type WithdrawalListQuery = z.infer<typeof adminWithdrawalListQuerySchema>;
type ReferralListQuery = z.infer<typeof adminReferralListQuerySchema>;

const AFFILIATE_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  affiliateCode: true,
  affiliateStatus: true,
  affiliateTier: true,
  affiliateEnrolledAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/**
 * Program-wide totals for the affiliates page header. Kept as aggregates rather than a
 * client-side sum over the current page — an operator looking at page 3 still needs the
 * real program total, not the total of the 25 rows in front of them.
 */
export async function getAffiliateSummary() {
  const [byStatus, commissionTotals, walletTotals, pendingWithdrawals, referralTotals, clicks] =
    await Promise.all([
      prisma.user.groupBy({
        by: ["affiliateStatus"],
        _count: { _all: true },
        where: { affiliateStatus: { not: "NOT_ENROLLED" } },
      }),
      prisma.affiliateCommission.groupBy({
        by: ["status"],
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      prisma.affiliateWallet.aggregate({
        _sum: { pendingCents: true, availableCents: true, paidCents: true },
      }),
      prisma.affiliateWithdrawal.aggregate({
        where: { status: "REQUESTED" },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      prisma.affiliateReferral.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.affiliateClick.count(),
    ]);

  return {
    affiliatesByStatus: Object.fromEntries(
      byStatus.map((row) => [row.affiliateStatus, row._count._all]),
    ),
    commissionsByStatus: Object.fromEntries(
      commissionTotals.map((row) => [
        row.status,
        { count: row._count._all, amountCents: row._sum.amountCents ?? 0 },
      ]),
    ),
    wallets: {
      pendingCents: walletTotals._sum.pendingCents ?? 0,
      availableCents: walletTotals._sum.availableCents ?? 0,
      paidCents: walletTotals._sum.paidCents ?? 0,
    },
    pendingWithdrawals: {
      count: pendingWithdrawals._count._all,
      amountCents: pendingWithdrawals._sum.amountCents ?? 0,
    },
    referralsByStatus: Object.fromEntries(
      referralTotals.map((row) => [row.status, row._count._all]),
    ),
    totalClicks: clicks,
  };
}

export async function listAffiliates(query: AffiliateListQuery) {
  const where: Prisma.UserWhereInput = {
    affiliateStatus: query.status ?? { not: "NOT_ENROLLED" },
    ...(query.tier ? { affiliateTier: query.tier } : {}),
    ...(query.query
      ? {
          OR: [
            { email: { contains: query.query, mode: "insensitive" } },
            { name: { contains: query.query, mode: "insensitive" } },
            { affiliateCode: { equals: query.query, mode: "insensitive" } },
            { id: query.query },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        ...AFFILIATE_SELECT,
        affiliateWallet: {
          select: { pendingCents: true, availableCents: true, paidCents: true },
        },
        _count: { select: { affiliateReferrals: true, affiliateClicks: true } },
      },
      // "earnings" and "referrals" have no single sortable column, so they fall back to the
      // wallet's paid total and the referral count via the relation ordering Prisma supports.
      orderBy:
        query.sort === "referrals"
          ? { affiliateReferrals: { _count: "desc" } }
          : query.sort === "earnings"
            ? { affiliateWallet: { paidCents: "desc" } }
            : { affiliateEnrolledAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, limit: query.limit, offset: query.offset };
}

export async function getAffiliateDetail(userId: string) {
  const affiliate = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...AFFILIATE_SELECT,
      affiliateWallet: true,
      _count: { select: { affiliateReferrals: true, affiliateClicks: true } },
    },
  });

  if (!affiliate) throw new ApiError(404, "Affiliate not found.");

  const [referrals, commissions, withdrawals, clicksByDay] = await Promise.all([
    prisma.affiliateReferral.findMany({
      where: { affiliateId: userId },
      include: {
        referredUser: { select: { id: true, email: true, name: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.affiliateCommission.findMany({
      where: { affiliateId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.affiliateWithdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.affiliateClick.groupBy({
      by: ["referrerHost"],
      where: { affiliateId: userId },
      _count: { _all: true },
      orderBy: { _count: { referrerHost: "desc" } },
      take: 10,
    }),
  ]);

  return {
    affiliate,
    referrals,
    commissions,
    withdrawals,
    topReferrerHosts: clicksByDay.map((row) => ({
      host: row.referrerHost || "direct",
      clicks: row._count._all,
    })),
  };
}

export async function updateAffiliateStanding(
  userId: string,
  input: { status?: "PENDING" | "ACTIVE" | "SUSPENDED"; tier?: "TIER_1" | "TIER_2" | "TIER_3" },
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, affiliateStatus: true, affiliateTier: true },
  });

  if (!existing) throw new ApiError(404, "Affiliate not found.");
  if (existing.affiliateStatus === "NOT_ENROLLED")
    throw new ApiError(400, "This user is not enrolled in the affiliate program.");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.status ? { affiliateStatus: input.status } : {}),
      ...(input.tier ? { affiliateTier: input.tier } : {}),
    },
    select: AFFILIATE_SELECT,
  });

  await invalidateAffiliate(userId, true);

  return { affiliate: updated, previous: existing };
}

export async function listCommissions(query: CommissionListQuery) {
  const where: Prisma.AffiliateCommissionWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.affiliateId ? { affiliateId: query.affiliateId } : {}),
  };

  const [items, total, totals] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where,
      include: {
        affiliate: { select: { id: true, name: true, email: true, affiliateCode: true } },
        referral: {
          select: { id: true, referredUser: { select: { id: true, email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.affiliateCommission.count({ where }),
    prisma.affiliateCommission.aggregate({ where, _sum: { amountCents: true } }),
  ]);

  return {
    items,
    total,
    totalAmountCents: totals._sum.amountCents ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function listWithdrawals(query: WithdrawalListQuery) {
  const where: Prisma.AffiliateWithdrawalWhereInput = query.status ? { status: query.status } : {};

  const [items, total, totals] = await Promise.all([
    prisma.affiliateWithdrawal.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            affiliateCode: true,
            affiliateWallet: { select: { availableCents: true, paidCents: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.affiliateWithdrawal.count({ where }),
    prisma.affiliateWithdrawal.aggregate({ where, _sum: { amountCents: true } }),
  ]);

  return {
    items,
    total,
    totalAmountCents: totals._sum.amountCents ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function listReferrals(query: ReferralListQuery) {
  const where: Prisma.AffiliateReferralWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.affiliateId ? { affiliateId: query.affiliateId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.affiliateReferral.findMany({
      where,
      include: {
        affiliate: { select: { id: true, name: true, email: true, affiliateCode: true } },
        referredUser: { select: { id: true, name: true, email: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.affiliateReferral.count({ where }),
  ]);

  return { items, total, limit: query.limit, offset: query.offset };
}

export { createCommission, updateCommission, updateWithdrawal };

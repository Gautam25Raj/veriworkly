import { Prisma, type AffiliateWithdrawalStatus } from "@prisma/client";

import { ApiError } from "#lib/errors";
import { prisma } from "#lib/prisma";

import { invalidateAffiliate } from "#services/affiliate/cache";

const WITHDRAWAL_IN_PROGRESS = "A withdrawal is already in progress";

export async function requestWithdrawal(userId: string, amountCents: number) {
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const active = await tx.affiliateWithdrawal.findFirst({
        where: { userId, status: { in: ["REQUESTED", "APPROVED"] } },
        select: { id: true },
      });
      if (active) throw new ApiError(409, WITHDRAWAL_IN_PROGRESS);

      const reserved = await tx.affiliateWallet.updateMany({
        where: { userId, availableCents: { gte: amountCents } },
        data: { availableCents: { decrement: amountCents } },
      });
      if (reserved.count === 0) throw new ApiError(400, "Available balance is too low.");

      // `currency` defaults to USD: the wallet this draws from is a USD balance.
      return tx.affiliateWithdrawal.create({ data: { userId, amountCents } });
    });
  } catch (error) {
    // Two requests that both passed the pre-check: the partial unique index (one REQUESTED or
    // APPROVED row per user) rejects the second insert and the transaction returns its reservation.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new ApiError(409, WITHDRAWAL_IN_PROGRESS);
    throw error;
  }
  await invalidateAffiliate(userId);
  return result;
}

/** The states a withdrawal may be in for each requested transition. */
const TRANSITION_FROM: Record<"APPROVED" | "REJECTED" | "PAID", AffiliateWithdrawalStatus[]> = {
  APPROVED: ["REQUESTED"],
  REJECTED: ["REQUESTED", "APPROVED"],
  PAID: ["APPROVED"],
};

// Dodo Payments currently only exposes a read-only `payouts.list` endpoint for the settlements
// Dodo sends to VeriWorkly - it has no API to send money out to a third party (an affiliate).
// So payouts here can only be recorded once a human has actually paid the affiliate out of band
// (bank transfer, PayPal, etc.) and marks the request as reviewed below. Revisit this if Dodo ever
// ships a payout/transfer API.
//
// The transition is one conditional write (V-007): the row changes only if it is still in a state
// the transition is allowed from at commit time, and the wallet moves only when it did. Concurrent
// PAID and REJECTED on one withdrawal therefore cannot both pay and refund; the loser gets 409.
export async function updateWithdrawal(
  id: string,
  status: "APPROVED" | "REJECTED" | "PAID",
  note?: string,
  reviewerId?: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.affiliateWithdrawal.findUnique({ where: { id } });
    if (!withdrawal) throw new ApiError(404, "Withdrawal not found.");

    const transitioned = await tx.affiliateWithdrawal.updateMany({
      where: { id, status: { in: TRANSITION_FROM[status] } },
      data: {
        status,
        payoutNote: note,
        reviewedAt: new Date(),
        // Who signed off matters for a money movement that happens out of band; without it
        // the payout trail stops at "someone with admin access approved this".
        ...(reviewerId ? { reviewedBy: reviewerId } : {}),
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
      },
    });
    if (transitioned.count !== 1) {
      // Re-read inside the transaction so the reason reflects what a concurrent reviewer did.
      const current = await tx.affiliateWithdrawal.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) throw new ApiError(404, "Withdrawal not found.");
      if (current.status === "REJECTED" || current.status === "PAID")
        throw new ApiError(409, "Withdrawal is already finalized.");
      if (status === "PAID")
        throw new ApiError(409, "Approve the withdrawal before marking it paid.");
      throw new ApiError(409, "Withdrawal is already approved.");
    }

    if (status === "REJECTED" || status === "PAID") {
      // Credits need no balance guard, but a missing wallet row must roll the transition back
      // rather than surface as a P2025 the caller cannot act on.
      const credited = await tx.affiliateWallet.updateMany({
        where: { userId: withdrawal.userId },
        data:
          status === "REJECTED"
            ? { availableCents: { increment: withdrawal.amountCents } }
            : { paidCents: { increment: withdrawal.amountCents } },
      });
      if (credited.count !== 1) throw new ApiError(409, "Affiliate wallet not found.");
    }

    return tx.affiliateWithdrawal.findUniqueOrThrow({ where: { id } });
  });
  await invalidateAffiliate(result.userId);
  return result;
}

import { Prisma } from "@prisma/client";

import { getAiModePolicy } from "#services/aiPolicy";
import type { AiActionKey, AiMode } from "#services/aiTypes";
import { ApiError } from "#lib/errors";
import { logger } from "#lib/logger";
import { prisma } from "#lib/prisma";
import { cacheDel, cacheGet, cacheSet } from "#lib/redis";

const CREDIT_SUMMARY_TTL_SECONDS = 30;
const CREDIT_HISTORY_TTL_SECONDS = 60;
const CREDIT_HISTORY_LIMIT = 50;
/**
 * Must outlive the slowest AI run that holds a reservation open, or a concurrent wallet read
 * expires the reservation and the commit 409s after the provider was paid. Worst case today:
 * `(retries + 1) × AI_TIMEOUT_MS` with retries ≤ 2 (`ats/aiPolicy.ts`) and `AI_TIMEOUT_MS` 120 s
 * (`config.ts`) = 360 s, plus 1 s + 2 s backoff and up to two honoured 60 s `retry-after` waits
 * = 483 s. 900 s keeps a margin above that; lowering the AI timeout only widens the margin.
 */
const CREDIT_RESERVATION_TTL_MS = 15 * 60 * 1000;

/**
 * Every transaction in this file walks a variable-length list of grants or reservations with one
 * conditional write per item. Prisma's 5s default is enough for the common single-grant case but
 * not for an account with many stacked grants under pool contention — and a P2028 abort here
 * surfaces to the user as a failed AI action they were never charged for but also never got.
 */
const CREDIT_TRANSACTION_OPTIONS = { timeout: 15_000, maxWait: 8_000 } as const;

type CreditContext = {
  requestId: string;
  action?: string;
  documentId?: string;
  referenceId?: string;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
  /** Who performed the operation when it was not the wallet owner (admin adjustments). */
  actorId?: string;
};

type CreditGrantContext = CreditContext & {
  source: string;
  sourceId: string;
  expiresAt?: Date | null;
};

type LockedWallet = { id: string; balance: number; reserved: number };
type LockedGrant = { id: string; remaining: number };

function validateAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new ApiError(400, "Credit amount must be a positive integer.");
}

function summaryCacheKey(userId: string) {
  return `credits:summary:${userId}`;
}

function historyCacheKey(userId: string) {
  return `credits:history:${userId}`;
}

/**
 * Every ledger mutation starts by locking the wallet row, so reserve, commit, release, consume
 * and both expiry sweeps for one user run strictly one after another; READ COMMITTED gives no
 * such guarantee on its own. Lock order everywhere is wallet → reservation → grants, which is
 * what keeps the sweeps and a commit from deadlocking on each other.
 */
async function lockWallet(tx: Prisma.TransactionClient, userId: string): Promise<LockedWallet> {
  const rows = await tx.$queryRaw<LockedWallet[]>`
    SELECT id, balance, reserved FROM "CreditWallet" WHERE "userId" = ${userId} FOR UPDATE`;
  const wallet = rows[0];
  if (!wallet) throw new ApiError(404, "Credit wallet was not found.");
  return wallet;
}

/**
 * Grants that are still valid as of `validAt`, oldest expiry first, row-locked: two allocators
 * can no longer both pass the `remaining >= amount` check against the same rows.
 */
function lockGrants(tx: Prisma.TransactionClient, walletId: string, validAt: Date) {
  return tx.$queryRaw<LockedGrant[]>`
    SELECT id, remaining FROM "CreditGrant"
    WHERE "walletId" = ${walletId} AND remaining > 0
      AND ("expiresAt" IS NULL OR "expiresAt" > ${validAt})
    ORDER BY "expiresAt" ASC NULLS LAST, "createdAt" ASC, id ASC
    FOR UPDATE`;
}

/** What the wallet can still spend: unexpired grant credits minus what pending reservations hold. */
async function availableCredits(tx: Prisma.TransactionClient, wallet: LockedWallet, at: Date) {
  const unexpired = await tx.creditGrant.aggregate({
    where: {
      walletId: wallet.id,
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
    },
    _sum: { remaining: true },
  });
  return Math.min(wallet.balance, (unexpired._sum.remaining ?? 0) - wallet.reserved);
}

/** Moves `cost` from `reserved` back to `balance`; refuses to take `reserved` below zero. */
async function refundReserved(tx: Prisma.TransactionClient, walletId: string, cost: number) {
  const changed = await tx.creditWallet.updateMany({
    where: { id: walletId, reserved: { gte: cost } },
    data: { balance: { increment: cost }, reserved: { decrement: cost } },
  });
  if (!changed.count) throw new ApiError(409, "Credit ledger is out of balance for this wallet.");
}

function withActor(metadata: Prisma.InputJsonValue | undefined, actorId: string | undefined) {
  if (!actorId) return metadata;
  const base = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  return { ...base, actorId } satisfies Prisma.InputJsonValue;
}

function reservationConflict(
  existing: { userId: string; action: string; cost: number; status: string },
  userId: string,
  action: string,
  cost: number,
) {
  if (existing.userId !== userId || existing.action !== action || existing.cost !== cost)
    return new ApiError(409, "AI request id was already used for another operation.");
  if (existing.status === "PENDING") return new ApiError(409, "This AI request is processing.");
  if (existing.status === "COMMITTED")
    return new ApiError(409, "This AI request already completed.");
  return new ApiError(409, "This AI request id can no longer be reused.");
}

export class CreditService {
  static async invalidate(userId: string) {
    await Promise.all([
      cacheDel(summaryCacheKey(userId)),
      cacheDel(historyCacheKey(userId)),
      cacheDel(`billing:summary:${userId}`),
    ]);
  }

  static costFor(action: AiActionKey, mode: AiMode = "standard") {
    return getAiModePolicy(action, mode).credits;
  }

  static async releaseExpiredReservations(userId: string, at = new Date()) {
    const expired = await prisma.creditReservation.findMany({
      where: { userId, status: "PENDING", expiresAt: { lte: at } },
      select: { id: true, walletId: true, cost: true },
      take: 100,
    });
    if (!expired.length) return 0;

    const released = await prisma.$transaction(async (tx) => {
      await lockWallet(tx, userId);
      let total = 0;
      for (const reservation of expired) {
        const changed = await tx.creditReservation.updateMany({
          where: { id: reservation.id, status: "PENDING" },
          data: { status: "EXPIRED" },
        });
        if (!changed.count) continue;
        await refundReserved(tx, reservation.walletId, reservation.cost);
        total += reservation.cost;
      }
      return total;
    }, CREDIT_TRANSACTION_OPTIONS);
    if (released) await this.invalidate(userId);
    return released;
  }

  static async expireCredits(userId: string, at = new Date()) {
    const due = await prisma.creditGrant.findMany({
      where: { userId, remaining: { gt: 0 }, expiresAt: { lte: at } },
      select: { id: true },
      take: 1,
    });
    if (!due.length) return 0;
    // Cheap read-path check: while a reservation is pending the transaction below would only
    // take the wallet lock to defer, and this runs on every `getWallet`. The count inside the
    // lock stays authoritative.
    if (await prisma.creditReservation.count({ where: { userId, status: "PENDING" } })) return 0;

    const total = await prisma.$transaction(async (tx) => {
      const wallet = await lockWallet(tx, userId);
      /**
       * Credits held by a pending reservation were carved out of these very grants, and the
       * commit deliberately still allocates from a grant that was valid when the reservation
       * was made. Expiring under it would debit a balance that no longer holds those credits.
       * Every PENDING row counts, including an overdue one the release sweep has not flipped
       * yet; the sweep runs first on every path, so the deferral lasts one call at most.
       */
      const pending = await tx.creditReservation.count({
        where: { walletId: wallet.id, status: "PENDING" },
      });
      if (pending) return 0;

      const expired = await tx.creditGrant.findMany({
        where: { walletId: wallet.id, remaining: { gt: 0 }, expiresAt: { lte: at } },
        select: { id: true, remaining: true },
        take: 100,
      });
      let balance = wallet.balance;
      let expiredTotal = 0;
      for (const grant of expired) {
        const changed = await tx.creditGrant.updateMany({
          where: { id: grant.id, remaining: grant.remaining },
          data: { remaining: 0 },
        });
        if (!changed.count) continue;
        // Under the lock, with no reservation pending, the balance covers every expiring grant.
        // Clamping is the backstop that keeps a hand-edited ledger from going negative.
        const amount = Math.min(grant.remaining, balance);
        if (amount < grant.remaining)
          logger.warn("Credit expiry clamped: balance below the expiring grant", {
            userId,
            grantId: grant.id,
            balance,
            remaining: grant.remaining,
          });
        if (!amount) continue;
        balance -= amount;
        await tx.creditWallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amount }, lifetimeDebited: { increment: amount } },
        });
        const transaction = await tx.creditTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            type: "EXPIRATION",
            amount: -amount,
            balanceAfter: balance,
            requestId: `expire:${grant.id}`,
            referenceId: grant.id,
            reason: "Credit grant expired",
          },
        });
        await tx.creditUsageAllocation.create({
          data: { transactionId: transaction.id, grantId: grant.id, amount },
        });
        expiredTotal += amount;
      }
      return expiredTotal;
    }, CREDIT_TRANSACTION_OPTIONS);
    if (total) await this.invalidate(userId);
    return total;
  }

  static async getWallet(userId: string) {
    await this.releaseExpiredReservations(userId);
    await this.expireCredits(userId);
    const cached = await cacheGet<{
      balance: number;
      reserved: number;
      available: number;
      lifetimeCredited: number;
      lifetimeDebited: number;
      nextExpiryAt: Date | null;
      nextExpiryCredits: number;
      updatedAt: Date;
    }>(summaryCacheKey(userId));
    if (cached) return cached;

    const now = new Date();
    const [wallet, nextGrant, unexpired] = await Promise.all([
      prisma.creditWallet.upsert({
        where: { userId },
        create: { userId },
        update: {},
        select: {
          balance: true,
          reserved: true,
          lifetimeCredited: true,
          lifetimeDebited: true,
          updatedAt: true,
        },
      }),
      prisma.creditGrant.findFirst({
        where: { userId, remaining: { gt: 0 }, expiresAt: { gt: now } },
        orderBy: { expiresAt: "asc" },
        select: { expiresAt: true, remaining: true },
      }),
      prisma.creditGrant.aggregate({
        where: {
          userId,
          remaining: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        _sum: { remaining: true },
      }),
    ]);
    const result = {
      ...wallet,
      // What `reserve` would accept right now. Differs from `balance` while an expiry is
      // deferred under a pending reservation: those credits show but cannot be spent.
      available: Math.max(
        0,
        Math.min(wallet.balance, (unexpired._sum.remaining ?? 0) - wallet.reserved),
      ),
      nextExpiryAt: nextGrant?.expiresAt ?? null,
      nextExpiryCredits: nextGrant?.remaining ?? 0,
    };
    await cacheSet(summaryCacheKey(userId), result, CREDIT_SUMMARY_TTL_SECONDS);
    return result;
  }

  static async reserveAction(userId: string, action: AiActionKey, mode: AiMode, requestId: string) {
    const cost = this.costFor(action, mode);
    return this.reserve(userId, cost, action, requestId);
  }

  static async reserve(userId: string, cost: number, action: string, requestId: string) {
    validateAmount(cost);
    await this.releaseExpiredReservations(userId);
    await this.expireCredits(userId);

    let reservation;
    try {
      reservation = await prisma.$transaction(async (tx) => {
        await tx.creditWallet.upsert({ where: { userId }, create: { userId }, update: {} });
        const wallet = await lockWallet(tx, userId);

        // After the lock: a same-requestId twin queued behind us sees our committed row here.
        const existing = await tx.creditReservation.findUnique({ where: { requestId } });
        if (existing) throw reservationConflict(existing, userId, action, cost);

        // `balance` alone still counts grants that expired under a pending reservation, so the
        // check is what the unexpired grants can cover beyond what other reservations hold.
        // The same instant becomes the reservation's `createdAt`, which the commit's grant
        // filter compares against: one app clock, no database-clock skew between the two.
        const now = new Date();
        if ((await availableCredits(tx, wallet, now)) < cost)
          throw new ApiError(402, "Not enough AI credits.");

        const changed = await tx.creditWallet.updateMany({
          where: { id: wallet.id, balance: { gte: cost } },
          data: { balance: { decrement: cost }, reserved: { increment: cost } },
        });
        if (!changed.count) throw new ApiError(409, "Credit balance changed. Retry the action.");

        return tx.creditReservation.create({
          data: {
            walletId: wallet.id,
            userId,
            requestId,
            action,
            cost,
            createdAt: now,
            expiresAt: new Date(now.getTime() + CREDIT_RESERVATION_TTL_MS),
          },
        });
      }, CREDIT_TRANSACTION_OPTIONS);
    } catch (error) {
      // Two reserves with one request id at once: the loser must get a clean 409, not a P2002.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.creditReservation.findUnique({ where: { requestId } });
        throw existing
          ? reservationConflict(existing, userId, action, cost)
          : new ApiError(409, "This AI request is processing.");
      }
      throw error;
    }
    await this.invalidate(userId);
    return reservation;
  }

  static async commitReservation(
    userId: string,
    requestId: string,
    context: Omit<CreditContext, "requestId" | "action">,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.creditReservation.findUnique({ where: { requestId } });
      if (!reservation || reservation.userId !== userId)
        throw new ApiError(404, "AI credit reservation was not found.");

      // Wallet lock before the flip: the release sweep locks wallet → reservation, so taking
      // the reservation row first here would deadlock against it. The flip is conditional so a
      // reservation the sweep already expired cannot be charged a second time.
      const wallet = await lockWallet(tx, userId);
      const flipped = await tx.creditReservation.updateMany({
        where: { id: reservation.id, status: "PENDING" },
        data: { status: "COMMITTED" },
      });
      if (flipped.count !== 1)
        throw new ApiError(409, "AI credit reservation is no longer pending.");

      const grants = await lockGrants(tx, reservation.walletId, reservation.createdAt);
      let outstanding = reservation.cost;
      const allocations: Array<{ grantId: string; amount: number }> = [];
      for (const grant of grants) {
        if (!outstanding) break;
        const amount = Math.min(grant.remaining, outstanding);
        const changed = await tx.creditGrant.updateMany({
          where: { id: grant.id, remaining: { gte: amount } },
          data: { remaining: { decrement: amount } },
        });
        if (!changed.count) throw new ApiError(409, "Credit balance changed. Retry the action.");
        allocations.push({ grantId: grant.id, amount });
        outstanding -= amount;
      }
      if (outstanding) throw new ApiError(409, "Reserved credits are no longer available.");

      const settled = await tx.creditWallet.updateMany({
        where: { id: reservation.walletId, reserved: { gte: reservation.cost } },
        data: {
          reserved: { decrement: reservation.cost },
          lifetimeDebited: { increment: reservation.cost },
        },
      });
      if (!settled.count)
        throw new ApiError(409, "Credit ledger is out of balance for this wallet.");
      const { actorId, metadata, ...rest } = context;
      const transaction = await tx.creditTransaction.create({
        data: {
          walletId: reservation.walletId,
          userId,
          type: "DEBIT",
          amount: -reservation.cost,
          balanceAfter: wallet.balance,
          requestId,
          action: reservation.action,
          ...rest,
          metadata: withActor(metadata, actorId),
        },
      });
      await tx.creditUsageAllocation.createMany({
        data: allocations.map((item) => ({ transactionId: transaction.id, ...item })),
      });
      return transaction;
    }, CREDIT_TRANSACTION_OPTIONS);
    await this.invalidate(userId);
    return result;
  }

  static async releaseReservation(userId: string, requestId: string) {
    const released = await prisma.$transaction(async (tx) => {
      const reservation = await tx.creditReservation.findUnique({ where: { requestId } });
      if (!reservation || reservation.userId !== userId || reservation.status !== "PENDING")
        return false;
      await lockWallet(tx, userId);
      const changed = await tx.creditReservation.updateMany({
        where: { id: reservation.id, status: "PENDING" },
        data: { status: "RELEASED" },
      });
      if (!changed.count) return false;
      await refundReserved(tx, reservation.walletId, reservation.cost);
      return true;
    }, CREDIT_TRANSACTION_OPTIONS);
    if (released) await this.invalidate(userId);
    return released;
  }

  static async getHistory(userId: string, take = CREDIT_HISTORY_LIMIT) {
    if (take === CREDIT_HISTORY_LIMIT) {
      const cached = await cacheGet<Awaited<ReturnType<typeof prisma.creditTransaction.findMany>>>(
        historyCacheKey(userId),
      );
      if (cached) return cached;
    }
    const result = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(take, 1), 100),
    });
    if (take === CREDIT_HISTORY_LIMIT)
      await cacheSet(historyCacheKey(userId), result, CREDIT_HISTORY_TTL_SECONDS);
    return result;
  }

  static async consumeAction(
    userId: string,
    action: AiActionKey,
    context: Omit<CreditContext, "action">,
    mode: AiMode = "standard",
  ) {
    return this.consume(userId, this.costFor(action, mode), { ...context, action });
  }

  static async consume(userId: string, cost: number, context: CreditContext) {
    validateAmount(cost);
    await this.expireCredits(userId);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.creditTransaction.findUnique({
        where: { requestId: context.requestId },
      });
      if (existing) {
        if (existing.userId !== userId || existing.amount !== -cost)
          throw new ApiError(409, "Credit request id was already used for another operation.");
        return existing;
      }

      const wallet = await tx.creditWallet.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
      if (wallet.balance < cost) throw new ApiError(402, "Not enough AI credits.");

      // Credits held by pending reservations are not ours to take: an admin debit must leave
      // every PENDING reservation able to commit.
      const locked = await lockWallet(tx, userId);
      const now = new Date();
      if ((await availableCredits(tx, locked, now)) < cost)
        throw new ApiError(402, "Not enough AI credits outside pending AI requests.");

      const grants = await lockGrants(tx, wallet.id, now);
      let outstanding = cost;
      const allocations: Array<{ grantId: string; amount: number }> = [];
      for (const grant of grants) {
        if (!outstanding) break;
        const amount = Math.min(grant.remaining, outstanding);
        const changed = await tx.creditGrant.updateMany({
          where: { id: grant.id, remaining: { gte: amount } },
          data: { remaining: { decrement: amount } },
        });
        if (!changed.count) throw new ApiError(409, "Credit balance changed. Retry the action.");
        allocations.push({ grantId: grant.id, amount });
        outstanding -= amount;
      }
      if (outstanding) throw new ApiError(402, "Not enough unexpired AI credits.");

      const updated = await tx.creditWallet.updateMany({
        where: { id: wallet.id, balance: { gte: cost } },
        data: { balance: { decrement: cost }, lifetimeDebited: { increment: cost } },
      });
      if (!updated.count)
        throw new ApiError(409, "Credit ledger is out of balance for this wallet.");
      const { actorId, metadata, ...rest } = context;
      const transaction = await tx.creditTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: "DEBIT",
          amount: -cost,
          balanceAfter: locked.balance - cost,
          ...rest,
          metadata: withActor(metadata, actorId),
        },
      });
      await tx.creditUsageAllocation.createMany({
        data: allocations.map((item) => ({ transactionId: transaction.id, ...item })),
      });
      return transaction;
    }, CREDIT_TRANSACTION_OPTIONS);
    await this.invalidate(userId);
    return result;
  }

  static async grant(userId: string, amount: number, context: CreditGrantContext) {
    validateAmount(amount);
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.creditTransaction.findUnique({
          where: { requestId: context.requestId },
        });
        if (existing) return existing;
        const wallet = await tx.creditWallet.upsert({
          where: { userId },
          create: { userId, balance: amount, lifetimeCredited: amount },
          update: { balance: { increment: amount }, lifetimeCredited: { increment: amount } },
        });
        const grant = await tx.creditGrant.create({
          data: {
            walletId: wallet.id,
            userId,
            amount,
            remaining: amount,
            source: context.source,
            sourceId: context.sourceId,
            expiresAt: context.expiresAt,
          },
        });
        const transaction = await tx.creditTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            type: "GRANT",
            amount,
            balanceAfter: wallet.balance,
            referenceId: grant.id,
            requestId: context.requestId,
            action: context.action,
            documentId: context.documentId,
            reason: context.reason,
            metadata: withActor(context.metadata, context.actorId),
          },
        });
        return transaction;
      }, CREDIT_TRANSACTION_OPTIONS);
      await this.invalidate(userId);
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.creditTransaction.findUnique({
          where: { requestId: context.requestId },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  static async adjust(userId: string, amount: number, context: CreditContext) {
    if (!Number.isSafeInteger(amount) || amount === 0)
      throw new ApiError(400, "Credit adjustment must be a non-zero integer.");
    if (amount > 0)
      return this.grant(userId, amount, {
        ...context,
        source: "admin_adjustment",
        sourceId: context.requestId,
        expiresAt: null,
      });
    return this.consume(userId, Math.abs(amount), { ...context, action: "admin_adjustment" });
  }
}

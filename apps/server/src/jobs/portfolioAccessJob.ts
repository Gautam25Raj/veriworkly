import { v4 as uuidv4 } from "uuid";
import cron from "node-cron";
import type { Prisma } from "@prisma/client";

import { config } from "#config";
import { logger } from "#lib/logger";
import { prisma } from "#lib/prisma";
import { getRedis } from "#lib/redis";
import { PortfolioAssetService } from "#services/portfolioAssetService";
import { ENTITLEMENT_KEYS } from "#services/productCatalog";
import { PREMIUM_PORTFOLIO_TEMPLATE_IDS } from "#validators/portfolioValidator";

const PORTFOLIO_PRODUCT_KEYS = ["portfolio_pro", "bundle"] as const;
import {
  invalidatePublicPortfolioCaches,
  revalidatePublicPortfolios,
} from "#utils/portfolioPublicationCache";

let job: ReturnType<typeof cron.schedule> | null = null;

const RELEASE_LOCK_LUA_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
  else
      return 0
  end
`;

export async function suspendExpiredGracePeriods() {
  let redis: ReturnType<typeof getRedis>;

  try {
    redis = getRedis();
  } catch (error) {
    // The caller's .catch would also contain this; a Redis blip is a skipped tick, not an error.
    logger.warn("Skipping portfolio grace suspension: Redis not ready", {
      error: error instanceof Error ? error.message : error,
    });
    return;
  }

  const lockKey = "portfolio:suspension:lock";
  const lockValue = uuidv4();
  const lockTTL = 300; // 5 minutes

  let lockAcquired = false;

  try {
    const lockResult = await redis.set(lockKey, lockValue, {
      NX: true,
      EX: lockTTL,
    });

    lockAcquired = lockResult === "OK";

    if (!lockAcquired) {
      logger.debug("Portfolio grace suspension lock already held by another instance. Skipping.");
      return;
    }

    const now = new Date();
    const graceCutoff = new Date(now.getTime() - config.portfolio.graceDays * 24 * 60 * 60 * 1000);

    // A subscription that still pays for premium publishing or whose grace window is running.
    const governingSubscription = {
      productKey: { in: [...PORTFOLIO_PRODUCT_KEYS] },
      OR: [
        {
          status: "ACTIVE" as const,
          OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
        },
        { status: "CANCELED" as const, currentPeriodEnd: { gt: now } },
        { graceEndsAt: { gt: now } },
      ],
    } satisfies Prisma.SubscriptionWhereInput;

    // Only premium templates ride on a subscription; a free-template row never earns a grace
    // period and is never suspended here, whatever the user's billing history says.
    //
    // The grace window comes from the subscription (`graceEndsAt`). A GRACE row whose user has
    // no portfolio subscription at all (an expired pass or comp grant, moved here by the sweep
    // below) has no provider clock, so its window is `graceDays` from the transition: the row's
    // `updatedAt`, which that transition was the last write to.
    const expiredGraceWhere = {
      status: "GRACE" as const,
      templateId: { in: [...PREMIUM_PORTFOLIO_TEMPLATE_IDS] },
      user: { subscriptions: { none: governingSubscription } },
      OR: [
        { user: { subscriptions: { some: { productKey: { in: [...PORTFOLIO_PRODUCT_KEYS] } } } } },
        { updatedAt: { lte: graceCutoff } },
      ],
    } satisfies Prisma.PortfolioPublicationWhereInput;

    const expired = await prisma.portfolioPublication.findMany({
      where: expiredGraceWhere,
      select: { id: true, subdomain: true },
    });

    if (expired.length > 0) {
      // The full predicate is repeated so a renewal webhook that set a row LIVE between the
      // read and this write is not overwritten; `id in ids` alone would clobber it.
      await prisma.portfolioPublication.updateMany({
        where: { id: { in: expired.map((publication) => publication.id) }, ...expiredGraceWhere },
        data: { status: "SUSPENDED", suspensionReason: "grace_expired", suspendedAt: now },
      });

      logger.info("Suspended expired portfolio grace periods", { count: expired.length });
    }

    // A premium publication whose publish grant ran out without a provider event (a pass or a
    // time-boxed comp expiring) gets the same grace window a failed renewal does. Webhooks move
    // subscription-backed rows themselves; this catches the rows no webhook will ever touch.
    const lapsedLiveWhere = {
      status: "LIVE" as const,
      templateId: { in: [...PREMIUM_PORTFOLIO_TEMPLATE_IDS] },
      user: {
        entitlementGrants: {
          none: {
            key: ENTITLEMENT_KEYS.PORTFOLIO_PUBLISH,
            startsAt: { lte: now },
            revokedAt: null,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          },
        },
        subscriptions: { none: governingSubscription },
      },
    } satisfies Prisma.PortfolioPublicationWhereInput;

    const lapsed = await prisma.portfolioPublication.findMany({
      where: lapsedLiveWhere,
      select: { id: true, subdomain: true },
    });

    if (lapsed.length > 0) {
      await prisma.portfolioPublication.updateMany({
        where: { id: { in: lapsed.map((publication) => publication.id) }, ...lapsedLiveWhere },
        data: { status: "GRACE", suspensionReason: null, suspendedAt: null },
      });

      logger.info("Moved lapsed premium portfolios to grace", { count: lapsed.length });
    }

    const subdomains = [...expired, ...lapsed].map((publication) => publication.subdomain);

    if (subdomains.length > 0) {
      await invalidatePublicPortfolioCaches(subdomains);
      void revalidatePublicPortfolios(subdomains);
    }
  } finally {
    if (lockAcquired) {
      try {
        await redis.eval(RELEASE_LOCK_LUA_SCRIPT, {
          keys: [lockKey],
          arguments: [lockValue],
        });
      } catch (err) {
        logger.error("Failed to release portfolio suspension lock", err);
      }
    }
  }
}

function runPortfolioAccessSweep() {
  // Both tasks below need Redis for their locks; a blip skips the tick with one warning.
  try {
    getRedis();
  } catch (error) {
    logger.warn("Skipping portfolio access sweep: Redis not ready", {
      error: error instanceof Error ? error.message : error,
    });
    return;
  }

  void suspendExpiredGracePeriods().catch((error) => {
    logger.error("Failed to suspend expired portfolio grace periods", {
      error: error instanceof Error ? error.message : error,
    });
  });

  void PortfolioAssetService.cleanupStaleAssets().catch((error) => {
    logger.error("Failed to cleanup stale pending portfolio assets", {
      error: error instanceof Error ? error.message : error,
    });
  });
}

export function startPortfolioAccessJob() {
  if (job) return;

  runPortfolioAccessSweep();
  job = cron.schedule("0 * * * *", runPortfolioAccessSweep);
}

// Stops scheduling only; an in-flight sweep is not tracked or awaited (Phase 4 item 1).
export function stopPortfolioAccessJob() {
  job?.stop();
  job = null;
}

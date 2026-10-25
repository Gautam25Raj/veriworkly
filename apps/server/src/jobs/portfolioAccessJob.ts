import cron from "node-cron";
import type { Prisma } from "@prisma/client";

import { config } from "#config";
import { logger } from "#lib/logger";
import { prisma } from "#lib/prisma";
import { createRunTracker, withJobLock } from "#lib/jobLock";
import { PortfolioAssetService } from "#services/portfolioAssetService";
import { ENTITLEMENT_KEYS } from "#services/productCatalog";
import { PREMIUM_PORTFOLIO_TEMPLATE_IDS } from "#validators/portfolioValidator";

const PORTFOLIO_PRODUCT_KEYS = ["portfolio_pro", "bundle"] as const;
import {
  invalidatePublicPortfolioCaches,
  revalidatePublicPortfolios,
} from "#utils/portfolioPublicationCache";

let job: ReturnType<typeof cron.schedule> | null = null;
const runs = createRunTracker();

/**
 * Suspends premium publications whose grace ran out and moves lapsed ones to grace. Takes no lock
 * and throws on failure: the hourly sweep below runs it under the portfolio-access lock.
 */
export async function suspendExpiredGracePeriods() {
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
      {
        user: { subscriptions: { some: { productKey: { in: [...PORTFOLIO_PRODUCT_KEYS] } } } },
      },
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
}

/**
 * The hourly sweep: grace-period suspension, then abandoned-upload cleanup, one runner per tick
 * through the shared job lock. Each task is isolated so a failure in one still lets the other
 * run; a run in which either failed throws at the end, so withJobLock logs it and `/health/jobs`
 * does not count it. Never rejects (a Redis blip is withJobLock's one warning).
 */
export async function runPortfolioAccessSweep(): Promise<void> {
  await withJobLock(
    "portfolio:suspension:lock",
    { ttlMs: 300_000, job: "portfolio-access" },
    async () => {
      const failed: string[] = [];
      const tasks: Array<[string, () => Promise<unknown>]> = [
        ["grace-period suspension", suspendExpiredGracePeriods],
        ["stale asset cleanup", () => PortfolioAssetService.cleanupStaleAssets()],
      ];

      for (const [task, run] of tasks) {
        try {
          await run();
        } catch (error) {
          failed.push(task);
          logger.error(`Portfolio access sweep: ${task} failed`, {
            error: error instanceof Error ? error.message : error,
          });
        }
      }

      if (failed.length > 0) throw new Error(`Portfolio access sweep: ${failed.join(", ")} failed`);
    },
  );
}

export function startPortfolioAccessJob() {
  if (job) return;

  runs.track(runPortfolioAccessSweep());
  job = cron.schedule("0 * * * *", () => runs.track(runPortfolioAccessSweep()));
}

/** Stops scheduling and resolves once the sweep in progress, if any, has finished. */
export function stopPortfolioAccessJob(): Promise<void> {
  job?.stop();
  job = null;

  return runs.idle();
}

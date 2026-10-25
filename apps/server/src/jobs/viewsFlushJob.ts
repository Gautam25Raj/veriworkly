import cron, { ScheduledTask } from "node-cron";

import { logger } from "#lib/logger";
import { createRunTracker, withJobLock } from "#lib/jobLock";

import { ShareService } from "#services/shareService";
import { PortfolioService } from "#services/portfolioService";

let job: ScheduledTask | null = null;
const runs = createRunTracker();

/**
 * Never rejects: it is fired from the cron callback, and an unhandled rejection shuts the worker
 * down (V-101). A Redis blip costs one skipped tick and a warning. The lock is renewed while the
 * run lasts, and the run stops between steps if it was lost anyway (V-127). A run in which any
 * step failed throws at the end, after the other steps ran, so `/health/jobs` does not count it.
 */
export async function runViewsFlush(reason: "startup" | "cron"): Promise<void> {
  await withJobLock(
    "views:flush:lock",
    { ttlMs: 5 * 60_000, job: "views-flush" },
    async (stillOwner) => {
      const lostLock = async () => {
        if (await stillOwner()) return false;
        logger.warn(`Views flush (${reason}) stopped: lock lost to another worker`);
        return true;
      };

      // Each step is isolated (V-068): a failing portfolio day must not hold back the other days,
      // the share flush or the retention sweep in the same run.
      const failedSteps = new Set<string>();
      const logStepFailure = (step: string, error: unknown, extra?: Record<string, unknown>) => {
        failedSteps.add(step);
        logger.error(`Views flush (${reason}): ${step} failed`, {
          ...extra,
          error: error instanceof Error ? error.message : error,
        });
      };

      // 1. Flush Portfolio Views
      let flushedPortfolioViews = 0;
      const skippedPortfolioDates: string[] = [];

      try {
        for (const dateKey of await PortfolioService.getPendingViewDates()) {
          if (await lostLock()) return;

          try {
            const result = await PortfolioService.flushViewsForDate(dateKey);
            flushedPortfolioViews += result.flushedCount;
            if ("skipped" in result) skippedPortfolioDates.push(dateKey);
          } catch (error) {
            logStepFailure("portfolio views", error, { dateKey });
          }
        }
      } catch (error) {
        logStepFailure("listing portfolio view dates", error);
      }

      if (skippedPortfolioDates.length > 0)
        logger.warn(`Views flush (${reason}): portfolio days locked by another flush`, {
          dates: skippedPortfolioDates,
        });

      // 2. Flush Share Views
      if (await lostLock()) return;

      let shareFlushResult: Awaited<ReturnType<typeof ShareService.flushShareViews>> | undefined;
      try {
        shareFlushResult = await ShareService.flushShareViews();
        if ("skipped" in shareFlushResult)
          logger.warn(`Views flush (${reason}): share views locked by another flush`);
      } catch (error) {
        logStepFailure("share views", error);
      }

      // 3. ShareView retention, batched and outside the flush transaction (V-110).
      if (await lostLock()) return;

      try {
        await ShareService.pruneShareViews();
      } catch (error) {
        logStepFailure("share view retention", error);
      }

      if (
        flushedPortfolioViews > 0 ||
        (shareFlushResult &&
          (shareFlushResult.flushedViews > 0 || shareFlushResult.flushedLinks > 0))
      ) {
        logger.info(`Views flush (${reason}) completed`, {
          flushedPortfolioViews,
          flushedShareViews: shareFlushResult?.flushedViews ?? 0,
          flushedShareLinks: shareFlushResult?.flushedLinks ?? 0,
        });
      }

      // Each failure is logged above; withJobLock logs the run as failed and records no success.
      if (failedSteps.size > 0)
        throw new Error(`Views flush (${reason}): ${[...failedSteps].join(", ")} failed`);
    },
  );
}

export function startViewsFlushJob() {
  if (job) return;

  // Run every 10 minutes
  job = cron.schedule("*/10 * * * *", () => runs.track(runViewsFlush("cron")));

  logger.debug("Views flush job scheduled (every 10 minutes)");

  // Check on startup
  runs.track(runViewsFlush("startup"));
}

/** Stops scheduling and resolves once the run in progress, if any, has finished. */
export function stopViewsFlushJob(): Promise<void> {
  if (job) {
    job.stop();
    job = null;
    logger.info("Views flush job stopped");
  }

  return runs.idle();
}

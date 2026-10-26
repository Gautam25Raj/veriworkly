import cron from "node-cron";

import { createRunTracker, withJobLock } from "#lib/jobLock";
import { logger } from "#lib/logger";
import { PortfolioAssetService } from "#services/portfolioAssetService";
import { PortfolioService } from "#services/portfolioService";

let job: ReturnType<typeof cron.schedule> | null = null;
const runs = createRunTracker();

/** The lapsed-portfolio settlement (see `PortfolioService.settleLapsedPortfolios`). */
export function settleLapsedPortfolios() {
  return PortfolioService.settleLapsedPortfolios();
}

/**
 * The hourly sweep: lapsed-portfolio settlement, then abandoned-upload cleanup, one runner per
 * tick through the shared job lock. Each task is isolated so a failure in one still lets the
 * other run; a run in which either failed throws at the end, so withJobLock logs it and
 * `/health/jobs` does not count it. Never rejects (a Redis blip is withJobLock's one warning).
 */
export async function runPortfolioAccessSweep(): Promise<void> {
  await withJobLock(
    "portfolio:suspension:lock",
    { ttlMs: 300_000, job: "portfolio-access" },
    async () => {
      const failed: string[] = [];
      const tasks: Array<[string, () => Promise<unknown>]> = [
        ["lapsed portfolio settlement", settleLapsedPortfolios],
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
export async function stopPortfolioAccessJob(): Promise<void> {
  await job?.stop();
  job = null;

  return runs.idle();
}

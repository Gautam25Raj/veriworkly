import cron from "node-cron";

import { logger } from "#lib/logger";
import { createRunTracker, withJobLock } from "#lib/jobLock";
import { sweepExpiredCredits } from "#services/creditService";

let job: ReturnType<typeof cron.schedule> | null = null;
const runs = createRunTracker();

const LOCK_KEY = "credits:sweep:lock";
const LOCK_TTL_MS = 300_000;

/**
 * Hourly credit expiry sweep (V-107): wallet reads no longer release overdue reservations or
 * expire due grants, so this is what keeps `balance` honest between write paths. One runner per
 * tick through the shared job lock. Never rejects: a Redis blip or a failed sweep is a logged
 * skipped tick. A sweep in which any wallet failed still processes every wallet, then throws so
 * `/health/jobs` does not count it.
 */
export async function runCreditSweep(reason: "startup" | "cron"): Promise<void> {
  await withJobLock(LOCK_KEY, { ttlMs: LOCK_TTL_MS, job: "credit-sweep" }, async () => {
    // A throw propagates to withJobLock, which logs it and does not record a success.
    const totals = await sweepExpiredCredits();
    if (totals.wallets > 0 || totals.failed > 0)
      logger.info(`Credit expiry sweep (${reason}) completed`, totals);
    if (totals.failed > 0)
      throw new Error(`Credit expiry sweep (${reason}): ${totals.failed} wallets failed`);
  });
}

export function startCreditSweepJob() {
  if (job) return;

  job = cron.schedule("30 * * * *", () => runs.track(runCreditSweep("cron")));
  logger.debug("Credit expiry sweep job scheduled", { cron: "30 * * * *" });

  // Catch up on anything that came due while no process was running.
  runs.track(runCreditSweep("startup"));
}

/** Stops scheduling and resolves once the sweep in progress, if any, has finished. */
export async function stopCreditSweepJob(): Promise<void> {
  if (job) {
    await job.stop();
    job = null;
    logger.info("Credit expiry sweep job stopped");
  }

  return runs.idle();
}

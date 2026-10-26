import cron from "node-cron";

import { logger } from "#lib/logger";
import { createRunTracker, withJobLock } from "#lib/jobLock";
import { runAnnualCreditGrants } from "#services/annualCreditService";
import { retryUnsentBillingNotifications } from "#services/billingNotifications";

let job: ReturnType<typeof cron.schedule> | null = null;
const runs = createRunTracker();

const LOCK_KEY = "credits:annual-monthly:lock";
const LOCK_TTL_MS = 300_000;
const CRON = "15 * * * *";

/**
 * Hourly: grants the monthly credits of annual plans whose next month has started (owner decision
 * 4; see `services/annualCreditService`), then retries the billing emails whose send failed or was
 * cut off (`services/billingNotifications`). One runner per tick through the shared job lock, and
 * every grant is idempotent on its (schedule, month) key, so an overlapping run is harmless. Never
 * rejects; a run in which any schedule failed throws inside the lock so `/health/jobs` skips it.
 */
export async function runAnnualCreditJob(reason: "startup" | "cron"): Promise<void> {
  await withJobLock(LOCK_KEY, { ttlMs: LOCK_TTL_MS, job: "annual-credits" }, async () => {
    // Two independent steps: a failure in one must not skip the other. Either failing still
    // fails the run, after both have had their turn.
    const failures: string[] = [];
    try {
      const totals = await runAnnualCreditGrants();
      if (totals.granted > 0 || totals.failed > 0)
        logger.info(`Annual monthly credits (${reason}) completed`, totals);
      if (totals.failed > 0) failures.push(`${totals.failed} schedules failed`);
    } catch (error) {
      failures.push(`annual credits: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      const mail = await retryUnsentBillingNotifications();
      if (mail.retried > 0) logger.info(`Billing email retries (${reason}) completed`, mail);
    } catch (error) {
      failures.push(`email retries: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (failures.length)
      throw new Error(`Annual monthly credits (${reason}): ${failures.join("; ")}`);
  });
}

export function startAnnualCreditJob() {
  if (job) return;

  job = cron.schedule(CRON, () => runs.track(runAnnualCreditJob("cron")));
  logger.debug("Annual monthly credit job scheduled", { cron: CRON });

  // Catch up on months that started while no process was running.
  runs.track(runAnnualCreditJob("startup"));
}

/** Stops scheduling and resolves once the run in progress, if any, has finished. */
export async function stopAnnualCreditJob(): Promise<void> {
  if (job) {
    await job.stop();
    job = null;
    logger.info("Annual monthly credit job stopped");
  }

  return runs.idle();
}

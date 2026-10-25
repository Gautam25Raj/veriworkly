import throng from "throng";

import "./polyfills.js";
import { app } from "./app.js";

import { config, isDevelopment } from "#config";

import { logger } from "#lib/logger";
import { closePrisma, poolMax, clusterWorkerCount } from "#lib/prisma";
import { initRedis, closeRedis } from "#lib/redis";
import { flushAuditLogs } from "#middleware/logging";

import { stopExtractPool } from "#services/ats/extractPool";
import { validateAiRuntimeConfig } from "#services/aiPolicy";
import { validateAtsAiRuntimeConfig } from "#services/ats/aiPolicy";
import { validateAtsEngineRuntimeConfig } from "#services/ats/enginePolicy";
import { ensureAdminUserExists, validateAuthRuntimeConfig } from "#auth/runtime";
import {
  validateBillingAndStorageRuntimeConfig,
  validateEnvironmentConfig,
} from "#config/validateRuntimeConfig";
// CRON_ROLE=all|none: which processes schedule background jobs (documented in the module).
import { parseCronRole } from "#config/cronRole";

import { startGitHubSyncJob, stopGitHubSyncJob } from "#jobs/githubSyncJob";
import { startChangelogSyncJob, stopChangelogSyncJob } from "#jobs/changelogSyncJob";
import { startViewsFlushJob, stopViewsFlushJob } from "#jobs/viewsFlushJob";
import { startUsageMetricsJob, stopUsageMetricsJob } from "#jobs/usageMetricsJob";
import { startPortfolioAccessJob, stopPortfolioAccessJob } from "#jobs/portfolioAccessJob";
import { startCreditSweepJob, stopCreditSweepJob } from "#jobs/creditSweepJob";

const SHUTDOWN_HTTP_GRACE_MS = 10_000;

let serverInstance: ReturnType<typeof app.listen> | null = null;

let exitCode = 0;
let isShuttingDown = false;

// Graceful shutdown function inside worker
async function shutdownWorker(id: number, disconnect: () => void) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Worker ${id}: Shutting down gracefully...`);

  if (serverInstance) {
    logger.info(`Worker ${id}: Stopping HTTP server from accepting new requests...`);

    await new Promise<void>((resolve) => {
      // Force timeout shutdown after the grace period. unref'd so it never holds the process
      // open, and cleared once close completes so it doesn't fire (and log) after the fact.
      const forceTimer = setTimeout(() => {
        logger.warn(`Worker ${id}: Graceful HTTP shutdown timeout reached. Continuing.`);
        resolve();
      }, SHUTDOWN_HTTP_GRACE_MS);
      forceTimer.unref();

      serverInstance!.close(() => {
        clearTimeout(forceTimer);
        logger.info(`Worker ${id}: HTTP server stopped.`);
        resolve();
      });
    });
  }

  try {
    // Every worker may have scheduled jobs (CRON_ROLE=all); the stop functions are no-ops when
    // nothing was started. They stop scheduling only: the jobs expose no in-flight promise to
    // await, so a run already in progress is not drained (Phase 4 item 1).
    logger.info(`Worker ${id}: Stopping background cron jobs...`);
    stopGitHubSyncJob();
    stopChangelogSyncJob();
    stopViewsFlushJob();
    stopUsageMetricsJob();
    stopPortfolioAccessJob();
    stopCreditSweepJob();

    stopExtractPool();

    await closeRedis();
    // Buffered request audit rows (V-109) go out before the pool closes.
    await flushAuditLogs();
    await closePrisma();

    logger.info(`Worker ${id}: Disconnecting worker.`);

    disconnect();

    if (exitCode !== 0) process.exit(exitCode);
  } catch (error) {
    logger.error(`Worker ${id}: Error during shutdown:`, error);
    disconnect();
    process.exit(1);
  }
}

// Worker process function
async function startWorker(id: number, disconnect: () => void) {
  logger.info(`Worker ${id} starting...`);

  // Handle process signals in worker
  process.on("SIGTERM", () => void shutdownWorker(id, disconnect));
  process.on("SIGINT", () => void shutdownWorker(id, disconnect));

  // Handle uncaught exceptions and unhandled rejections in worker
  process.on("uncaughtException", (error) => {
    logger.error(`Worker ${id}: Uncaught Exception:`, error);
    exitCode = 1;
    void shutdownWorker(id, disconnect);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error(`Worker ${id}: Unhandled Rejection:`, {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    });

    exitCode = 1;

    void shutdownWorker(id, disconnect);
  });

  try {
    // Each worker initializes its own Redis connection
    await initRedis();
    logger.info(`Worker ${id}: Redis connected`);

    // One-off boot routine: worker 1 only. It is idempotent, so a revived worker (never id 1)
    // skipping it is fine.
    if (id === 1) {
      await ensureAdminUserExists();

      logger.info(`Worker ${id}: Database connected and admin user checked`);
    }

    // Cron jobs run on every worker; their Redis locks pick one runner per tick (V-053/V-086).
    const cronRole = parseCronRole(process.env.CRON_ROLE);

    if (cronRole === "all") {
      startGitHubSyncJob();
      startChangelogSyncJob();
      startViewsFlushJob();
      startUsageMetricsJob();
      startPortfolioAccessJob();
      startCreditSweepJob();
    }

    // One line per worker; per-job scheduling and lock-held skips log at debug.
    logger.info(
      `Worker ${id}: Background cron jobs ${cronRole === "all" ? "scheduled" : "disabled"}`,
      {
        cronRole,
      },
    );

    // Start Express server in worker
    serverInstance = app.listen(config.port, () => {
      logger.info(`Worker ${id}: Server running on port ${config.port} (${config.nodeEnv})`);

      logger.info(`Worker ${id}: IP/rate-limit configuration`, {
        trustProxy: config.server.trustProxy,
        authIpAddressHeaders: config.auth.ipAddressHeaders,
      });

      if (id === 1) {
        logger.info(`Worker ${id}: Database pool sizing`, {
          poolMaxPerWorker: poolMax,
          workers: clusterWorkerCount,
          totalConnections: poolMax * clusterWorkerCount,
        });
      }

      if (isDevelopment && id === 1) {
        logger.info(`Allowed origins: ${config.allowedOrigins.join(", ")}`);
        logger.info(`http://localhost:${config.port}/api/v1/health`);
      }
    });

    // Node's default keepAliveTimeout (5s) is shorter than most reverse proxies'/load balancers'
    // idle timeout (e.g. 60s on many managed LBs), which can race: the proxy reuses a pooled
    // connection Node has already closed, surfacing as intermittent 502s under real traffic.
    // headersTimeout must stay greater than keepAliveTimeout (enforced by Node).
    serverInstance.keepAliveTimeout = 65_000;
    serverInstance.headersTimeout = 66_000;

    serverInstance.on("error", (err) => {
      logger.error(`Worker ${id}: Server error:`, err);
      exitCode = 1;
      void shutdownWorker(id, disconnect);
    });
  } catch (error) {
    logger.error(`Worker ${id}: Failed to start:`, error);
    exitCode = 1;
    void shutdownWorker(id, disconnect);
  }
}

// Master process configuration check and bootstrap
function main() {
  // Handle uncaught exceptions and unhandled rejections in master process
  process.on("uncaughtException", (error) => {
    logger.error("Master Process: Uncaught Exception:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Master Process: Unhandled Rejection:", {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    });

    process.exit(1);
  });

  try {
    // Validate runtime environment configs in master process first (fail-fast). The raw-env
    // schema runs before the others: it reports every bad variable in one message, and in
    // production refuses localhost URLs, example secrets, a missing TRUST_PROXY/WEB_CONCURRENCY
    // and non-integer numbers (V-090, V-091, V-097).
    validateEnvironmentConfig();
    validateAuthRuntimeConfig();
    validateAiRuntimeConfig();
    validateAtsAiRuntimeConfig();
    validateAtsEngineRuntimeConfig();
    validateBillingAndStorageRuntimeConfig();
    parseCronRole(process.env.CRON_ROLE);

    const { clusteringEnabled, workers } = config.server;

    if (clusteringEnabled) {
      logger.info(`Master process starting cluster with ${workers} workers...`);

      throng({
        worker: startWorker,
        count: workers,
        grace: 15000,
      });
    } else {
      logger.info("Clustering disabled. Starting single process worker...");

      // For single process, mock disconnect as noop
      void startWorker(1, () => {
        process.exit(exitCode);
      });
    }
  } catch (error) {
    logger.error("Failed to bootstrap master process:", error);
    process.exit(1);
  }
}

main();

export { app };
export default app;

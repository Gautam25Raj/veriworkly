import { Request, Response } from "express";

import prisma from "#lib/prisma";
import { logger } from "#lib/logger";
import { getRedis } from "#lib/redis";
import { createErrorResponse, createSuccessResponse } from "#lib/errors";

/** Per-dependency bound for `/ready` (V-096): a probe must fail fast, not wait on the pool's 30 s. */
const READY_CHECK_TIMEOUT_MS = 2_000;

type DependencyStatus = "connected" | "timeout" | "error";

class DependencyTimeoutError extends Error {}

/**
 * Resolves to the dependency's status. Never rejects, and always clears its timer, so a probe
 * leaves nothing behind on the event loop.
 */
async function checkDependency(
  name: string,
  check: () => Promise<unknown>,
): Promise<DependencyStatus> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new DependencyTimeoutError(`${name} check timed out`)),
      READY_CHECK_TIMEOUT_MS,
    );
    timer.unref();
  });

  try {
    // `check` is invoked inside the try so a synchronous throw (getRedis when not ready) is caught.
    await Promise.race([Promise.resolve().then(check), timeout]);
    return "connected";
  } catch (error) {
    if (error instanceof DependencyTimeoutError) {
      logger.warn(`Readiness check: ${name} timed out after ${READY_CHECK_TIMEOUT_MS} ms`);
      return "timeout";
    }

    // Logged server-side only; the message can carry a connection string, so it never reaches the body.
    logger.error(`Readiness check: ${name} failed`, error);
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

export class HealthController {
  /**
   * Lightweight liveness endpoint.
   * Does not touch external dependencies, so uptime checks do not wake database compute.
   */

  static async check(_req: Request, res: Response) {
    res.json(
      createSuccessResponse(
        {
          status: "ok",
          timestamp: new Date().toISOString(),
        },
        "Server is healthy",
      ),
    );
  }

  /**
   * Comprehensive readiness endpoint.
   * Verifies connectivity to the database and Redis for manual/deploy-time checks.
   *
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */

  static async ready(_req: Request, res: Response) {
    // Checked in parallel, each bounded at READY_CHECK_TIMEOUT_MS, so the probe answers in ~2 s worst case.
    const [database, redis] = await Promise.all([
      checkDependency("database", () => prisma.$queryRaw`SELECT 1`),
      checkDependency("redis", () => getRedis().ping()),
    ]);

    if (database === "connected" && redis === "connected") {
      res.json(
        createSuccessResponse(
          {
            status: "ok",
            database,
            redis,
            timestamp: new Date().toISOString(),
          },
          "Server is healthy",
        ),
      );
      return;
    }

    res.status(503).json(createErrorResponse(503, "Service Unavailable", { database, redis }));
  }
}

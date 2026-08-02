import pg from "pg";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { config } from "#config";

import { logger } from "./logger.js";

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * The pool is per-process, but we run one process per cluster worker — so the number that has to
 * fit inside Postgres's `max_connections` is `poolMax * workers`, not `poolMax`. Sizing the pool
 * per-process (the obvious reading) silently overcommits the database: at the old default of 30
 * a 4-vCPU box opened 120 connections against a stock `max_connections` of 100 and every worker
 * failed at once on the first traffic spike.
 *
 * So the budget is expressed cluster-wide and divided down. `DB_POOL_MAX_TOTAL` defaults to 80,
 * leaving headroom under a stock Postgres for migrations, `db:studio`, and an admin psql session.
 * Raise it to roughly 80% of your instance's real `max_connections`.
 */
// Read defensively: this is a sizing hint, and the database layer must not fail to load because
// of it. Falling back to a single worker only ever under-commits the pool, which degrades
// throughput rather than taking the process down.
export const clusterWorkerCount =
  config.server?.clusteringEnabled && config.server.workers > 0 ? config.server.workers : 1;

const clusterPoolBudget = parsePositiveInt(process.env.DB_POOL_MAX_TOTAL, isProduction ? 80 : 10);
const derivedPoolMax = Math.max(2, Math.floor(clusterPoolBudget / clusterWorkerCount));

// An explicit DB_POOL_MAX still wins — some deployments sit behind PgBouncer in transaction mode
// and can safely exceed the direct-connection budget — but it is checked against the budget so a
// stale value carried over from a smaller instance is loud instead of silent.
export const poolMax = parsePositiveInt(process.env.DB_POOL_MAX, derivedPoolMax);

if (poolMax * clusterWorkerCount > clusterPoolBudget) {
  logger.warn(
    "Database pool is overcommitted: DB_POOL_MAX * workers exceeds DB_POOL_MAX_TOTAL. " +
      "Expect 'too many connections' under load unless a connection pooler sits in front.",
    {
      poolMax,
      workers: clusterWorkerCount,
      totalConnections: poolMax * clusterWorkerCount,
      budget: clusterPoolBudget,
    },
  );
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  idleTimeoutMillis: parsePositiveInt(process.env.DB_POOL_IDLE_TIMEOUT_MS, 15_000),
  connectionTimeoutMillis: parsePositiveInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS, 30_000),
  statement_timeout: parsePositiveInt(process.env.DB_POOL_STATEMENT_TIMEOUT_MS, 30_000),
  allowExitOnIdle: true,
});

pool.on("error", (err) => {
  logger.error("Unexpected database connection pool error", err);
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function closePrisma() {
  try {
    await prisma.$disconnect();
    await pool.end();
  } catch (error) {
    logger.error("Error closing Prisma connections", error);
  }
}

export default prisma;

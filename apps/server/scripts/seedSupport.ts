import { logger } from "#lib/logger";
import { initRedis } from "#lib/redis";

/**
 * Shared rules for the seed scripts (`seed:changelog`, `seed:roadmap`).
 *
 * - Every item is validated with the same admin create schema the API uses, and nothing is
 *   written unless every item passes.
 * - Existing rows are never touched: an admin edit (or a sync's enriched PR refs) is not
 *   overwritten by the file. Only ids that are missing are created, in one transaction.
 * - Production needs `--allow-production`; `--wipe` (delete every row first) is refused there.
 * - Read caches are invalidated through the services' own generation bump, never by deleting a
 *   key prefix (which also matched the sync locks, V-072).
 */
export const seedFlags = {
  wipe: process.argv.includes("--wipe"),
  allowProduction: process.argv.includes("--allow-production"),
};

export function assertSeedAllowed(name: string): void {
  if (process.env.NODE_ENV !== "production") return;

  if (seedFlags.wipe) {
    throw new Error(`${name}: --wipe is refused in production.`);
  }
  if (!seedFlags.allowProduction) {
    throw new Error(
      `${name}: NODE_ENV=production. Re-run with --allow-production to create the missing rows (existing rows are never changed).`,
    );
  }
}

/** Validates every item and throws once, listing each failing item, before anything is written. */
export function parseAll<T>(
  items: unknown[],
  label: (item: unknown, index: number) => string,
  parse: (
    item: unknown,
  ) =>
    | { success: true; data: T }
    | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } },
): T[] {
  const parsed: T[] = [];
  const problems: string[] = [];

  items.forEach((item, index) => {
    const result = parse(item);
    if (result.success) parsed.push(result.data);
    else
      problems.push(
        `${label(item, index)}: ${result.error.issues.map((issue) => `${issue.path.map(String).join(".") || "(item)"} ${issue.message}`).join("; ")}`,
      );
  });

  if (problems.length > 0) {
    throw new Error(
      `${problems.length} item(s) fail the admin schema:\n  ${problems.join("\n  ")}`,
    );
  }

  return parsed;
}

/** Connects to Redis (5 s cap) and runs the cache invalidation; warns instead of failing. */
export async function invalidateReadCaches(name: string, invalidate: () => Promise<void>) {
  try {
    await Promise.race([
      initRedis(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis connect timeout")), 5000),
      ),
    ]);
    await invalidate();
    logger.info(`${name}: read caches invalidated`);
  } catch (error) {
    logger.warn(
      `${name}: skipped the read-cache invalidation (Redis unreachable). If the running server uses this Redis, its public pages serve the old data until the cache TTL.`,
      { error: error instanceof Error ? error.message : String(error) },
    );
  }
}

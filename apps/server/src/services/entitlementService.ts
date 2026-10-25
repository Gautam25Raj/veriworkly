import type { Prisma } from "@prisma/client";

import { bumpGeneration, resolveGenerationalKey } from "#lib/cacheGeneration";
import { ApiError } from "#lib/errors";
import { prisma } from "#lib/prisma";
import { cacheGet, cacheSet } from "#lib/redis";

import type { EntitlementKey } from "#services/productCatalog";

const ENTITLEMENT_CACHE_TTL_SECONDS = 60;

/** Dates travel through Redis as ISO strings; the window is re-evaluated on every read. */
type CachedGrant = { key: string; startsAt: string; endsAt: string | null };

const activeGrantWhere = (at: Date) => ({
  startsAt: { lte: at },
  revokedAt: null,
  OR: [{ endsAt: null }, { endsAt: { gt: at } }],
});

function cacheNamespace(userId: string) {
  return `entitlements:active:${userId}`;
}

/**
 * The key the user's grant set lives under right now (`entitlements:active:{userId}:g{N}`), or
 * `null` when Redis is unavailable. Exported for the integration test that interleaves a read
 * with an invalidation.
 */
export function entitlementCacheKey(userId: string) {
  return resolveGenerationalKey(cacheNamespace(userId));
}

function isActive(grant: CachedGrant, at: Date) {
  const time = at.getTime();
  return (
    new Date(grant.startsAt).getTime() <= time &&
    (grant.endsAt === null || new Date(grant.endsAt).getTime() > time)
  );
}

/**
 * Every unrevoked grant that has not ended yet, cached per user (V-108). The window is checked
 * against `at` on each read, so a grant that ends or starts inside the TTL flips on time; only a
 * write (grant, revoke, reconcile, deletion) needs the explicit invalidation.
 *
 * The key is resolved under the user's cache generation *before* the table is read: a write
 * that bumps the generation in between leaves this reader's stale set under a key nobody reads
 * again. Redis unavailable means no key and no cache, and the table answers, never a denial.
 */
async function loadGrants(userId: string): Promise<CachedGrant[]> {
  const key = await entitlementCacheKey(userId);
  if (key) {
    const cached = await cacheGet<CachedGrant[]>(key);
    if (cached) return cached;
  }

  const now = new Date();
  const rows = await prisma.entitlementGrant.findMany({
    where: { userId, revokedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { key: true, startsAt: true, endsAt: true },
  });
  const grants = rows.map((row) => ({
    key: row.key,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
  }));
  if (key) await cacheSet(key, grants, ENTITLEMENT_CACHE_TTL_SECONDS);
  return grants;
}

export class EntitlementService {
  /**
   * Call after every committed write to `EntitlementGrant` for this user. One `INCR` moves every
   * reader to a fresh key; the old value ages out on its 60 s TTL.
   */
  static async invalidateEntitlements(userId: string) {
    await bumpGeneration(cacheNamespace(userId));
  }

  static async listActive(userId: string, at = new Date()) {
    const grants = await loadGrants(userId);
    return [...new Set(grants.filter((grant) => isActive(grant, at)).map((grant) => grant.key))];
  }

  /**
   * `client` lets a caller inside a transaction count on that connection instead of the pool;
   * that caller needs the transactional view, so the cache is skipped.
   */
  static async has(
    userId: string,
    key: EntitlementKey,
    at = new Date(),
    client: Prisma.TransactionClient = prisma,
  ) {
    if (client !== prisma)
      return (
        (await client.entitlementGrant.count({
          where: { userId, key, ...activeGrantWhere(at) },
        })) > 0
      );

    const grants = await loadGrants(userId);
    return grants.some((grant) => grant.key === key && isActive(grant, at));
  }

  static async require(userId: string, key: EntitlementKey, message: string) {
    if (!(await this.has(userId, key))) throw new ApiError(402, message);
  }
}

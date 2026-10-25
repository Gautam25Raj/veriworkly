import { bumpGeneration, resolveGenerationalKey } from "#lib/cacheGeneration";

/**
 * Redis caching for the admin overview surface.
 *
 * These four readers are the only admin endpoints worth caching: they are read-only, they are
 * re-fetched constantly, and each is a batch of aggregates rather than one lookup. The rest of
 * the admin API is either a paginated list (already cheap and filtered by query params that
 * would make the key space unbounded) or a mutation.
 *
 * The action queue is the most frequent. `AdminLayout` fetches it on *every* admin navigation to
 * render the sidebar badges, so without the cache every page load in the panel would run its six
 * `COUNT`s (each on a `[status, …]` index) on top of whatever the page itself needed.
 * `getAdminOverview` is heavier per call — eight domain summaries plus health and recent
 * activity, dozens of aggregates — but only runs on `/admin`.
 *
 * TTLs are deliberately short. This is an ops panel: an operator deciding whether to suspend a
 * portfolio needs numbers that are seconds old, not minutes. The TTL is a floor on freshness,
 * not the primary mechanism — `invalidateAdminCaches()` runs after every successful admin
 * mutation, so an operator's own action is reflected immediately rather than after the window.
 */

export const ADMIN_ACTION_QUEUE_TTL_SECONDS = 30;
export const ADMIN_RECENT_ACTIVITY_TTL_SECONDS = 30;
export const ADMIN_OVERVIEW_TTL_SECONDS = 60;

/** Charts are historical daily buckets — they move far more slowly than the live counters. */
export const ADMIN_TIME_SERIES_TTL_SECONDS = 300;

/**
 * A generation namespace (`#lib/cacheGeneration`). Versioned so a change to any cached payload's
 * shape cannot be served from a stale entry written by the previous deploy; bump the version
 * when one of these return types changes.
 *
 * Each key builder reads the current generation, so call it before building the value: a write
 * that lands during the build strands the result under the old generation.
 */
export const ADMIN_CACHE_NAMESPACE = "admin:overview:v1";

export function adminOverviewCacheKey(days: number) {
  return resolveGenerationalKey(ADMIN_CACHE_NAMESPACE, "summary", String(days));
}

export function adminActionQueueCacheKey() {
  return resolveGenerationalKey(ADMIN_CACHE_NAMESPACE, "queue");
}

export function adminRecentActivityCacheKey() {
  return resolveGenerationalKey(ADMIN_CACHE_NAMESPACE, "activity");
}

export function adminTimeSeriesCacheKey(days: number) {
  return resolveGenerationalKey(ADMIN_CACHE_NAMESPACE, "series", String(days));
}

/**
 * Drops every cached admin read in one call: one INCR of the namespace generation. The overview
 * and series keys are parameterised by `days`, so there is no fixed set of keys to enumerate;
 * the generation makes that irrelevant and costs no keyspace SCAN (V-079).
 */
export async function invalidateAdminCaches() {
  await bumpGeneration(ADMIN_CACHE_NAMESPACE);
}

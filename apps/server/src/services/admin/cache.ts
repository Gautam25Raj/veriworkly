import { cacheDelByPrefix } from "#lib/redis";

/**
 * Redis caching for the admin overview surface.
 *
 * These four readers are the only admin endpoints worth caching: they are read-only, they are
 * re-fetched constantly, and every one of them is an aggregate scan rather than an indexed
 * lookup. The rest of the admin API is either a paginated list (already cheap and filtered by
 * query params that would make the key space unbounded) or a mutation.
 *
 * The action queue is the one that actually hurt. `AdminLayout` fetches it on *every* admin
 * navigation to render the sidebar badges, so before this every page load in the panel ran six
 * un-indexed `COUNT`s on top of whatever the page itself needed. `getAdminOverview` is worse per
 * call — ten domain summaries, dozens of aggregates — but only runs on `/admin`.
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
 * Versioned so a change to any cached payload's shape cannot be served from a stale entry
 * written by the previous deploy. Bump it when one of these return types changes.
 */
export const ADMIN_CACHE_PREFIX = "admin:overview:v1:";

export function adminOverviewCacheKey(days: number) {
  return `${ADMIN_CACHE_PREFIX}summary:${days}`;
}

export function adminActionQueueCacheKey() {
  return `${ADMIN_CACHE_PREFIX}queue`;
}

export function adminRecentActivityCacheKey() {
  return `${ADMIN_CACHE_PREFIX}activity`;
}

export function adminTimeSeriesCacheKey(days: number) {
  return `${ADMIN_CACHE_PREFIX}series:${days}`;
}

/**
 * Drops every cached admin read in one call.
 *
 * A prefix delete rather than a list of `cacheDel`s because the overview and series keys are
 * parameterised by `days` (1–365 and 7–180 respectively, both clamped by the query validators),
 * so there is no fixed set of keys to enumerate. It is also the reason these keys share a
 * dedicated prefix instead of being scattered under `admin:*`, which would also match unrelated
 * entries such as `admin:dashboard:stats`.
 */
export async function invalidateAdminCaches() {
  await cacheDelByPrefix(ADMIN_CACHE_PREFIX);
}

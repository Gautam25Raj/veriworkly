/**
 * Typed cache-key builders. Centralizing these means a future format change (or typo) is caught
 * by the compiler across every call site, instead of requiring a repo-wide grep for a hand-typed
 * string template that's easy to miss in one of the several files that read or invalidate it.
 */

export function userProfileCacheKey(userId: string): string {
  return `user:profile:v2:${userId}`;
}

/**
 * Prefix covering every cached document-list variant for a user.
 *
 * The list cache is keyed by type *and* by `updatedSince` and whether bodies were
 * included, so there is no longer a fixed set of keys to delete by name. Every
 * mutation must invalidate by this prefix — deleting only `…:all` and `…:<TYPE>`
 * (what the call sites used to do) would leave incremental and full-body variants
 * serving stale documents for the rest of their 30-minute TTL.
 */
export function documentListCachePrefix(userId: string): string {
  return `documents:list:${userId}:`;
}

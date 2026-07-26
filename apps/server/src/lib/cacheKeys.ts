/**
 * Typed cache-key builders. Centralizing these means a future format change (or typo) is caught
 * by the compiler across every call site, instead of requiring a repo-wide grep for a hand-typed
 * string template that's easy to miss in one of the several files that read or invalidate it.
 */

export function userProfileCacheKey(userId: string): string {
  return `user:profile:v2:${userId}`;
}

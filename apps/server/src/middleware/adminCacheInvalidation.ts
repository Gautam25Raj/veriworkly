import { NextFunction, Request, Response } from "express";

import { logger } from "#lib/logger";
import { invalidateAdminCaches } from "#services/admin/cache";

/** Anything that is not a read is treated as a potential mutation. */
function isMutation(method: string) {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

/**
 * Drops the cached admin overview reads after a successful admin mutation.
 *
 * Without this, an operator who approves a withdrawal watches the sidebar badge keep showing
 * the old count until the 30s TTL lapses — the panel looks like it ignored the action, and the
 * usual reaction is to click again. Expiry alone cannot fix that; only invalidation can.
 *
 * Three deliberate choices:
 *
 * - It hooks `res.on("finish")` rather than wrapping the handler, so it sees the real status
 *   code and skips invalidation for a request that failed validation or the admin gate.
 * - It runs *after* the response is sent, so a Redis hiccup adds no latency to the mutation and
 *   cannot turn a successful write into a failed request.
 * - It is coarse: any successful admin write drops every cached admin read. The alternative is
 *   mapping each route to the summaries it affects, which is a table that silently goes stale
 *   the first time a service starts counting something new. These reads are cheap to rebuild
 *   and admin writes are rare, so precision buys nothing here.
 */
export function invalidateAdminCacheOnWrite(req: Request, res: Response, next: NextFunction) {
  if (!isMutation(req.method)) return next();

  res.on("finish", () => {
    if (res.statusCode >= 400) return;

    void invalidateAdminCaches().catch((error) => {
      // A failed invalidation is not worth surfacing to the operator — the write itself already
      // succeeded, and the TTL still bounds how long the stale counts can survive.
      logger.error("Failed to invalidate admin caches after a write", error);
    });
  });

  next();
}

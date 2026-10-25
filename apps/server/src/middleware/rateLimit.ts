import { Request, Response, NextFunction } from "express";

import { config } from "#config";

import { logger } from "#lib/logger";
import { getRedis } from "#lib/redis";
import { createErrorResponse } from "#lib/errors";
import { addressBucket, getRequestIpDetails } from "#utils/requestIp";
import { parseIntegerEnv } from "#config/parseEnv";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type BucketResult = { count: number; ttl: number };

// Strict parse: `MAX_MEMORY_ENTRIES=abc` used to give NaN, which made the fallback map unbounded.
const MAX_MEMORY_ENTRIES = parseIntegerEnv(process.env.MAX_MEMORY_ENTRIES, 15000);
const bucket = new Map<string, RateLimitEntry>();

/**
 * Paths that must never be rate limited by client IP. The billing webhook arrives from a small
 * set of provider egress IPs and is already authenticated by HMAC signature — limiting it means a
 * provider retry storm gets 429'd and payment state silently diverges from reality.
 */
/*
 * Health probes (V-096): a load balancer probing from one IP every few seconds would otherwise
 * be 429'd and mark the instance unhealthy, and the liveness probe must not depend on Redis.
 *
 * Entries are lowercase with no trailing slash, matched against `normalizePath`.
 */
const RATE_LIMIT_EXEMPT_PATHS = new Set([
  "/api/v1/billing/webhooks/dodo",
  "/api/v1/health",
  "/api/v1/health/ready",
]);

/**
 * Express routing is case-insensitive and non-strict, so `/API/v1/Contact/` reaches the same
 * handler as `/api/v1/contact` (V-087). Class selection, exemptions and bucket keys all use this
 * one spelling; otherwise each variant gets its own bucket, under the wrong class.
 */
function normalizePath(path: string): string {
  return path.toLowerCase().replace(/\/+$/, "") || "/";
}

function isRateLimitExempt(path: string): boolean {
  return RATE_LIMIT_EXEMPT_PATHS.has(normalizePath(path));
}

function getClientKey(req: Request): string {
  const ip = getRequestIpDetails(req).resolvedIp;
  return ip ? addressBucket(ip) : "unknown";
}

function getSanitizedPath(path: string): string {
  return path
    .split("/")
    .map((segment) => {
      if (
        /^\d+$/.test(segment) ||
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(segment) ||
        (segment.length >= 10 && /[a-zA-Z]/.test(segment) && /[0-9]/.test(segment))
      )
        return ":id";

      return segment;
    })
    .join("/");
}

function getRouteLimitConfig(path: string) {
  const isAiRoute = path.startsWith("/api/v1/ai");
  const isAuthRoute = path.startsWith("/api/v1/auth");
  const isStatsEventsRoute = path.startsWith("/api/v1/stats/events");
  const isContactRoute = path.startsWith("/api/v1/contact");

  const isShareVerifyRoute = /\/shares\/public\/[^/]+\/[^/]+\/verify$/.test(path);

  // Coarse outer bound per IP (most usernames/slugs fold to `:id`, so this bucket is shared across
  // links). The real guard is 5 attempts per (link, IP) in `ShareController.verifyPublicReadable`.
  if (isShareVerifyRoute)
    return {
      windowMs: 60 * 5000, // 5 minutes
      maxRequests: 20, // 20 requests per 5 minutes
    };

  if (isContactRoute)
    return {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5, // 5 requests per hour — unauthenticated route that triggers outbound email
    };

  if (isStatsEventsRoute)
    return {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 15, // 15 requests per minute
    };

  if (isAiRoute)
    return {
      windowMs: config.ai.rateLimitWindowMs,
      maxRequests: config.ai.rateLimitMaxRequests,
    };

  return {
    windowMs: isAuthRoute ? config.rateLimit.authWindowMs : config.rateLimit.windowMs,
    maxRequests: isAuthRoute ? config.rateLimit.authMaxRequests : config.rateLimit.maxRequests,
  };
}

function pruneExpiredEntries() {
  const now = Date.now();

  for (const [key, entry] of bucket.entries()) {
    if (entry.resetAt <= now) bucket.delete(key);
  }
}

const cleanupInterval = setInterval(pruneExpiredEntries, 10 * 60 * 1000);
cleanupInterval.unref();

/**
 * Increments the per-route and global buckets in one round trip. Returning both counters from a
 * single script keeps the two windows consistent with each other and avoids paying two RTTs on
 * every request.
 */
const INCREMENT_WITH_EXPIRY_SCRIPT = `
  local results = {}
  for i = 1, 2 do
    local count = redis.call("INCR", KEYS[i])
    if count == 1 then
      redis.call("PEXPIRE", KEYS[i], ARGV[i])
    end
    results[#results + 1] = count
    results[#results + 1] = redis.call("PTTL", KEYS[i])
  end
  return results
`;

function incrementMemoryBucket(key: string, windowMs: number, now: number): BucketResult {
  const current = bucket.get(key);

  if (!current || current.resetAt <= now) {
    if (bucket.size > MAX_MEMORY_ENTRIES) {
      pruneExpiredEntries();
    }

    if (bucket.size > MAX_MEMORY_ENTRIES) {
      // Evict the oldest entries (Map preserves insertion order) rather than clearing
      // everyone's counters — a full clear would reset rate limits for every client at
      // exactly the high-traffic/Redis-outage moment the limiter exists to protect against.
      logger.warn("Rate limit memory bucket reached max capacity! Evicting oldest entries.");

      const excess = bucket.size - MAX_MEMORY_ENTRIES + 1;
      const keysToEvict: string[] = [];

      for (const existingKey of bucket.keys()) {
        if (keysToEvict.length >= excess) break;
        keysToEvict.push(existingKey);
      }

      for (const evictKey of keysToEvict) bucket.delete(evictKey);
    }

    bucket.set(key, { count: 1, resetAt: now + windowMs });

    return { count: 1, ttl: windowMs };
  }

  current.count += 1;
  return { count: current.count, ttl: Math.max(0, current.resetAt - now) };
}

/**
 * Fixed-window counter for limits that live inside a handler (share verify, OTP and contact mail
 * throttles): `INCR` and `EXPIRE … NX` in one `MULTI`, so the window starts at the first hit and
 * later hits never extend it. Throws when Redis is unavailable; each caller decides whether that
 * fails open or closed.
 */
export async function incrementFixedWindow(
  key: string,
  windowSeconds: number,
): Promise<{ count: number; ttlSeconds: number }> {
  const [count, , ttl] = (await getRedis()
    .multi()
    .incr(key)
    .expire(key, windowSeconds, "NX")
    .ttl(key)
    .exec()) as unknown as [number, number, number];

  return { count: Number(count), ttlSeconds: Number(ttl) > 0 ? Number(ttl) : windowSeconds };
}

export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (config.nodeEnv === "development") return next();
  if (isRateLimitExempt(req.path)) return next();

  const now = Date.now();

  const path = normalizePath(req.path);
  const { windowMs, maxRequests } = getRouteLimitConfig(path);
  const { globalWindowMs, globalMaxRequests } = config.rateLimit;
  const key = getClientKey(req);

  const sanitizedPath = getSanitizedPath(path);
  const routeKey = `rate-limit:${req.method}:${sanitizedPath}:${key}`;
  const globalKey = `rate-limit:global:${key}`;

  const checkWithFallback = async (): Promise<{ route: BucketResult; global: BucketResult }> => {
    try {
      const redis = getRedis();

      const [routeCount, routeTtl, globalCount, globalTtl] = (await redis.eval(
        INCREMENT_WITH_EXPIRY_SCRIPT,
        {
          keys: [routeKey, globalKey],
          arguments: [String(windowMs), String(globalWindowMs)],
        },
      )) as [number, number, number, number];

      return {
        route: { count: routeCount, ttl: routeTtl },
        global: { count: globalCount, ttl: globalTtl },
      };
    } catch {
      return {
        route: incrementMemoryBucket(routeKey, windowMs, now),
        global: incrementMemoryBucket(globalKey, globalWindowMs, now),
      };
    }
  };

  let shouldContinue = false;
  let isLimitExceeded = false;
  let retryAfter = 0;
  let exceededScope: "route" | "global" = "route";

  try {
    const { route, global } = await checkWithFallback();

    const routeExceeded = route.count > maxRequests;
    const globalExceeded = global.count > globalMaxRequests;

    if (!routeExceeded && !globalExceeded) shouldContinue = true;
    else {
      isLimitExceeded = true;
      exceededScope = routeExceeded ? "route" : "global";

      const { ttl } = routeExceeded ? route : global;
      const fallbackWindowMs = routeExceeded ? windowMs : globalWindowMs;

      retryAfter = ttl > 0 ? Math.ceil(ttl / 1000) : Math.ceil(fallbackWindowMs / 1000);
    }
  } catch (err) {
    logger.error("Rate limit middleware failure", err);
    shouldContinue = true;
  }

  if (shouldContinue) next();
  else if (isLimitExceeded) {
    logger.warn(`Rate limit exceeded for IP: ${key}`, { scope: exceededScope, path: req.path });

    res.set("Retry-After", String(retryAfter));
    res.status(429).json(createErrorResponse(429, "Too many requests. Please try again later."));
  }
};

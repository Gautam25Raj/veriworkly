import { Request, Response, NextFunction } from "express";

import { config } from "#config";

import { logger } from "#lib/logger";
import { getRedis } from "#lib/redis";
import { createErrorResponse } from "#lib/errors";
import { getRequestIpDetails } from "#utils/requestIp";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type BucketResult = { count: number; ttl: number };

const MAX_MEMORY_ENTRIES = process.env.MAX_MEMORY_ENTRIES
  ? parseInt(process.env.MAX_MEMORY_ENTRIES, 10)
  : 15000;
const bucket = new Map<string, RateLimitEntry>();

/**
 * Paths that must never be rate limited by client IP. The billing webhook arrives from a small
 * set of provider egress IPs and is already authenticated by HMAC signature — limiting it means a
 * provider retry storm gets 429'd and payment state silently diverges from reality.
 */
const RATE_LIMIT_EXEMPT_PATHS = new Set(["/api/v1/billing/webhooks/dodo"]);

function getClientKey(req: Request): string {
  const ip = getRequestIpDetails(req).resolvedIp;
  return ip || "unknown";
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

function getRouteLimitConfig(req: Request) {
  const isAiRoute = req.path.startsWith("/api/v1/ai");
  const isAuthRoute = req.path.startsWith("/api/v1/auth");
  const isStatsEventsRoute = req.path.startsWith("/api/v1/stats/events");
  const isContactRoute = req.path.startsWith("/api/v1/contact");

  const isShareVerifyRoute = /\/shares\/public\/[^/]+\/[^/]+\/verify$/.test(req.path);

  if (isShareVerifyRoute)
    return {
      windowMs: 60 * 5000, // 5 minutes
      maxRequests: 3, // 3 requests per 5 minutes
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

export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (config.nodeEnv === "development") return next();
  if (RATE_LIMIT_EXEMPT_PATHS.has(req.path)) return next();

  const now = Date.now();

  const { windowMs, maxRequests } = getRouteLimitConfig(req);
  const { globalWindowMs, globalMaxRequests } = config.rateLimit;
  const key = getClientKey(req);

  const sanitizedPath = getSanitizedPath(req.path);
  const routeKey = `rate-limit:${req.method}:${sanitizedPath}:${key}`;
  const globalKey = `rate-limit:global:${key}`;

  const checkWithFallback = async (): Promise<{ route: BucketResult; global: BucketResult }> => {
    try {
      const redis = getRedis();

      if (!redis.isOpen) throw new Error("Redis not open");

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

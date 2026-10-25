import { Request, Response, NextFunction } from "express";

import { config } from "#config";

import { logger } from "#lib/logger";
import { getRedis } from "#lib/redis";
import { ApiError, createErrorResponse } from "#lib/errors";
import { AI_REQUEST_DEADLINE_MS } from "#services/ats/aiDeadline";
import { addressBucket, getRequestIpDetails, matchesSharedSecret } from "#utils/requestIp";
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
 * The ATS routes that spend AI credits. They sat in the generic 100/15 min class while
 * `/api/v1/ai/*` had its own 20/min, although each call holds a provider connection for up to
 * the request deadline (V-038).
 */
const AI_BILLED_ATS_PATHS = new Set(["/api/v1/ats/analyze", "/api/v1/ats/convert-resume"]);

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

type RouteLimit = {
  windowMs: number;
  maxRequests: number;
  /**
   * V-160: without Redis the limiter counts in this process's memory, which multiplies every
   * limit by the number of workers and replicas. For the classes that guard a password guess,
   * an outbound email or an OTP, that is not a limit at all; they answer 503 instead.
   */
  failClosed: boolean;
};

/**
 * The server's own apps post to `/stats/events` with `STATS_INTERNAL_KEY`; from one egress IP
 * they would exhaust the 15/min public class in seconds. They take the generic class instead.
 */
function isInternalStatsRequest(req: Request, path: string) {
  return (
    path.startsWith("/api/v1/stats/events") &&
    matchesSharedSecret(req.headers["x-internal-key"], config.metrics.statsInternalKey)
  );
}

function getRouteLimitConfig(path: string, internalStats = false): RouteLimit {
  const isAiRoute = path.startsWith("/api/v1/ai") || AI_BILLED_ATS_PATHS.has(path);
  const isAuthRoute = path.startsWith("/api/v1/auth");
  const isOtpRoute = /^\/api\/v1\/auth\/(email-otp\/|forget-password\/email-otp)/.test(path);
  const isStatsEventsRoute = path.startsWith("/api/v1/stats/events") && !internalStats;
  const isContactRoute = path.startsWith("/api/v1/contact");

  const isShareVerifyRoute = /\/shares\/public\/[^/]+\/[^/]+\/verify$/.test(path);

  // Coarse outer bound per IP (most usernames/slugs fold to `:id`, so this bucket is shared across
  // links). The real guard is 5 attempts per (link, IP) in `ShareController.verifyPublicReadable`.
  if (isShareVerifyRoute)
    return {
      windowMs: 60 * 5000, // 5 minutes
      maxRequests: 20, // 20 requests per 5 minutes
      failClosed: true,
    };

  if (isContactRoute)
    return {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5, // 5 requests per hour — unauthenticated route that triggers outbound email
      failClosed: true,
    };

  if (isStatsEventsRoute)
    return {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 15, // 15 requests per minute
      failClosed: false,
    };

  if (isAiRoute)
    return {
      windowMs: config.ai.rateLimitWindowMs,
      maxRequests: config.ai.rateLimitMaxRequests,
      failClosed: false,
    };

  return {
    windowMs: isAuthRoute ? config.rateLimit.authWindowMs : config.rateLimit.windowMs,
    maxRequests: isAuthRoute ? config.rateLimit.authMaxRequests : config.rateLimit.maxRequests,
    failClosed: isOtpRoute,
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
 * Whether the limiter is currently counting in this process's memory because Redis is
 * unavailable (V-160). Each transition is logged once, so an outage is visible in the log
 * without a line per request, and the recovery is visible too.
 */
let usingMemoryFallback = false;

function noteRedisFailure(error: unknown) {
  if (usingMemoryFallback) return;
  usingMemoryFallback = true;
  logger.warn(
    "Rate limiter: Redis unavailable, counting in process memory (limits are per worker)",
    {
      error: error instanceof Error ? error.message : String(error),
    },
  );
}

function noteRedisRecovery() {
  if (!usingMemoryFallback) return;
  usingMemoryFallback = false;
  logger.warn("Rate limiter: Redis recovered, shared counters are back");
}

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

/** Concurrent provider calls one user may hold (V-038). */
export const AI_IN_FLIGHT_MAX = 2;
/**
 * The longest a job-page fetch can take ahead of the AI deadline: up to four hops, each a 5 s
 * DNS lookup and a 15 s request (`jobFetch.ts`).
 */
const JOB_FETCH_WORST_MS = 4 * (5_000 + 15_000);
/**
 * A slot a crashed worker never released clears itself just after the longest request it could
 * have been held for: the job fetch, then the AI deadline.
 */
const AI_IN_FLIGHT_TTL_SECONDS =
  Math.ceil((AI_REQUEST_DEADLINE_MS + JOB_FETCH_WORST_MS) / 1000) + 5;

let slotCountWarned = false;

/** Drops the slot and the key with it once no call is left, so an idle user has no key at all. */
const RELEASE_AI_SLOT_SCRIPT = `
  local left = redis.call("DECR", KEYS[1])
  if left <= 0 then redis.call("DEL", KEYS[1]) end
  return left
`;

function aiSlotKey(userId: string) {
  return `ai:in-flight:${userId}`;
}

/**
 * Runs `work` holding one of the user's AI slots; a third concurrent call is a 429 before it
 * reserves credits or reaches the provider. Without Redis the cap cannot be shared between
 * workers, so the call runs uncounted (the credit ledger still bounds it) and the degradation
 * is logged once like the IP limiter's.
 */
export async function withAiSlot<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const key = aiSlotKey(userId);
  let redis: ReturnType<typeof getRedis>;
  try {
    redis = getRedis();
    let count: number;
    try {
      [count] = (await redis
        .multi()
        .incr(key)
        .expire(key, AI_IN_FLIGHT_TTL_SECONDS, "NX")
        .exec()) as unknown as [number, number];
    } catch (error) {
      // The count is unknown: a Redis before 7 rejects `EXPIRE … NX` (and discards the whole
      // transaction), a dropped connection may have applied the INCR. The release script undoes
      // a counted increment and deletes a key left at zero or below, so either way the user
      // is not locked out; the call runs uncounted and this is logged once.
      await redis.eval(RELEASE_AI_SLOT_SCRIPT, { keys: [key] }).catch(() => undefined);
      if (!slotCountWarned) {
        slotCountWarned = true;
        logger.warn("AI in-flight slot could not be counted; calls run uncounted", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return work();
    }
    noteRedisRecovery();
    if (Number(count) > AI_IN_FLIGHT_MAX) {
      await redis.eval(RELEASE_AI_SLOT_SCRIPT, { keys: [key] }).catch(() => undefined);
      throw new ApiError(
        429,
        "Too many AI requests in progress. Wait for one to finish and try again.",
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    noteRedisFailure(error);
    return work();
  }

  try {
    return await work();
  } finally {
    try {
      await redis.eval(RELEASE_AI_SLOT_SCRIPT, { keys: [key] });
    } catch (error) {
      logger.warn("AI in-flight slot release failed; it expires with the request deadline", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (config.nodeEnv === "development") return next();
  if (isRateLimitExempt(req.path)) return next();

  const now = Date.now();

  const path = normalizePath(req.path);
  const { windowMs, maxRequests, failClosed } = getRouteLimitConfig(
    path,
    isInternalStatsRequest(req, path),
  );
  const { globalWindowMs, globalMaxRequests } = config.rateLimit;
  const key = getClientKey(req);

  const sanitizedPath = getSanitizedPath(path);
  const routeKey = `rate-limit:${req.method}:${sanitizedPath}:${key}`;
  const globalKey = `rate-limit:global:${key}`;

  /** `null` when the class fails closed and Redis is unavailable. */
  const checkWithFallback = async (): Promise<{
    route: BucketResult;
    global: BucketResult;
  } | null> => {
    try {
      const redis = getRedis();

      const [routeCount, routeTtl, globalCount, globalTtl] = (await redis.eval(
        INCREMENT_WITH_EXPIRY_SCRIPT,
        {
          keys: [routeKey, globalKey],
          arguments: [String(windowMs), String(globalWindowMs)],
        },
      )) as [number, number, number, number];

      noteRedisRecovery();
      return {
        route: { count: routeCount, ttl: routeTtl },
        global: { count: globalCount, ttl: globalTtl },
      };
    } catch (error) {
      noteRedisFailure(error);
      if (failClosed) return null;
      return {
        route: incrementMemoryBucket(routeKey, windowMs, now),
        global: incrementMemoryBucket(globalKey, globalWindowMs, now),
      };
    }
  };

  let shouldContinue = false;
  let isLimitExceeded = false;
  let isUnavailable = false;
  let retryAfter = 0;
  let exceededScope: "route" | "global" = "route";

  try {
    const counted = await checkWithFallback();

    if (!counted) isUnavailable = true;
    else {
      const { route, global } = counted;
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
    }
  } catch (err) {
    logger.error("Rate limit middleware failure", err);
    shouldContinue = true;
  }

  if (shouldContinue) next();
  else if (isUnavailable) {
    res.set("Retry-After", "5");
    res
      .status(503)
      .json(
        createErrorResponse(503, "Rate limiting is temporarily unavailable. Please retry shortly."),
      );
  } else if (isLimitExceeded) {
    logger.warn(`Rate limit exceeded for IP: ${key}`, { scope: exceededScope, path: req.path });

    res.set("Retry-After", String(retryAfter));
    res.status(429).json(createErrorResponse(429, "Too many requests. Please try again later."));
  }
};

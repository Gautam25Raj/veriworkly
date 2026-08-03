import { createHmac } from "node:crypto";

import { config } from "#config";
import { EntitlementService } from "#services/entitlementService";
import { publicAtsPolicy } from "#services/ats/aiPolicy";
import type { AtsQuotaSummary } from "#services/ats/types";
import { ApiError } from "#lib/errors";
import { prisma } from "#lib/prisma";
import { getRedis } from "#lib/redis";

const ANONYMOUS_WINDOW_SECONDS = 48 * 60 * 60;
const FREE_WINDOW_SECONDS = 24 * 60 * 60;
const PAID_LIMIT = 300;

/**
 * Extraction (file upload -> text) has its own budget, separate from the scan quota above.
 * It used to share the same counter as check/analyze, which meant an anonymous visitor
 * (scan limit: 1 per 48h) could spend their only scan just by uploading a file — the check
 * call that followed always came back 429. Extraction is still IP/size/type limited on its
 * own, so a more generous, independent allowance is safe.
 */
const ANONYMOUS_EXTRACT_LIMIT = 3;
const FREE_EXTRACT_LIMIT = 6;
const PAID_EXTRACT_LIMIT = 300;

const INCREMENT_SCRIPT = `local current = tonumber(redis.call("GET", KEYS[1]) or "0")
         local limit = tonumber(ARGV[1])
         if current >= limit then return -1 end
         current = redis.call("INCR", KEYS[1])
         if current == 1 then redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2])) end
         return current`;

function anonymousId(ip: string) {
  return createHmac("sha256", config.auth.secret).update(ip).digest("hex").slice(0, 32);
}

function anchoredUtcDate(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

async function paidPeriod(userId: string) {
  if (!(await EntitlementService.has(userId, "ai_credits"))) return null;
  const now = new Date();
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      productKey: { in: ["ai_credits", "bundle"] },
      status: { in: ["ACTIVE", "TRIALING"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { interval: true, currentPeriodEnd: true, createdAt: true },
  });
  const anchor = subscription?.createdAt ?? now;
  let end =
    subscription?.interval === "MONTHLY" && subscription.currentPeriodEnd
      ? subscription.currentPeriodEnd
      : anchoredUtcDate(now.getUTCFullYear(), now.getUTCMonth(), anchor.getUTCDate());
  if (end <= now)
    end = anchoredUtcDate(end.getUTCFullYear(), end.getUTCMonth() + 1, anchor.getUTCDate());
  const start = anchoredUtcDate(end.getUTCFullYear(), end.getUTCMonth() - 1, anchor.getUTCDate());
  return { key: `ats:quota:subscriber:${userId}:${start.toISOString().slice(0, 10)}`, end };
}

async function readCounter(key: string, windowSeconds: number, paidTtlSeconds: number | null) {
  const redis = getRedis();
  const used = Number((await redis.get(key)) ?? 0);
  const rawTtl = paidTtlSeconds ?? (await redis.ttl(key));
  const ttl = rawTtl > 0 ? rawTtl : windowSeconds;
  return { used, ttl };
}

async function incrementCounter(key: string, limit: number, ttlSeconds: number) {
  const used = Number(
    await getRedis().eval(INCREMENT_SCRIPT, {
      keys: [key],
      arguments: [String(limit), String(ttlSeconds)],
    }),
  );
  return used >= 0;
}

export class AtsQuotaService {
  static async summary(userId: string | undefined, ip: string): Promise<AtsQuotaSummary> {
    const paid = userId ? await paidPeriod(userId) : null;
    const tier = paid ? "subscriber" : userId ? "free" : "anonymous";
    const limit = paid ? PAID_LIMIT : userId ? 2 : 1;
    const extractLimit = paid
      ? PAID_EXTRACT_LIMIT
      : userId
        ? FREE_EXTRACT_LIMIT
        : ANONYMOUS_EXTRACT_LIMIT;
    const windowSeconds = userId ? FREE_WINDOW_SECONDS : ANONYMOUS_WINDOW_SECONDS;
    const paidTtlSeconds = paid
      ? Math.max(1, Math.ceil((paid.end.getTime() - Date.now()) / 1000))
      : null;
    const key = paid?.key ?? `ats:quota:${tier}:${userId ?? anonymousId(ip)}`;
    const extractKey = paid?.key
      ? `${paid.key}:extract`
      : `ats:extract-quota:${tier}:${userId ?? anonymousId(ip)}`;

    const [{ used, ttl }, extractCounter] = await Promise.all([
      readCounter(key, windowSeconds, paidTtlSeconds),
      readCounter(extractKey, windowSeconds, paidTtlSeconds),
    ]);

    return {
      tier,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      resetsAt: new Date(Date.now() + ttl * 1000).toISOString(),
      canConvertResume: Boolean(paid),
      pricing: publicAtsPolicy(),
      extract: {
        limit: extractLimit,
        used: extractCounter.used,
        remaining: Math.max(0, extractLimit - extractCounter.used),
      },
    };
  }

  static async consume(userId: string | undefined, ip: string) {
    const summary = await this.summary(userId, ip);
    const paid = userId ? await paidPeriod(userId) : null;
    const key = paid?.key ?? `ats:quota:${summary.tier}:${userId ?? anonymousId(ip)}`;
    const windowSeconds = userId ? FREE_WINDOW_SECONDS : ANONYMOUS_WINDOW_SECONDS;
    const ttl = paid
      ? Math.max(1, Math.ceil((paid.end.getTime() - Date.now()) / 1000))
      : windowSeconds;

    const ok = await incrementCounter(key, summary.limit, ttl);
    if (!ok) throw new ApiError(429, "ATS scan quota exceeded.", await this.summary(userId, ip));
    return this.summary(userId, ip);
  }

  /**
   * Extraction has its own budget so uploading a file never spends the scan quota above —
   * see the comment on ANONYMOUS_EXTRACT_LIMIT.
   */
  static async consumeExtract(userId: string | undefined, ip: string) {
    const paid = userId ? await paidPeriod(userId) : null;
    const tier = paid ? "subscriber" : userId ? "free" : "anonymous";
    const extractLimit = paid
      ? PAID_EXTRACT_LIMIT
      : userId
        ? FREE_EXTRACT_LIMIT
        : ANONYMOUS_EXTRACT_LIMIT;
    const windowSeconds = userId ? FREE_WINDOW_SECONDS : ANONYMOUS_WINDOW_SECONDS;
    const ttl = paid
      ? Math.max(1, Math.ceil((paid.end.getTime() - Date.now()) / 1000))
      : windowSeconds;
    const extractKey = paid?.key
      ? `${paid.key}:extract`
      : `ats:extract-quota:${tier}:${userId ?? anonymousId(ip)}`;

    const ok = await incrementCounter(extractKey, extractLimit, ttl);
    if (!ok) throw new ApiError(429, "ATS upload quota exceeded.", await this.summary(userId, ip));
    return this.summary(userId, ip);
  }
}

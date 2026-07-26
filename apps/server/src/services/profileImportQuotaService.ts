import { prisma } from "#lib/prisma";
import { getRedis } from "#lib/redis";
import { EntitlementService } from "#services/entitlementService";
import { ApiError } from "#lib/errors";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// GitHub's authenticated REST rate limit (5,000 req/hour) is shared across every paid import via
// the single server-side config.github.token, plus the GitHub sync cron job. "Unlimited" paid
// imports must still be capped per-user so one account can't exhaust that shared budget and break
// imports/sync for everyone else — this is deliberately generous, not a real usage ceiling.
const PAID_GITHUB_IMPORT_DAILY_LIMIT = 50;

export class ProfileImportQuotaService {
  /**
   * Check user quota status.
   * Paid users get unlimited.
   * Free users get once a month for LinkedIn, once a day for GitHub.
   */
  static async checkQuota(userId: string, provider: "linkedin" | "github") {
    const isPaid =
      (await EntitlementService.has(userId, "ai_credits")) ||
      (await EntitlementService.has(userId, "portfolio_publish"));

    if (isPaid) {
      return {
        isPaid: true,
        remaining: 9999,
        limit: 9999,
        resetsInSeconds: 0,
        connectedUsername: null,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        lastLinkedinImportAt: true,
        lastGithubImportAt: true,
      },
    });

    let connectedUsername: string | null = null;
    if (provider === "github") {
      const account = await prisma.account.findFirst({
        where: { userId, providerId: "github" },
        select: { accessToken: true },
      });
      if (account?.accessToken) {
        try {
          const response = await fetch("https://api.github.com/user", {
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${account.accessToken}`,
              "User-Agent": "VeriWorkly-App",
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data?.login) {
              connectedUsername = data.login;
            }
          }
        } catch {
          // ignore API errors
        }
      }
    }

    const lastImport =
      provider === "linkedin" ? user?.lastLinkedinImportAt : user?.lastGithubImportAt;
    const limitDuration = provider === "linkedin" ? THIRTY_DAYS_MS : ONE_DAY_MS;

    let resetsInSeconds = 0;
    let remaining = 1;

    if (lastImport) {
      const diff = Date.now() - new Date(lastImport).getTime();
      if (diff < limitDuration) {
        remaining = 0;
        resetsInSeconds = Math.ceil((limitDuration - diff) / 1000);
      }
    }

    return {
      isPaid: false,
      remaining,
      limit: 1,
      resetsInSeconds,
      connectedUsername,
    };
  }

  /**
   * Per-user daily cap on paid GitHub imports, independent of the free-tier quota. Protects the
   * single shared config.github.token's rate-limit budget from being exhausted by one account.
   */
  static async consumePaidGithubImportQuota(userId: string) {
    const redis = getRedis();
    const dayKey = new Date().toISOString().slice(0, 10);
    const redisKey = `import:paid-github:${userId}:${dayKey}`;

    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, 24 * 60 * 60);
    }

    if (count > PAID_GITHUB_IMPORT_DAILY_LIMIT) {
      throw new ApiError(
        429,
        `You've reached the daily limit of ${PAID_GITHUB_IMPORT_DAILY_LIMIT} GitHub imports. ` +
          "This protects the shared GitHub API budget used by all users. Please try again tomorrow.",
      );
    }
  }

  /**
   * Consume user quota. Throws ApiError if quota is exceeded.
   */
  static async consumeQuota(userId: string, provider: "linkedin" | "github") {
    const isPaid =
      (await EntitlementService.has(userId, "ai_credits")) ||
      (await EntitlementService.has(userId, "portfolio_publish"));

    if (isPaid) {
      if (provider === "github") await this.consumePaidGithubImportQuota(userId);
      return;
    }

    const now = new Date();
    const limitDuration = provider === "linkedin" ? THIRTY_DAYS_MS : ONE_DAY_MS;
    const cutoff = new Date(now.getTime() - limitDuration);

    // Atomic check-and-consume: the where clause only matches rows that are actually eligible
    // (never imported, or last import outside the window), so a count of 0 unambiguously means
    // quota was already consumed — no separate read-then-write race is possible, mirroring the
    // updateMany + affected-row-count pattern CreditService uses for balance mutations.
    const result =
      provider === "linkedin"
        ? await prisma.user.updateMany({
            where: {
              id: userId,
              OR: [{ lastLinkedinImportAt: null }, { lastLinkedinImportAt: { lt: cutoff } }],
            },
            data: { lastLinkedinImportAt: now },
          })
        : await prisma.user.updateMany({
            where: {
              id: userId,
              OR: [{ lastGithubImportAt: null }, { lastGithubImportAt: { lt: cutoff } }],
            },
            data: { lastGithubImportAt: now },
          });

    if (result.count === 0) {
      const status = await this.checkQuota(userId, provider);
      const providerLabel = provider === "linkedin" ? "LinkedIn" : "GitHub";
      const timeframe = provider === "linkedin" ? "once a month" : "once a day";
      throw new ApiError(
        429,
        `Free users can only import from ${providerLabel} ${timeframe}. Upgrade to Creator Pro for unlimited imports.`,
        { resetsInSeconds: status.resetsInSeconds },
      );
    }
  }
}

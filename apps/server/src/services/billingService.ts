import { randomUUID } from "node:crypto";

import { z } from "zod";
import DodoPayments from "dodopayments";

import {
  Prisma,
  type EntitlementSource,
  type Subscription as PrismaSubscription,
} from "@prisma/client";

import { config } from "#config";

import {
  dodoPaymentSchema,
  dodoWebhookEventSchema,
  dodoSubscriptionSchema,
} from "#validators/billingValidator";

import { prisma } from "#lib/prisma";
import { logger } from "#lib/logger";
import { ApiError } from "#lib/errors";
import { cacheDel, cacheGet, cacheSet, getRedis } from "#lib/redis";
import { userProfileCacheKey } from "#lib/cacheKeys";
import { EntitlementService } from "#services/entitlementService";
import { AffiliateService } from "#services/affiliate/index";
import { AFFILIATE_TIER_RATE_BPS } from "#services/affiliate/constants";
import { CreditService } from "#services/creditService";
import {
  sendSubscriptionPurchasedEmail,
  sendSubscriptionCancelledEmail,
} from "#services/mail/billingMail";
import {
  creditPackCatalog,
  isCreditPackKey,
  ENTITLEMENT_KEYS,
  getProductFromProviderId,
  getProviderProductId,
  isCatalogInterval,
  isProductKey,
  productCatalog,
  publicCatalog,
  publicCreditEconomics,
  type CreditPackKey,
  type ProductKey,
  type CatalogInterval,
} from "#services/productCatalog";
import {
  revalidatePublicPortfolios,
  invalidatePublicPortfolioCaches,
} from "#utils/portfolioPublicationCache";

type BillingIntervalInput = "one_day" | "seven_day" | "monthly" | "annual";
const BILLING_SUMMARY_TTL_SECONDS = 60;
const BILLING_HISTORY_TTL_SECONDS = 60;
const CHECKOUT_LOCK_TTL_SECONDS = 600;
/**
 * Must outlive one full processing attempt: the entitlement transaction alone may wait 10 s for
 * a connection and run 20 s, and the pre/post work (event row, cache invalidation, affiliate
 * commission) adds more. A lock that expires mid-flight lets a retry run in parallel.
 */
const WEBHOOK_LOCK_TTL_SECONDS = 60;
const WEBHOOK_LOCK_WAIT_ATTEMPTS = 10;
const WEBHOOK_LOCK_WAIT_MS = 300;
const WEBHOOK_IN_FLIGHT_MESSAGE =
  "This webhook event is already being processed by a concurrent request. Please retry.";
/**
 * The only `suspensionReason` values billing is allowed to overwrite: the ones billing itself
 * writes (`applySubscriptionEvent` stores the normalised subscription status) and the grace
 * expiry written by `jobs/portfolioAccessJob` and `portfolioService`. A row suspended for any
 * other reason belongs to someone else: `user_unpublished` (the user's own takedown) and an
 * admin's free-text reason from `adminPortfolioService.updatePublicationStatus` (an abuse
 * takedown). Billing must leave those rows alone, or the next payment would republish them.
 */
export const BILLING_SUSPENSION_REASONS = [
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "INACTIVE",
  "grace_expired",
] as const;

/** Compare-and-delete: only the attempt that took the lock may release it. */
const releaseWebhookLockScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

/**
 * Prisma's interactive-transaction defaults (maxWait 2s / timeout 5s) are tuned for single-shot
 * writes. The entitlement transaction below issues a variable number of sequential upserts, so
 * under pool contention it can exceed 5s and abort with P2028 *after* the provider already
 * charged the customer — leaving billing state behind reality until the webhook is retried.
 */
const BILLING_TRANSACTION_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;

function billingSummaryCacheKey(userId: string) {
  return `billing:summary:${userId}`;
}

function billingHistoryCacheKey(userId: string) {
  return `billing:history:${userId}`;
}

function getDodoClient() {
  if (!config.dodo.apiKey) throw new ApiError(503, "Billing is not configured.");

  return new DodoPayments({
    bearerToken: config.dodo.apiKey,
    webhookKey: config.dodo.webhookSecret || undefined,
    environment: config.dodo.environment,
  });
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number) {
  const d = new Date(date.getTime());
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function addCatalogInterval(date: Date, interval: CatalogInterval) {
  // `one_day` is the catalog key of the pass sold as the "3-Day Sprint"; three days is correct.
  if (interval === "one_day") return addDays(date, 3);
  if (interval === "seven_day") return addDays(date, 7);
  if (interval === "annual") return addYears(date, 1);
  return addMonths(date, 1);
}

function toBillingInterval(interval: CatalogInterval) {
  if (interval === "one_day") return "ONE_DAY" as const;
  if (interval === "seven_day") return "SEVEN_DAY" as const;
  if (interval === "annual") return "ANNUAL" as const;
  return "MONTHLY" as const;
}

function fromBillingInterval(interval: PrismaSubscription["interval"]): CatalogInterval {
  if (interval === "ONE_DAY") return "one_day";
  if (interval === "SEVEN_DAY") return "seven_day";
  if (interval === "ANNUAL") return "annual";
  return "monthly";
}

/**
 * The provider's product id is the truth about what is being billed: after a plan change in the
 * Dodo portal the checkout metadata still names the plan the customer started on. Metadata is
 * only consulted for a product id the catalog does not know, and then its interval is validated
 * against the catalog instead of being trusted.
 */
function resolveCatalogProduct(
  productId: string | null | undefined,
  metadata: { veriworkly_product?: string; veriworkly_interval?: string },
): { productKey: ProductKey; interval: CatalogInterval } | null {
  if (productId) {
    const product = getProductFromProviderId(productId);
    if (product) return product;
  }

  const metaProduct = metadata.veriworkly_product;
  const metaInterval = metadata.veriworkly_interval;
  if (
    metaProduct &&
    isProductKey(metaProduct) &&
    metaInterval &&
    isCatalogInterval(metaInterval) &&
    productCatalog[metaProduct].prices[metaInterval] !== undefined
  )
    return { productKey: metaProduct, interval: metaInterval };

  return null;
}

/**
 * Every status the Dodo SDK can report, mapped explicitly. The `Record` over the SDK type makes a
 * new provider status a compile error here rather than a silent `INACTIVE` that revokes access
 * someone is paying for. A status that is not in the table at runtime fails the event.
 */
const SUBSCRIPTION_STATUS_TABLE: Record<
  DodoPayments.SubscriptionStatus,
  { status: PrismaSubscription["status"]; grace: boolean }
> = {
  active: { status: "ACTIVE", grace: false },
  // Dunning after a failed renewal: the paid period is over, the grants go, and the portfolio
  // sits in GRACE for `portfolio.graceDays` while Dodo retries the card.
  on_hold: { status: "PAST_DUE", grace: true },
  past_due: { status: "PAST_DUE", grace: true },
  // A pause is a customer or merchant choice with nothing charged until it is resumed. There is
  // no paid period to honour, but the customer intends to come back, so it gets the same grace
  // as a failed renewal rather than an immediate suspension.
  paused: { status: "PAST_DUE", grace: true },
  // Created but not yet paid (mandate or first charge pending). Nothing is granted, and nothing
  // still inside a paid period is taken away: `applySubscriptionEvent` leaves existing grants
  // untouched for this status.
  pending: { status: "INACTIVE", grace: false },
  // Never paid: no grace.
  failed: { status: "INACTIVE", grace: false },
  // Access runs to `currentPeriodEnd`, then the user is free (see `accessStatus`).
  cancelled: { status: "CANCELED", grace: false },
  expired: { status: "CANCELED", grace: false },
};

function statusFromDodo(rawStatus: string) {
  return Object.prototype.hasOwnProperty.call(SUBSCRIPTION_STATUS_TABLE, rawStatus)
    ? SUBSCRIPTION_STATUS_TABLE[rawStatus as DodoPayments.SubscriptionStatus]
    : null;
}

function accessStatus(
  subscription: Pick<PrismaSubscription, "status" | "currentPeriodEnd" | "graceEndsAt"> | null,
) {
  if (!subscription) return { canPublish: false, publicationStatus: "SUSPENDED" as const };

  const now = new Date();

  if (
    subscription.status === "ACTIVE" &&
    (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > now)
  )
    return { canPublish: true, publicationStatus: "LIVE" as const };

  // Cancellation keeps what was paid for: access until the period the customer paid for ends.
  if (
    subscription.status === "CANCELED" &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd > now
  )
    return { canPublish: true, publicationStatus: "LIVE" as const };

  if (subscription.graceEndsAt && subscription.graceEndsAt > now)
    return { canPublish: false, publicationStatus: "GRACE" as const };

  return { canPublish: false, publicationStatus: "SUSPENDED" as const };
}

/**
 * Two webhook events for one user (an old subscription cancelled while a new one activates)
 * each recompute the portfolio publication from every grant the user holds. Row locks are per
 * subscription, so without this they can read each other's pre-commit state and the last writer
 * suspends a paying customer. Taken first in every billing transaction; released at commit.
 */
async function lockUserForBilling(tx: Prisma.TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
}

/**
 * Publication follows the grants, not one subscription: LIVE while any publish grant is in
 * effect, otherwise `fallback` (or untouched when the caller only added access).
 */
async function reconcilePortfolioPublication(
  tx: Prisma.TransactionClient,
  userId: string,
  at: Date,
  fallback: { publicationStatus: "GRACE" | "SUSPENDED"; suspensionReason: string } | null,
) {
  // Grants are read as of the later of the event and the clock: with events for one user
  // serialised on the advisory lock, an older-stamped event that runs second must still see
  // the grant the newer one just made (it started after this event's own timestamp).
  const now = new Date();
  const asOf = at > now ? at : now;
  const effectivePublishGrant = await tx.entitlementGrant.findFirst({
    where: {
      userId,
      key: ENTITLEMENT_KEYS.PORTFOLIO_PUBLISH,
      startsAt: { lte: asOf },
      revokedAt: null,
      OR: [{ endsAt: null }, { endsAt: { gt: asOf } }],
    },
    select: { endsAt: true },
    orderBy: { endsAt: "desc" },
  });

  // Only rows billing suspended (or never suspended) follow the grants. A row the user took
  // down or an admin suspended stays down whatever billing says; only a republish or the admin
  // brings it back. Written as an OR because `in` alone excludes NULL rows.
  const billingOwned = {
    OR: [{ suspensionReason: null }, { suspensionReason: { in: [...BILLING_SUSPENSION_REASONS] } }],
  };

  if (effectivePublishGrant) {
    await tx.portfolioPublication.updateMany({
      where: { userId, ...billingOwned },
      data: { status: "LIVE", suspensionReason: null, suspendedAt: null },
    });
    return;
  }

  if (!fallback) return;

  await tx.portfolioPublication.updateMany({
    where: { userId, ...billingOwned },
    data:
      fallback.publicationStatus === "SUSPENDED"
        ? {
            status: "SUSPENDED",
            suspensionReason: fallback.suspensionReason,
            suspendedAt: new Date(),
          }
        : { status: "GRACE", suspensionReason: null, suspendedAt: null },
  });
}

type AccessGrant = {
  key: string;
  endsAt: Date | null;
  source: EntitlementSource;
  metadata: Prisma.JsonValue;
};

function isPassGrant(grant: AccessGrant) {
  return (
    grant.source === "SYSTEM" &&
    typeof grant.metadata === "object" &&
    grant.metadata !== null &&
    !Array.isArray(grant.metadata) &&
    grant.metadata.pass === true
  );
}

/** Latest end among the grants; `null` when there are none or when one of them is open-ended. */
function latestEnd(grants: AccessGrant[]) {
  if (grants.length === 0 || grants.some((grant) => grant.endsAt === null)) return null;
  return new Date(Math.max(...grants.map((grant) => (grant.endsAt as Date).getTime())));
}

/**
 * What the customer is paying for, derived from the grants in effect (any source) and the credit
 * wallet, so a pass holder or a credit-pack buyer is never described as a free user.
 */
function describeAccess(grants: AccessGrant[], creditBalance: number) {
  const portfolio = grants.filter((grant) => grant.key === ENTITLEMENT_KEYS.PORTFOLIO_PUBLISH);
  const ai = grants.filter((grant) => grant.key === ENTITLEMENT_KEYS.AI_CREDITS);
  const passes = grants.filter(isPassGrant);
  const subscribedPortfolio = portfolio.some((grant) => !isPassGrant(grant));
  const subscribedAi = ai.some((grant) => !isPassGrant(grant));

  const tier =
    subscribedPortfolio && subscribedAi
      ? ("bundle" as const)
      : subscribedPortfolio
        ? ("portfolio_pro" as const)
        : subscribedAi
          ? ("ai_credits" as const)
          : passes.length > 0
            ? ("pass" as const)
            : creditBalance > 0
              ? ("credits" as const)
              : ("free" as const);

  return {
    tier,
    isPaying: grants.length > 0 || creditBalance > 0,
    passEndsAt: latestEnd(passes),
    portfolioAccessEndsAt: latestEnd(portfolio),
    aiCreditsEndsAt: latestEnd(ai),
    creditBalance,
  };
}

export class BillingService {
  static async getLatestSubscription(userId: string) {
    return prisma.subscription.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } });
  }

  static async getSummary(userId: string) {
    const cached = await cacheGet<Awaited<ReturnType<typeof BillingService.buildSummary>>>(
      billingSummaryCacheKey(userId),
    );
    if (cached) return cached;
    const result = await this.buildSummary(userId);
    await cacheSet(billingSummaryCacheKey(userId), result, BILLING_SUMMARY_TTL_SECONDS);
    return result;
  }

  private static async buildSummary(userId: string) {
    const at = new Date();
    const [user, subscription, activeSubscriptions, activeGrants, wallet] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      this.getLatestSubscription(userId),
      prisma.subscription.findMany({
        where: {
          userId,
          status: { in: ["ACTIVE"] },
          OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: at } }],
        },
        select: { productKey: true, currentPeriodEnd: true },
      }),
      // Same predicate as EntitlementService.listActive; the rows (not just the keys) are
      // needed to tell a pass from a subscription and to report when access ends.
      prisma.entitlementGrant.findMany({
        where: {
          userId,
          startsAt: { lte: at },
          revokedAt: null,
          OR: [{ endsAt: null }, { endsAt: { gt: at } }],
        },
        select: { key: true, endsAt: true, source: true, metadata: true },
        orderBy: { endsAt: "desc" },
      }),
      CreditService.getWallet(userId),
    ]);

    if (!user) throw new ApiError(404, "User not found");
    const entitlements = [...new Set(activeGrants.map((grant) => grant.key))];
    const access = describeAccess(activeGrants, wallet.balance);
    const entitlementCurrent = entitlements.includes(ENTITLEMENT_KEYS.PORTFOLIO_PUBLISH);
    const hasAiCredits = entitlements.includes(ENTITLEMENT_KEYS.AI_CREDITS);
    const portfolioAccessEndsAt =
      activeSubscriptions
        .filter((item) => item.productKey === "portfolio_pro" || item.productKey === "bundle")
        .map((item) => item.currentPeriodEnd)
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
    const plan =
      entitlementCurrent && hasAiCredits
        ? "BUNDLE"
        : entitlementCurrent
          ? "PORTFOLIO_PRO"
          : hasAiCredits
            ? "AI_CREDITS"
            : "FREE";

    const now = new Date();
    const isExpired = Boolean(
      subscription?.currentPeriodEnd && subscription.currentPeriodEnd < now,
    );
    const resolvedStatus = isExpired ? "INACTIVE" : (subscription?.status ?? "INACTIVE");

    return {
      plan,
      productKey: subscription?.productKey ?? null,
      activeProductKeys: [...new Set(activeSubscriptions.map((item) => item.productKey))],
      status: resolvedStatus,
      interval: subscription?.interval ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      graceEndsAt: subscription?.graceEndsAt ?? null,
      canPublish: entitlementCurrent,
      accessEndsAt: portfolioAccessEndsAt,
      publicationStatus: entitlementCurrent
        ? "LIVE"
        : subscription?.graceEndsAt && subscription.graceEndsAt > new Date()
          ? "GRACE"
          : "SUSPENDED",
      entitlements,
      access,
      credits: wallet,
      catalog: publicCatalog(),
      creditEconomics: publicCreditEconomics(),
      addOns: entitlementCurrent
        ? [
            { key: "extra_credits", name: "Extra credit packs" },
            { key: "extra_publish_capacity", name: "Extra publish capacity" },
          ]
        : [],
    };
  }

  static async requirePublishAccess(userId: string) {
    return EntitlementService.require(
      userId,
      ENTITLEMENT_KEYS.PORTFOLIO_PUBLISH,
      "Publishing requires an active VeriWorkly Creator Pro subscription.",
    );
  }

  static async getHistory(userId: string) {
    const cached = await cacheGet<Awaited<ReturnType<typeof prisma.billingWebhookEvent.findMany>>>(
      billingHistoryCacheKey(userId),
    );
    if (cached) return cached;
    const result = await prisma.billingWebhookEvent.findMany({
      where: { userId, status: "PROCESSED" },
      select: { id: true, providerEventId: true, type: true, processedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    await cacheSet(billingHistoryCacheKey(userId), result, BILLING_HISTORY_TTL_SECONDS);
    return result;
  }

  static async createCheckout(
    userId: string,
    productKey: ProductKey,
    interval: BillingIntervalInput,
    redirectUrl?: string,
  ) {
    const checkoutLockKey = `billing:checkout:${userId}`;
    const lockAcquired =
      (await getRedis().set(checkoutLockKey, `${productKey}:${interval}`, {
        NX: true,
        EX: CHECKOUT_LOCK_TTL_SECONDS,
      })) === "OK";
    if (!lockAcquired)
      throw new ApiError(
        409,
        "A billing checkout is already active. Complete it or try again soon.",
      );

    try {
      const productId = getProviderProductId(productKey, interval);

      if (!productCatalog[productKey].prices[interval])
        throw new ApiError(400, "That billing interval is not available for this product.");
      if (!productId) throw new ApiError(503, "The selected billing product is not configured.");

      // The "has this user subscribed before" lookup that used to sit here existed only
      // to decide trial eligibility. With no trials, it is a query per checkout for a
      // value nothing reads.
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) throw new ApiError(404, "User not found");
      const activeProduct = await prisma.subscription.findFirst({
        where: {
          userId,
          productKey:
            productKey === "bundle"
              ? undefined
              : {
                  in: [productKey, "bundle"],
                },
          status: { in: ["ACTIVE"] },
          OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
        },
        select: { id: true },
      });
      if (activeProduct) throw new ApiError(409, "You already have an active subscription.");

      const buildRedirectUrl = (base: string, callback?: string) => {
        if (!callback) return base;

        try {
          const url = new URL(base);
          url.searchParams.set("callbackURL", callback);

          return url.toString();
        } catch {
          const separator = base.includes("?") ? "&" : "?";

          return `${base}${separator}callbackURL=${encodeURIComponent(callback)}`;
        }
      };

      const checkout = await getDodoClient().checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: user.email, name: user.name || "VeriWorkly User" },
        metadata: {
          veriworkly_user_id: userId,
          veriworkly_product: productKey,
          veriworkly_interval: interval,
        },
        // No trial on any plan. Creator Pro monthly previously received an automatic
        // 7-day trial on a first subscription; it was removed as a product decision.
        // Trials carry disclosure and reminder duties under several US state
        // auto-renewal statutes, and we would rather not offer one than offer one we
        // cannot service properly. Every plan now charges at checkout.
        return_url: buildRedirectUrl(config.dodo.checkoutReturnUrl, redirectUrl),
        cancel_url: buildRedirectUrl(config.dodo.checkoutCancelUrl, redirectUrl),
      });

      if (!checkout.checkout_url)
        throw new ApiError(502, "Billing provider did not return a checkout URL.");

      return { url: checkout.checkout_url };
    } catch (error) {
      await getRedis().del(checkoutLockKey);
      throw error;
    }
  }

  static async cancelCheckout(userId: string) {
    const checkoutLockKey = `billing:checkout:${userId}`;
    await getRedis().del(checkoutLockKey);
    return { success: true };
  }

  static async createPortal(userId: string) {
    const subscription = await this.getLatestSubscription(userId);

    if (!subscription?.providerCustomerId)
      throw new ApiError(409, "No billing account exists yet.");

    const portal = await getDodoClient().customers.customerPortal.create(
      subscription.providerCustomerId,
      { return_url: config.dodo.portalReturnUrl },
    );

    return { url: portal.link };
  }

  static async createCreditPackCheckout(
    userId: string,
    packKey: CreditPackKey,
    redirectUrl?: string,
  ) {
    const pack = creditPackCatalog[packKey];
    const productId = pack.providerProductId();
    if (!productId) throw new ApiError(503, "Extra credit checkout is not configured.");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) throw new ApiError(404, "User not found.");

    const appendCallback = (base: string) => {
      const url = new URL(base);
      if (redirectUrl) url.searchParams.set("callbackURL", redirectUrl);
      return url.toString();
    };
    const checkout = await getDodoClient().checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: user.email, name: user.name || "VeriWorkly User" },
      metadata: { veriworkly_user_id: userId, veriworkly_product: packKey },
      return_url: appendCallback(config.dodo.checkoutReturnUrl),
      cancel_url: appendCallback(config.dodo.checkoutCancelUrl),
    });
    if (!checkout.checkout_url)
      throw new ApiError(502, "Billing provider did not return a checkout URL.");
    return { url: checkout.checkout_url };
  }

  /**
   * An unsigned webhook mints credits and entitlements for whoever posts it, so the signature is
   * required in every environment. The only exception is an explicit local opt-in: the process
   * must run with `ALLOW_UNSIGNED_WEBHOOKS=1`, outside production, and the request must come
   * from the loopback interface. `NODE_ENV=development` alone (compose's old default) is not
   * enough.
   */
  static allowsUnsignedWebhook(remoteAddress: string | undefined): boolean {
    if (process.env.ALLOW_UNSIGNED_WEBHOOKS !== "1") return false;
    if (config.nodeEnv === "production") return false;

    const address = (remoteAddress ?? "").replace(/^::ffff:/i, "");
    return address === "::1" || address.startsWith("127.");
  }

  static unwrapWebhook(body: string, headers: Record<string, string>, remoteAddress?: string) {
    if (!config.dodo.webhookSecret) {
      if (BillingService.allowsUnsignedWebhook(remoteAddress)) {
        try {
          return JSON.parse(body);
        } catch {
          throw new ApiError(400, "Invalid JSON body in unsigned-webhook bypass.");
        }
      }

      throw new ApiError(503, "Billing webhook secret is not configured.");
    }

    try {
      return getDodoClient().webhooks.unwrap(body, { headers, key: config.dodo.webhookSecret });
    } catch (error) {
      // A missing, stale or wrong signature is the caller's problem (a forged or replayed
      // delivery), not a server fault: 400, logged at warn, and no 500 in the audit log.
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "Invalid webhook signature.", {
        reason: error instanceof Error ? error.message : "verification failed",
      });
    }
  }

  static async processWebhook(
    providerEventId: string,
    event: ReturnType<typeof BillingService.unwrapWebhook>,
  ) {
    const parsedEvent = dodoWebhookEventSchema.parse(event);

    const lockKey = `billing:webhook:lock:${providerEventId}`;
    const lockToken = randomUUID();
    const lockAcquired =
      (await getRedis().set(lockKey, lockToken, { NX: true, EX: WEBHOOK_LOCK_TTL_SECONDS })) ===
      "OK";

    if (!lockAcquired) {
      // A concurrent delivery of the same event is already processing it (webhook retry racing
      // the original, or the provider double-sending). Wait for it to finish rather than racing
      // applySubscriptionEvent/applyPaymentEvent in parallel.
      for (let attempt = 0; attempt < WEBHOOK_LOCK_WAIT_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, WEBHOOK_LOCK_WAIT_MS));

        const existing = await prisma.billingWebhookEvent.findUnique({
          where: { providerEventId },
        });
        if (existing?.status === "PROCESSED") return { duplicate: true };
      }

      throw new ApiError(503, WEBHOOK_IN_FLIGHT_MESSAGE);
    }

    try {
      let stored;

      try {
        stored = await prisma.billingWebhookEvent.create({
          data: {
            providerEventId,
            type: parsedEvent.type,
            payload: parsedEvent as unknown as Prisma.InputJsonValue,
            status: "PROCESSING",
            lastAttemptAt: new Date(),
          },
        });
      } catch (error) {
        if (
          error instanceof Error &&
          ((error as { code?: unknown }).code === "P2002" ||
            error.constructor.name === "PrismaClientKnownRequestError")
        ) {
          const existing = await prisma.billingWebhookEvent.findUnique({
            where: { providerEventId },
          });

          if (!existing) throw error;

          if (existing.status === "PROCESSED") return { duplicate: true };

          // The Redis lock was free but the row says an attempt is still running: Redis lost
          // the lock (restart, flush) or the attempt crashed moments ago. Either way, running
          // a second attempt alongside it is the race the lock exists to prevent; tell the
          // provider to retry after the lock budget has passed.
          if (
            existing.status === "PROCESSING" &&
            existing.lastAttemptAt &&
            Date.now() - existing.lastAttemptAt.getTime() < WEBHOOK_LOCK_TTL_SECONDS * 1000
          )
            throw new ApiError(503, WEBHOOK_IN_FLIGHT_MESSAGE);

          stored = await prisma.billingWebhookEvent.update({
            where: { id: existing.id },
            data: {
              status: "PROCESSING",
              retryCount: { increment: 1 },
              lastAttemptAt: new Date(),
            },
          });
        } else {
          throw error;
        }
      }

      try {
        if (parsedEvent.type.startsWith("subscription.")) {
          const subscriptionData = dodoSubscriptionSchema.parse(parsedEvent.data);
          const userId = await this.applySubscriptionEvent(
            subscriptionData,
            new Date(parsedEvent.timestamp),
          );
          await prisma.billingWebhookEvent.update({
            where: { id: stored.id },
            data: { userId },
          });
        }
        if (parsedEvent.type === "payment.succeeded") {
          const payment = dodoPaymentSchema.parse(parsedEvent.data);
          const userId = await this.applyPaymentEvent(payment, new Date(parsedEvent.timestamp));
          await prisma.billingWebhookEvent.update({ where: { id: stored.id }, data: { userId } });
        }

        await prisma.billingWebhookEvent.update({
          where: { id: stored.id },
          data: { status: "PROCESSED", processedAt: new Date() },
        });

        return { duplicate: false };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const updatedEvent = await prisma.billingWebhookEvent.update({
          where: { id: stored.id },
          data: { status: "FAILED", error: errorMessage },
        });

        if (updatedEvent.retryCount >= 5) {
          logger.error(
            `CRITICAL: Webhook event ${providerEventId} exceeded max retries. Dead-letter alert!`,
            {
              providerEventId,
              error: errorMessage,
              retryCount: updatedEvent.retryCount,
            },
          );
        }

        throw error;
      }
    } finally {
      await getRedis()
        .eval(releaseWebhookLockScript, { keys: [lockKey], arguments: [lockToken] })
        .catch((error) => logger.warn("Failed to release billing webhook lock", error));
    }
  }

  /** Post-commit work, safe to repeat: every call here is an invalidation, not a mutation. */
  private static async invalidateAfterBillingChange(userId: string) {
    const publication = await prisma.portfolioPublication.findUnique({
      where: { userId },
      select: { subdomain: true },
    });

    if (publication) {
      await invalidatePublicPortfolioCaches([publication.subdomain]);
      void revalidatePublicPortfolios([publication.subdomain]);
    }

    await cacheDel(userProfileCacheKey(userId));
    await Promise.all([
      cacheDel(billingSummaryCacheKey(userId)),
      cacheDel(billingHistoryCacheKey(userId)),
    ]);
  }

  private static async applySubscriptionEvent(
    subscription: z.infer<typeof dodoSubscriptionSchema>,
    eventTime: Date,
  ) {
    const existing = await prisma.subscription.findUnique({
      where: { providerSubId: subscription.subscription_id },
    });

    const userId = subscription.metadata.veriworkly_user_id || existing?.userId;

    if (!userId) {
      logger.error("Subscription webhook is missing VeriWorkly user metadata", {
        subscriptionId: subscription.subscription_id,
      });
      throw new ApiError(400, "Subscription webhook is missing VeriWorkly user metadata.");
    }
    if (
      existing?.userId &&
      subscription.metadata.veriworkly_user_id &&
      existing.userId !== subscription.metadata.veriworkly_user_id
    )
      throw new ApiError(400, "Subscription webhook user metadata does not match its owner.");

    // An event older than what the row reflects must not move it backwards. An event with the
    // same timestamp is either a distinct event that also has to apply or a retry of the one
    // that last touched the row after a post-commit failure; the writes below are idempotent,
    // so both cases re-run. A stale event still gets the cache invalidation after this block.
    const staleEvent = Boolean(existing?.lastWebhookAt && existing.lastWebhookAt > eventTime);

    const isNewSubscription = !existing;
    const previousStatus = existing?.status ?? null;

    const mapped = statusFromDodo(subscription.status);
    if (!mapped) {
      logger.error("Subscription webhook carries a provider status the table does not know", {
        subscriptionId: subscription.subscription_id,
        status: subscription.status,
      });
      throw new ApiError(400, `Unknown subscription status "${subscription.status}".`);
    }
    const normalizedStatus = mapped.status;

    const product = resolveCatalogProduct(subscription.product_id, subscription.metadata);
    if (!product) {
      logger.error("Subscription webhook references an unknown product", {
        subscriptionId: subscription.subscription_id,
        productId: subscription.product_id,
        metadata: subscription.metadata,
      });
      throw new ApiError(400, "Subscription webhook references an unknown product.");
    }
    const { productKey, interval: rawInterval } = product;
    const interval = toBillingInterval(rawInterval);

    const graceEndsAt = mapped.grace ? addDays(eventTime, config.portfolio.graceDays) : null;
    // Without a `next_billing_date` only an ACTIVE subscription earns a fresh period from the
    // event; a cancellation, expiry or failure keeps the period the row already holds (or ends
    // now), so no event can hand out access that was never paid for.
    const currentPeriodEnd = subscription.next_billing_date
      ? new Date(subscription.next_billing_date)
      : normalizedStatus === "ACTIVE"
        ? addCatalogInterval(eventTime, rawInterval)
        : (existing?.currentPeriodEnd ?? eventTime);
    // `pending` is unpaid: it grants nothing and must not revoke a period already paid for.
    const touchesGrants = subscription.status !== "pending";

    if (!staleEvent) {
      await prisma.$transaction(async (tx) => {
        await lockUserForBilling(tx, userId);

        const updateResult = await tx.subscription.updateMany({
          where: {
            providerSubId: subscription.subscription_id,
            OR: [{ lastWebhookAt: null }, { lastWebhookAt: { lte: eventTime } }],
          },
          data: {
            providerCustomerId: subscription.customer.customer_id,
            providerPriceId: subscription.product_id,
            productKey,
            interval,
            rawStatus: subscription.status,
            status: normalizedStatus,
            currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancel_at_next_billing_date,
            graceEndsAt,
            lastWebhookAt: eventTime,
          },
        });

        if (updateResult.count === 0) {
          const currentSub = await tx.subscription.findUnique({
            where: { providerSubId: subscription.subscription_id },
            select: { id: true, lastWebhookAt: true },
          });

          if (currentSub) return;

          await tx.subscription.create({
            data: {
              userId,
              provider: "dodo",
              providerCustomerId: subscription.customer.customer_id,
              providerPriceId: subscription.product_id,
              providerSubId: subscription.subscription_id,
              productKey,
              interval,
              rawStatus: subscription.status,
              status: normalizedStatus,
              currentPeriodEnd,
              cancelAtPeriodEnd: subscription.cancel_at_next_billing_date,
              graceEndsAt,
              lastWebhookAt: eventTime,
            },
          });
        }

        const access = accessStatus({ status: normalizedStatus, currentPeriodEnd, graceEndsAt });

        if (touchesGrants) {
          await tx.entitlementGrant.updateMany({
            where: { userId, source: "SUBSCRIPTION", sourceId: subscription.subscription_id },
            data: { revokedAt: eventTime },
          });

          if (access.canPublish) {
            for (const key of productCatalog[productKey].entitlements) {
              await tx.entitlementGrant.upsert({
                where: {
                  userId_key_source_sourceId: {
                    userId,
                    key,
                    source: "SUBSCRIPTION",
                    sourceId: subscription.subscription_id,
                  },
                },
                create: {
                  userId,
                  key,
                  source: "SUBSCRIPTION",
                  sourceId: subscription.subscription_id,
                  startsAt: eventTime,
                  endsAt: currentPeriodEnd,
                  metadata: { productKey },
                },
                update: {
                  startsAt: eventTime,
                  endsAt: currentPeriodEnd,
                  revokedAt: null,
                  metadata: { productKey },
                },
              });
            }
          }
        }

        // Free templates publish with no publish grant at all, so only an event about a plan
        // that carries `portfolio_publish` may move the publication to GRACE/SUSPENDED, and
        // never an unpaid `pending` one. Everything else leaves it alone (it still becomes
        // LIVE when any publish grant is in effect).
        const governsPublication =
          touchesGrants &&
          productCatalog[productKey].entitlements.includes(ENTITLEMENT_KEYS.PORTFOLIO_PUBLISH);
        await reconcilePortfolioPublication(
          tx,
          userId,
          eventTime,
          governsPublication
            ? {
                publicationStatus: access.publicationStatus === "GRACE" ? "GRACE" : "SUSPENDED",
                suspensionReason: normalizedStatus,
              }
            : null,
        );
      }, BILLING_TRANSACTION_OPTIONS);
    }

    await this.invalidateAfterBillingChange(userId);

    if (staleEvent) return userId;

    if (isNewSubscription && normalizedStatus === "ACTIVE") {
      void this.notifySubscriptionPurchased(userId, productKey);
    } else if (
      previousStatus &&
      previousStatus !== "CANCELED" &&
      normalizedStatus === "CANCELED" &&
      // The mail promises access until the end of the paid period. A natural `expired` (end of
      // a period or of a pass) is not a cancellation, and without a future period end there is
      // nothing left to promise.
      subscription.status !== "expired" &&
      currentPeriodEnd > new Date()
    ) {
      void this.notifySubscriptionCancelled(userId);
    }

    return userId;
  }

  private static async notifySubscriptionPurchased(userId: string, productKey: ProductKey) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      if (!user?.email) return;

      await sendSubscriptionPurchasedEmail(
        user.email,
        user.name || "there",
        productCatalog[productKey].name,
      );
    } catch (error) {
      logger.warn("Failed to send subscription purchased email", error);
    }
  }

  private static async notifySubscriptionCancelled(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      if (!user?.email) return;

      await sendSubscriptionCancelledEmail(user.email, user.name || "there");
    } catch (error) {
      logger.warn("Failed to send subscription cancelled email", error);
    }
  }

  private static async applyPaymentEvent(payment: z.infer<typeof dodoPaymentSchema>, paidAt: Date) {
    const subscription = payment.subscription_id
      ? await prisma.subscription.findUnique({
          where: { providerSubId: payment.subscription_id },
          select: { userId: true, productKey: true, interval: true, currentPeriodEnd: true },
        })
      : null;
    const userId = payment.metadata.veriworkly_user_id || subscription?.userId;
    if (!userId) {
      logger.error("Payment webhook cannot be attributed to a user", {
        paymentId: payment.payment_id,
        subscriptionId: payment.subscription_id ?? null,
      });
      throw new ApiError(400, "Payment webhook is missing VeriWorkly user metadata.");
    }

    // The account settles in USD; customers may still pay in INR by UPI and adaptive pricing can
    // settle elsewhere. Grants are per product, never per currency, so a non-USD settlement is
    // noted for the operator and processed like any other.
    const settlementCurrency = payment.settlement_currency.toUpperCase();
    if (settlementCurrency !== "USD")
      logger.warn(
        `Payment ${payment.payment_id} for user ${userId} settled in ${settlementCurrency}, not USD; grants proceed per product.`,
        {
          paymentId: payment.payment_id,
          settlementCurrency,
          settlementAmount: payment.settlement_amount,
          currency: payment.currency ?? null,
        },
      );

    // A card-update charge is a zero-amount `payment.succeeded`; so is a fully discounted one.
    // Neither earns a renewal allowance.
    const earnsAllowance = !payment.is_update_payment_method && payment.total_amount !== 0;

    const purchasedProduct = payment.metadata.veriworkly_product;
    if (purchasedProduct && isCreditPackKey(purchasedProduct)) {
      const pack = creditPackCatalog[purchasedProduct];
      await CreditService.grant(userId, pack.credits, {
        requestId: `payment-credit:${payment.payment_id}`,
        source: "credit_pack",
        sourceId: payment.payment_id,
        expiresAt: addDays(paidAt, pack.expiresInDays),
        reason: pack.name,
      });
    } else {
      // The stored row already follows the provider's product id (plan changes included); a
      // payment that lands before its subscription row exists resolves from the payload. Only
      // `product_cart[0]` is read: every checkout the API creates is a single-item cart.
      const product =
        subscription && isProductKey(subscription.productKey)
          ? {
              productKey: subscription.productKey,
              interval: fromBillingInterval(subscription.interval),
            }
          : resolveCatalogProduct(
              payment.product_cart?.[0]?.product_id ?? payment.product_id,
              payment.metadata,
            );
      if (!product) {
        logger.error("Payment webhook references an unknown product", {
          paymentId: payment.payment_id,
          subscriptionId: payment.subscription_id ?? null,
          productId: payment.product_cart?.[0]?.product_id ?? payment.product_id ?? null,
          metadata: payment.metadata,
        });
        throw new ApiError(400, "Payment webhook references an unknown product.");
      }
      const { productKey, interval } = product;

      // The allowance lives at least one catalog interval from the payment. The stored period
      // end is only trusted when it is further out: `payment.succeeded` and
      // `subscription.renewed` have no ordering guarantee, and after dunning recovery the row
      // still holds the period that just ended, so a grant keyed on it would expire at once.
      const intervalEnd = addCatalogInterval(paidAt, interval);
      const expiresAt =
        subscription?.currentPeriodEnd && subscription.currentPeriodEnd > intervalEnd
          ? subscription.currentPeriodEnd
          : intervalEnd;

      // A bundle pass is a one-time product: no `subscription.*` event ever follows, so its
      // entitlements are granted here, for the pass window, keyed on the payment id. A pass with
      // a zero total (a 100 % coupon) still grants the entitlements but, by design, no credit
      // allowance (see `earnsAllowance`).
      const isPass =
        !payment.subscription_id &&
        productKey === "bundle" &&
        (interval === "one_day" || interval === "seven_day");

      if (isPass) {
        await prisma.$transaction(async (tx) => {
          await lockUserForBilling(tx, userId);

          for (const key of productCatalog.bundle.entitlements) {
            await tx.entitlementGrant.upsert({
              where: {
                userId_key_source_sourceId: {
                  userId,
                  key,
                  source: "SYSTEM",
                  sourceId: payment.payment_id,
                },
              },
              create: {
                userId,
                key,
                source: "SYSTEM",
                sourceId: payment.payment_id,
                startsAt: paidAt,
                endsAt: intervalEnd,
                metadata: { productKey, interval, pass: true },
              },
              update: {
                startsAt: paidAt,
                endsAt: intervalEnd,
                revokedAt: null,
                metadata: { productKey, interval, pass: true },
              },
            });
          }

          await reconcilePortfolioPublication(tx, userId, paidAt, null);
        }, BILLING_TRANSACTION_OPTIONS);
      }

      const allowance =
        productKey === "ai_credits" || productKey === "bundle"
          ? (productCatalog[productKey].creditAllowance?.[interval] ?? 0)
          : 0;

      // The service period this payment pays for, when the payload names one. A subscription
      // payment whose `service_periods` has no entry for its subscription bills usage only and
      // does not extend the period (SDK), so it earns no allowance either.
      const servicePeriod = payment.subscription_id
        ? payment.service_periods?.find(
            (period) => period.subscription_id === payment.subscription_id,
          )
        : undefined;
      const usageOnlyRenewal = Boolean(
        payment.subscription_id && payment.service_periods && !servicePeriod,
      );

      if (allowance > 0 && !earnsAllowance) {
        logger.info("Skipping credit allowance for a zero-amount or card-update payment", {
          paymentId: payment.payment_id,
          subscriptionId: payment.subscription_id ?? null,
          isUpdatePaymentMethod: payment.is_update_payment_method,
          totalAmount: payment.total_amount ?? null,
        });
      } else if (allowance > 0 && usageOnlyRenewal) {
        logger.info("Skipping credit allowance for a usage-only subscription payment", {
          paymentId: payment.payment_id,
          subscriptionId: payment.subscription_id,
        });
      } else if (allowance > 0) {
        // One allowance per service period: when the payload names the period this payment
        // pays for, the grant is keyed on it so a second successful charge in the same period
        // cannot mint a second allowance. The request id stays per payment, so a retry of this
        // event returns the grant it already made. Without a service period the payment id is
        // the only stable key (the stored period end moves with webhook order and would
        // collide across renewals).
        const sourceId = servicePeriod
          ? `${payment.subscription_id}:${servicePeriod.starts_at}`
          : payment.payment_id;

        try {
          await CreditService.grant(userId, allowance, {
            requestId: `subscription-credit:${payment.payment_id}`,
            source: "subscription_payment",
            sourceId,
            expiresAt,
            reason: `${productCatalog[productKey].name} credit allowance`,
          });
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"))
            throw error;
          logger.warn("Credit allowance for this service period was already granted", {
            paymentId: payment.payment_id,
            subscriptionId: payment.subscription_id,
            sourceId,
          });
        }
      }
    }

    await this.recordAffiliateCommission(userId, payment);
    await this.invalidateAfterBillingChange(userId);
    return userId;
  }

  /**
   * The commission base is the settlement net of the tax collected: `settlement_tax` when Dodo
   * reports it, else `tax` when it is in the settlement currency, else the full settlement. A
   * commission that rounds below one cent is skipped, never a reason to fail the payment.
   */
  private static async recordAffiliateCommission(
    userId: string,
    payment: z.infer<typeof dodoPaymentSchema>,
  ) {
    const referral = await prisma.affiliateReferral.findUnique({
      where: { referredUserId: userId },
      select: { affiliate: { select: { affiliateTier: true, affiliateStatus: true } } },
    });
    if (!referral || referral.affiliate.affiliateStatus !== "ACTIVE") return;

    const settlementCurrency = payment.settlement_currency.toUpperCase();
    const taxCents =
      payment.settlement_tax ??
      (payment.currency && payment.currency.toUpperCase() === settlementCurrency
        ? (payment.tax ?? 0)
        : 0);
    const purchaseAmountCents = Math.max(0, payment.settlement_amount - taxCents);
    const rateBps = AFFILIATE_TIER_RATE_BPS[referral.affiliate.affiliateTier];
    const amountCents = Math.floor((purchaseAmountCents * rateBps) / 10_000);

    if (amountCents < 1) {
      logger.debug("Skipping sub-cent affiliate commission", {
        paymentId: payment.payment_id,
        purchaseAmountCents,
        rateBps,
      });
      return;
    }

    try {
      await AffiliateService.createCommission({
        referredUserId: userId,
        subscriptionId: payment.subscription_id ?? undefined,
        providerPaymentId: payment.payment_id,
        purchaseAmountCents,
        status: "PENDING",
        reason: "Dodo payment succeeded",
        currency: settlementCurrency,
      });
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) return;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
      throw error;
    }
  }
}

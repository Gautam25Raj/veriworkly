import { randomUUID } from "node:crypto";

import { z } from "zod";
import DodoPayments from "dodopayments";

import {
  Prisma,
  type EntitlementSource,
  type Subscription as PrismaSubscription,
} from "@prisma/client";

import { config, isProduction } from "#config";

import {
  dodoPaymentSchema,
  dodoWebhookEventSchema,
  dodoSubscriptionSchema,
} from "#validators/billingValidator";

import { prisma } from "#lib/prisma";
import { logger } from "#lib/logger";
import { ApiError } from "#lib/errors";
import { cacheDel, cacheGet, cacheSet, getRedis } from "#lib/redis";
import { acquireJobLock } from "#lib/jobLock";
import { userProfileCacheKey } from "#lib/cacheKeys";
import { PREMIUM_PORTFOLIO_TEMPLATE_IDS } from "#validators/portfolioValidator";
import { EntitlementService, isPaidAccessKey } from "#services/entitlementService";
import { AffiliateService } from "#services/affiliate/index";
import { AFFILIATE_TIER_RATE_BPS } from "#services/affiliate/constants";
import { CreditService } from "#services/creditService";
import { CREDIT_SOURCES } from "#services/creditSources";
import { isDeletedAccount, redactIfForDeletedAccount } from "#services/deletedAccount";
import {
  grantDueMonths,
  openAnnualCreditSchedule,
  subscriptionCreditGrantsWhere,
} from "#services/annualCreditService";
import { notifyOnce } from "#services/billingNotifications";
import {
  sendSubscriptionCancelledEmail,
  type PurchaseConfirmation,
} from "#services/mail/billingMail";
import { PRODUCT_NAMES, PASS_NAMES, UNLOCK_PHRASES, purchaseName } from "#services/productNames";
import {
  creditPackCatalog,
  isCreditPackKey,
  ENTITLEMENT_KEYS,
  getProductFromProviderId,
  getProviderProductId,
  isCatalogInterval,
  isProductKey,
  productCatalog,
  PRODUCT_KEYS,
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
/** The one field a `refund.succeeded` event is read for. */
const refundEventSchema = z.object({
  payment_id: z.string().trim().min(1),
  is_partial: z.boolean().nullish(),
  amount: z.number().int().nullish(),
});
const BILLING_SUMMARY_TTL_SECONDS = 60;
const BILLING_HISTORY_TTL_SECONDS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * One open checkout session per (user, product), remembered for as long as the provider keeps
 * the session payable (Dodo checkout sessions stay valid for 24 hours). Shorter, and a forgotten
 * tab could pay the old session after a new one was opened for the same product: two
 * subscriptions, one customer (V-125). The record goes away earlier when a webhook settles the
 * product or when `cancelCheckout` confirms with the provider that nothing is being paid.
 */
const CHECKOUT_RECORD_TTL_SECONDS = 24 * 60 * 60;
/**
 * The record is stamped after the provider call returns, on our clock: a subscription the
 * provider created for this very session can carry a slightly earlier `created_at`.
 */
const CHECKOUT_SETTLE_CLOCK_SLACK_MS = 5 * 60 * 1000;
/** The claim held while the provider call is in flight, so two clicks at once make one session. */
const CHECKOUT_CLAIM_TTL_SECONDS = 60;
/**
 * The provider call made while the claim is held must finish well inside the claim's TTL: the
 * SDK defaults (60 s timeout, 2 retries) could outlive it, letting a second click claim the key
 * and open a second session. No retries either: creating a session is not idempotent, so a retry
 * after a timeout can leave a payable session behind that nothing tracks.
 */
const CHECKOUT_PROVIDER_TIMEOUT_MS = 20_000;
const CHECKOUT_PROVIDER_MAX_RETRIES = 0;
const CHECKOUT_CLAIM_WAIT_ATTEMPTS = 10;
const CHECKOUT_CLAIM_WAIT_MS = 300;
/** The studio keys its "reset and retry" button on this phrase; keep it when rewording. */
const CHECKOUT_ACTIVE_MESSAGE =
  "A billing checkout is already active. Complete it or try again soon.";
/**
 * Provider payment states in which money is moving or has moved: a session in one of these is
 * never cleared by `cancelCheckout`; the webhook settles it.
 */
const PAYMENT_IN_FLIGHT_STATUSES = new Set<string>([
  "succeeded",
  "processing",
  "requires_capture",
  "partially_captured",
  "partially_captured_and_capturable",
  "requires_merchant_action",
]);
/**
 * Must outlive one full processing attempt: the entitlement transaction alone may wait 10 s for
 * a connection and run 20 s, and the pre/post work (event row, cache invalidation, affiliate
 * commission) adds more. The lock is renewed while the attempt runs (`acquireJobLock`), so this
 * is the budget for a Redis stall, not for the attempt itself.
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

/** Compare-and-delete: only the holder of a checkout claim or record may remove it. */
const compareAndDeleteScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`;

/**
 * Compare-and-set: replaces our checkout claim with the open record, but only while the key still
 * holds that claim. A claim that expired and was re-claimed by another request is not ours.
 */
const compareAndSetScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    redis.call("set", KEYS[1], ARGV[2], "EX", ARGV[3])
    return 1
  end
  return 0
`;

type CheckoutRecord =
  | { state: "claimed"; token: string }
  | {
      state: "open";
      sessionId: string;
      url: string;
      interval: BillingIntervalInput;
      createdAt: string;
    };

function checkoutRecordKey(userId: string, productKey: ProductKey) {
  return `billing:checkout:${userId}:${productKey}`;
}

function parseCheckoutRecord(raw: string | null): CheckoutRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckoutRecord;
    return parsed.state === "claimed" || parsed.state === "open" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The products an open checkout for `productKey` must not overlap with: the same rule as the
 * active-subscription check, since the bundle contains both single products.
 */
function overlappingProductKeys(productKey: ProductKey): ProductKey[] {
  return productKey === "bundle" ? [...PRODUCT_KEYS] : [productKey, "bundle"];
}

/**
 * Whether a new subscription or pass would overlap what the customer already pays for (V-176).
 * Any live subscription (active in period, or in dunning) blocks a second one: the same product
 * twice is a double charge, the bundle already contains both single products, and AI Credits
 * plus Creator Pro is the bundle at a higher price. The error says what to do instead, and
 * `details` carries the same in machine form for the clients:
 * `{ code, activeProductKey, suggestedProductKey }`.
 */
function checkoutOverlap(
  productKey: ProductKey,
  interval: BillingIntervalInput,
  live: Array<{
    productKey: string;
    status: PrismaSubscription["status"];
    rawStatus: string | null;
  }>,
) {
  const current = live.find((item) => item.status === "PAST_DUE") ?? live[0];
  if (!current || !isProductKey(current.productKey)) return null;
  const active = current.productKey;
  const activeName = PRODUCT_NAMES[active];
  const requestedName =
    productKey === "bundle" && (interval === "one_day" || interval === "seven_day")
      ? PASS_NAMES[interval]
      : PRODUCT_NAMES[productKey];
  const details = (code: string, suggestedProductKey: ProductKey | null) => ({
    code,
    activeProductKey: active,
    suggestedProductKey,
  });

  // A pause maps to PAST_DUE (nothing is charged until it is resumed), but nothing is owed either.
  if (current.status === "PAST_DUE" && current.rawStatus === "paused")
    return new ApiError(
      409,
      `Your ${activeName} subscription is paused. Resume it from Manage billing instead of starting a new purchase.`,
      details("SUBSCRIPTION_PAUSED", null),
    );
  if (current.status === "PAST_DUE")
    return new ApiError(
      409,
      `Your ${activeName} subscription has a payment outstanding. Update your payment method from Manage billing instead of starting a new purchase.`,
      details("PAYMENT_OUTSTANDING", null),
    );
  if (active === productKey && requestedName === activeName)
    return new ApiError(
      409,
      `You already have an active ${activeName} subscription.`,
      details("ALREADY_SUBSCRIBED", null),
    );
  if (active === "bundle")
    return new ApiError(
      409,
      `Your ${activeName} already includes ${requestedName}.`,
      details("ALREADY_INCLUDED", null),
    );
  if (requestedName !== PRODUCT_NAMES[productKey])
    return new ApiError(
      409,
      `You already have an active ${activeName} subscription. For more AI credits, buy a credit pack instead of a pass.`,
      details("SUBSCRIPTION_OVERLAP", null),
    );
  return new ApiError(
    409,
    `You already have an active ${activeName} subscription. ${PRODUCT_NAMES.ai_credits} and ${PRODUCT_NAMES.portfolio_pro} together are the ${PRODUCT_NAMES.bundle}: to switch, cancel ${activeName} from Manage billing and subscribe to the ${PRODUCT_NAMES.bundle} when it ends, or contact support to switch now.`,
    details("SUBSCRIPTION_OVERLAP", "bundle"),
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function getDodoClient(options: { timeout?: number; maxRetries?: number } = {}) {
  if (!config.dodo.apiKey) throw new ApiError(503, "Billing is not configured.");

  return new DodoPayments({
    bearerToken: config.dodo.apiKey,
    webhookKey: config.dodo.webhookSecret || undefined,
    environment: config.dodo.environment,
    ...options,
  });
}

/** The client that creates checkout sessions: bounded so the call fits inside the claim TTL. */
function getDodoCheckoutClient() {
  return getDodoClient({
    timeout: CHECKOUT_PROVIDER_TIMEOUT_MS,
    maxRetries: CHECKOUT_PROVIDER_MAX_RETRIES,
  });
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
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

type BillingEventSummary = {
  productName: string | null;
  amountCents: number | null;
  currency: string | null;
};

const UNKNOWN_EVENT_SUMMARY: BillingEventSummary = {
  productName: null,
  amountCents: null,
  currency: null,
};

/**
 * What a billing event was for, as the customer's billing history names it (V-197): the product
 * from the shared naming table and the amount the event carries. Reads a stored event (`{ type,
 * data }`); anything it cannot read, a redacted payload included, is unknown rather than an error.
 */
function summarizeBillingEvent(event: unknown): BillingEventSummary {
  const parsed = dodoWebhookEventSchema.pick({ type: true, data: true }).safeParse(event);
  if (!parsed.success) return UNKNOWN_EVENT_SUMMARY;
  const { type, data } = parsed.data;

  if (type.startsWith("subscription.")) {
    const subscription = dodoSubscriptionSchema.safeParse(data);
    if (!subscription.success) return UNKNOWN_EVENT_SUMMARY;
    const product = resolveCatalogProduct(subscription.data.product_id, subscription.data.metadata);
    return {
      productName: product ? purchaseName(product.productKey, product.interval) : null,
      amountCents: subscription.data.recurring_pre_tax_amount ?? null,
      currency: subscription.data.currency?.toUpperCase() ?? null,
    };
  }

  if (type.startsWith("payment.")) {
    const payment = dodoPaymentSchema.safeParse(data);
    if (!payment.success) return UNKNOWN_EVENT_SUMMARY;
    const { metadata } = payment.data;
    const packKey = metadata.veriworkly_product;
    // Same order as `applyPaymentEvent`: a pack names itself in metadata, anything else is the
    // catalog product its cart names.
    const product = resolveCatalogProduct(
      payment.data.product_cart?.[0]?.product_id ?? payment.data.product_id,
      metadata,
    );
    return {
      productName:
        packKey && isCreditPackKey(packKey)
          ? creditPackCatalog[packKey].name
          : product
            ? purchaseName(product.productKey, product.interval)
            : null,
      amountCents: payment.data.total_amount ?? null,
      currency: payment.data.currency?.toUpperCase() ?? null,
    };
  }

  if (type.startsWith("refund.")) {
    const refund = z
      .object({ amount: z.number().int().nullish(), currency: z.string().trim().min(1).nullish() })
      .safeParse(data);
    if (!refund.success) return UNKNOWN_EVENT_SUMMARY;
    return {
      productName: null,
      amountCents: refund.data.amount ?? null,
      currency: refund.data.currency?.toUpperCase() ?? null,
    };
  }

  return UNKNOWN_EVENT_SUMMARY;
}

/**
 * `summarizeBillingEvent` for an event being stored. A refund names no product itself, so it takes
 * the product of the payment it refunds when that payment's event is on file; otherwise null. The
 * lookup never fails the webhook: an unnamed refund is still a correct history row.
 */
async function summarizeStoredEvent(event: {
  type: string;
  data: unknown;
}): Promise<BillingEventSummary> {
  const summary = summarizeBillingEvent(event);
  if (!event.type.startsWith("refund.") || summary.productName) return summary;

  const refund = refundEventSchema.safeParse(event.data);
  if (!refund.success) return summary;
  try {
    const payment = await prisma.billingWebhookEvent.findFirst({
      where: {
        type: "payment.succeeded",
        payload: { path: ["data", "payment_id"], equals: refund.data.payment_id },
      },
      select: { productName: true, payload: true },
    });
    if (!payment) return summary;
    return {
      ...summary,
      productName: payment.productName ?? summarizeBillingEvent(payment.payload).productName,
    };
  } catch (error) {
    logger.warn("Refund stored without its product name", {
      paymentId: refund.data.payment_id,
      error: error instanceof Error ? error.message : String(error),
    });
    return summary;
  }
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

type SubscriptionState = Pick<
  PrismaSubscription,
  "status" | "currentPeriodEnd" | "graceEndsAt" | "updatedAt"
>;

/**
 * Whether a subscription still describes the customer's billing today: active inside its
 * period, cancelled with paid time left, or in dunning while the grace window runs (V-172).
 */
function subscriptionInEffect(subscription: SubscriptionState, now: Date) {
  if (subscription.status === "ACTIVE")
    return !subscription.currentPeriodEnd || subscription.currentPeriodEnd > now;
  if (subscription.status === "CANCELED")
    return Boolean(subscription.currentPeriodEnd && subscription.currentPeriodEnd > now);
  if (subscription.status === "PAST_DUE")
    return Boolean(subscription.graceEndsAt && subscription.graceEndsAt > now);
  return false;
}

const SUMMARY_STATUS_RANK: Record<PrismaSubscription["status"], number> = {
  ACTIVE: 0,
  PAST_DUE: 1,
  CANCELED: 2,
  INACTIVE: 3,
};

/**
 * The subscription the billing summary describes (V-176): one in effect if there is any (active
 * first, then dunning, then cancelled with time left; the latest-ending among equals), otherwise
 * the one that ended last. Never simply the row updated last, which can be a dead subscription
 * while another one is what `plan` reflects.
 */
function primarySubscription<T extends SubscriptionState>(subscriptions: T[], now: Date) {
  const live = subscriptions.filter((subscription) => subscriptionInEffect(subscription, now));
  const end = (subscription: T) =>
    subscription.currentPeriodEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  const pool = live.length > 0 ? live : subscriptions;
  return (
    [...pool].sort(
      (left, right) =>
        SUMMARY_STATUS_RANK[left.status] - SUMMARY_STATUS_RANK[right.status] ||
        end(right) - end(left) ||
        right.updatedAt.getTime() - left.updatedAt.getTime(),
    )[0] ?? null
  );
}

/**
 * Two webhook events for one user (an old subscription cancelled while a new one activates)
 * each recompute the portfolio publication from every grant the user holds. Row locks are per
 * subscription, so without this they can read each other's pre-commit state and the last writer
 * suspends a paying customer. Taken first in every billing transaction; released at commit.
 */
export async function lockUserForBilling(tx: Prisma.TransactionClient, userId: string) {
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

  // A lapse only reaches publications that needed the grant in the first place: free templates
  // (Signal, Atelier) publish without one and stay LIVE whatever happens to the subscription.
  const lapsedWhere = {
    userId,
    templateId: { in: [...PREMIUM_PORTFOLIO_TEMPLATE_IDS] },
    ...billingOwned,
  };
  if (fallback.publicationStatus !== "SUSPENDED") {
    await tx.portfolioPublication.updateMany({
      where: lapsedWhere,
      data: { status: "GRACE", suspensionReason: null, suspendedAt: null },
    });
    return;
  }
  // `suspendedAt` is when the site went offline: the settle step only brings back a suspension
  // from the last 30 days. A row billing already suspended keeps its date (a redelivered event or
  // an admin reconcile must not restart that window); only its reason follows the latest event.
  await tx.portfolioPublication.updateMany({
    where: { ...lapsedWhere, NOT: { status: "SUSPENDED" } },
    data: {
      status: "SUSPENDED",
      suspensionReason: fallback.suspensionReason,
      suspendedAt: new Date(),
    },
  });
  // An undated suspension stays undated: stamping it now would make a long-dead site look recent
  // to the 30-day restore window.
  await tx.portfolioPublication.updateMany({
    where: { ...lapsedWhere, status: "SUSPENDED" },
    data: { suspensionReason: fallback.suspensionReason },
  });
}

/**
 * The SUBSCRIPTION entitlement grants one subscription earns in a given state: every grant keyed
 * on it is revoked, then the product's entitlements are granted to the period end when the state
 * gives access (active in period, or cancelled with paid time left). The webhook and the admin
 * status override both go through here, so a label and the access it implies cannot disagree
 * (V-170). Must run inside a transaction that holds `lockUserForBilling` for the user.
 */
export async function syncSubscriptionGrants(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    /** The provider subscription id; a row the provider never knew uses its own id. */
    sourceId: string;
    productKey: ProductKey;
    status: PrismaSubscription["status"];
    currentPeriodEnd: Date | null;
    graceEndsAt: Date | null;
    at: Date;
  },
) {
  const access = accessStatus(input);

  await tx.entitlementGrant.updateMany({
    where: { userId: input.userId, source: "SUBSCRIPTION", sourceId: input.sourceId },
    data: { revokedAt: input.at },
  });

  if (access.canPublish) {
    for (const key of productCatalog[input.productKey].entitlements) {
      await tx.entitlementGrant.upsert({
        where: {
          userId_key_source_sourceId: {
            userId: input.userId,
            key,
            source: "SUBSCRIPTION",
            sourceId: input.sourceId,
          },
        },
        create: {
          userId: input.userId,
          key,
          source: "SUBSCRIPTION",
          sourceId: input.sourceId,
          startsAt: input.at,
          endsAt: input.currentPeriodEnd,
          metadata: { productKey: input.productKey },
        },
        update: {
          startsAt: input.at,
          endsAt: input.currentPeriodEnd,
          revokedAt: null,
          metadata: { productKey: input.productKey },
        },
      });
    }
  }

  return access;
}

/**
 * A successful payment for an account that has been deleted (a pass or credit pack bought just
 * before the deletion, or any charge that landed after it): nothing is granted, so the money has
 * to go back by hand. Logged at error and returned as the event's note so it shows in the admin
 * webhook list. Ids and amounts only, no personal data. `null` for a zero-amount payment.
 */
function refundNeededNote(payment: z.infer<typeof dodoPaymentSchema>) {
  if (!payment.total_amount) return null;
  const currency = (payment.currency ?? payment.settlement_currency).toUpperCase();
  const note = `Refund needed: payment ${payment.payment_id} (${payment.total_amount} ${currency} minor units) was taken for a deleted account and granted nothing. Refund it from the Dodo dashboard.`;
  logger.error(note, {
    paymentId: payment.payment_id,
    subscriptionId: payment.subscription_id ?? null,
    amountMinor: payment.total_amount,
    currency,
  });
  return note;
}

/** The confirmation fields every one-time purchase (pass, pack) takes from its payment. */
function oneTimePurchase(
  payment: z.infer<typeof dodoPaymentSchema>,
): Omit<PurchaseConfirmation, "kind" | "productName" | "accessEndsAt" | "credits"> {
  return {
    amountCents: payment.total_amount ?? null,
    currency: payment.currency ?? null,
    amountExcludesTax: false,
    renewsAt: null,
    billingPeriod: null,
    creditsNote: null,
  };
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

/** A grant someone paid for: a subscription's or a pass's. Admin comps (MANUAL) and promotions are not. */
function isPurchasedGrant(grant: AccessGrant) {
  return grant.source === "SUBSCRIPTION" || isPassGrant(grant);
}

/**
 * What the customer has and whether they paid for it, derived from the grants in effect (any
 * source) and the credit wallet, so a pass holder or a credit-pack buyer is never described as a
 * free user (owner decision 2). Two separate answers:
 *
 * - `isPaid`: has Pro, the account-wide rule `EntitlementService.isPaid` applies (a subscription,
 *   a pass, or an admin comp of one; an AI Credits subscription counts, as it lifts the document
 *   limit). A credit pack never makes someone paid (owner decision 3).
 * - `isPaying`: the customer actually paid us: a subscription, a pass, or credits that were paid
 *   for (`paidCredits`: packs, plan allowances). An admin comp grant and goodwill credits (which
 *   only add to `creditBalance`) do not (V-188).
 */
/**
 * `dunning`: the product of a subscription in dunning with its grace window still running, or
 * null. Its grants are revoked while the card is retried, but the customer is still a paying
 * subscriber with a payment problem (decision 2), never shown as free.
 */
function describeAccess(
  grants: AccessGrant[],
  creditBalance: number,
  paidCredits: number,
  dunning: ProductKey | null = null,
) {
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
            : paidCredits > 0
              ? ("credits" as const)
              : ("free" as const);
  // In dunning the revoked grants say nothing about the plan: the subscription does.
  const shownTier = dunning && (tier === "free" || tier === "credits") ? dunning : tier;

  return {
    tier: shownTier,
    isPaid: grants.some((grant) => isPaidAccessKey(grant.key)),
    isPaying: grants.some(isPurchasedGrant) || paidCredits > 0 || dunning !== null,
    paymentIssue: dunning !== null,
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

  /**
   * The follow-up every billing change owes the user, for callers that edit grants or
   * subscription rows without a provider event (admin edits): the publication is recomputed
   * from the grants in effect, falling back to what the latest portfolio subscription says
   * (GRACE while its grace window runs, otherwise SUSPENDED), and every cache that reflects
   * billing state is cleared. Same lock and same rules as the webhook path.
   */
  static async reconcileAccess(userId: string) {
    const subscription = await prisma.subscription.findFirst({
      where: { userId, productKey: { in: ["portfolio_pro", "bundle"] } },
      orderBy: { updatedAt: "desc" },
    });
    const access = accessStatus(subscription);

    await prisma.$transaction(async (tx) => {
      await lockUserForBilling(tx, userId);
      await reconcilePortfolioPublication(tx, userId, new Date(), {
        publicationStatus: access.publicationStatus === "GRACE" ? "GRACE" : "SUSPENDED",
        suspensionReason: subscription?.status ?? "INACTIVE",
      });
    }, BILLING_TRANSACTION_OPTIONS);

    await this.invalidateAfterBillingChange(userId);
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
    const [user, subscriptions, activeSubscriptions, activeGrants, wallet, paidCredits] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        }),
        prisma.subscription.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
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
        CreditService.paidCreditsRemaining(userId, at),
      ]);

    if (!user) throw new ApiError(404, "User not found");
    const entitlements = [...new Set(activeGrants.map((grant) => grant.key))];
    // `available` not `balance`: reads no longer sweep (V-107), so `balance` can still hold
    // expired credits for a while, and those must never make a user look paying.
    const dunning = subscriptions.find(
      (item) =>
        item.status === "PAST_DUE" &&
        item.graceEndsAt &&
        item.graceEndsAt > at &&
        isProductKey(item.productKey),
    );
    const access = describeAccess(
      activeGrants,
      wallet.available,
      paidCredits,
      dunning ? (dunning.productKey as ProductKey) : null,
    );
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

    // Status, period and grace describe one subscription, chosen the same way `plan` is
    // derived: what is in effect today (V-176). A subscription that is no longer in effect
    // reports INACTIVE, except dunning, which stays PAST_DUE while its grace runs (V-172).
    const subscription = primarySubscription(subscriptions, at);
    const resolvedStatus =
      subscription && subscriptionInEffect(subscription, at) ? subscription.status : "INACTIVE";

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
      `Publishing this template requires ${UNLOCK_PHRASES.portfolioPro}.`,
    );
  }

  /**
   * The customer's billing events, each with the product and amount it was for (V-197). A row
   * stored before those columns existed is described from its payload while the payload lasts;
   * the payload itself is never returned.
   */
  static async getHistory(userId: string) {
    const cached = await cacheGet<Awaited<ReturnType<typeof BillingService.readHistory>>>(
      billingHistoryCacheKey(userId),
    );
    if (cached) return cached;
    const result = await this.readHistory(userId);
    await cacheSet(billingHistoryCacheKey(userId), result, BILLING_HISTORY_TTL_SECONDS);
    return result;
  }

  private static async readHistory(userId: string) {
    const rows = await prisma.billingWebhookEvent.findMany({
      where: { userId, status: "PROCESSED" },
      select: {
        id: true,
        providerEventId: true,
        type: true,
        processedAt: true,
        createdAt: true,
        productName: true,
        amountCents: true,
        currency: true,
        payload: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map(({ payload, ...row }) => {
      if (row.productName !== null && row.amountCents !== null && row.currency !== null) return row;
      const fromPayload = summarizeBillingEvent(payload);
      return {
        ...row,
        productName: row.productName ?? fromPayload.productName,
        amountCents: row.amountCents ?? fromPayload.amountCents,
        currency: row.currency ?? fromPayload.currency,
      };
    });
  }

  /**
   * Opens a checkout session, or returns the one already open for this user and product.
   *
   * The record in Redis is the purchase idempotency (V-125): keyed per (user, product), claimed
   * before the provider call so two clicks at once make one session, kept for the provider's
   * session lifetime, consumed by the webhook that settles the product, and cleared by
   * `cancelCheckout` only once the provider confirms nothing is being paid. A repeat request for
   * the same interval gets the same URL; a different interval, or an overlapping product, is
   * refused until that session is settled or cleared.
   */
  static async createCheckout(
    userId: string,
    productKey: ProductKey,
    interval: BillingIntervalInput,
    redirectUrl?: string,
  ) {
    const productId = getProviderProductId(productKey, interval);

    if (!productCatalog[productKey].prices[interval])
      throw new ApiError(400, "That billing interval is not available for this product.");
    if (!productId) throw new ApiError(503, "The selected billing product is not configured.");

    // The "has this user subscribed before" lookup that used to sit here existed only
    // to decide trial eligibility. With no trials, it is a query per checkout for a
    // value nothing reads.
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new ApiError(404, "User not found");
    const now = new Date();
    const liveSubscriptions = await prisma.subscription.findMany({
      where: {
        userId,
        OR: [
          {
            status: "ACTIVE",
            OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
          },
          // Dunning is live whether or not the grace window is still running: Dodo keeps
          // retrying the card, the same rule account deletion applies (V-168).
          { status: "PAST_DUE" },
        ],
      },
      select: { productKey: true, status: true, rawStatus: true },
    });
    const overlap = checkoutOverlap(productKey, interval, liveSubscriptions);
    if (overlap) throw overlap;

    const redis = getRedis();
    const recordKey = checkoutRecordKey(userId, productKey);
    const claim: CheckoutRecord = { state: "claimed", token: randomUUID() };

    for (let attempt = 0; ; attempt += 1) {
      // Another product's open session blocks this one when the two overlap (bundle vs single).
      for (const other of overlappingProductKeys(productKey)) {
        if (other === productKey) continue;
        if (parseCheckoutRecord(await redis.get(checkoutRecordKey(userId, other))))
          throw new ApiError(409, CHECKOUT_ACTIVE_MESSAGE);
      }

      const claimed =
        (await redis.set(recordKey, JSON.stringify(claim), {
          NX: true,
          EX: CHECKOUT_CLAIM_TTL_SECONDS,
        })) === "OK";
      if (claimed) break;

      const existing = parseCheckoutRecord(await redis.get(recordKey));
      if (existing?.state === "open") {
        if (existing.interval === interval) return { url: existing.url, reused: true };
        throw new ApiError(409, CHECKOUT_ACTIVE_MESSAGE);
      }
      // A claim: a concurrent request is creating the session right now. Wait for it and hand
      // back its URL rather than opening a second one. Gone meanwhile (the other call failed
      // and released it): the loop claims it on the next pass.
      if (attempt >= CHECKOUT_CLAIM_WAIT_ATTEMPTS)
        throw new ApiError(409, "A checkout is being prepared. Try again in a moment.");
      await sleep(CHECKOUT_CLAIM_WAIT_MS);
    }

    try {
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

      const checkout = await getDodoCheckoutClient().checkoutSessions.create({
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

      const record: CheckoutRecord = {
        state: "open",
        sessionId: checkout.session_id,
        url: checkout.checkout_url,
        interval,
        createdAt: new Date().toISOString(),
      };
      const stored = await redis.eval(compareAndSetScript, {
        keys: [recordKey],
        arguments: [
          JSON.stringify(claim),
          JSON.stringify(record),
          String(CHECKOUT_RECORD_TTL_SECONDS),
        ],
      });
      if (Number(stored) !== 1) {
        // Our claim expired while the provider call ran, and the key may now hold another
        // request's session. Overwriting it would leave one of the two sessions payable and
        // untracked, and handing out this URL would invite paying it.
        logger.error("Checkout claim lost before the session was recorded", {
          userId,
          productKey,
          sessionId: checkout.session_id,
        });
        throw new ApiError(409, CHECKOUT_ACTIVE_MESSAGE);
      }

      return { url: checkout.checkout_url, reused: false };
    } catch (error) {
      // Only our own claim: a record another request completed meanwhile stays.
      await redis
        .eval(compareAndDeleteScript, { keys: [recordKey], arguments: [JSON.stringify(claim)] })
        .catch((releaseError) =>
          logger.warn("Failed to release a checkout claim", { userId, error: releaseError }),
        );
      throw error;
    }
  }

  /**
   * Forgets the user's open checkout sessions, but only those the provider confirms are not
   * being paid. A session whose payment succeeded or is processing stays until its webhook
   * settles it: dropping it would let a second session for the same product be opened and paid.
   */
  static async cancelCheckout(userId: string) {
    const redis = getRedis();
    const cleared: ProductKey[] = [];
    const paying: ProductKey[] = [];
    let preparing = false;

    for (const productKey of PRODUCT_KEYS) {
      const key = checkoutRecordKey(userId, productKey);
      const raw = await redis.get(key);
      const record = parseCheckoutRecord(raw);
      if (!record) continue;
      if (record.state === "claimed") {
        preparing = true;
        continue;
      }

      let paymentStatus: string | null | undefined;
      try {
        paymentStatus = (await getDodoClient().checkoutSessions.retrieve(record.sessionId))
          .payment_status;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          503,
          "Could not confirm the checkout with the billing provider. Try again in a moment.",
          { reason: error instanceof Error ? error.message : "provider unavailable" },
        );
      }

      if (paymentStatus && PAYMENT_IN_FLIGHT_STATUSES.has(paymentStatus)) {
        paying.push(productKey);
        continue;
      }

      // Compare-and-delete on the exact record read: a webhook or a newer session wins.
      await redis.eval(compareAndDeleteScript, { keys: [key], arguments: [raw as string] });
      cleared.push(productKey);
    }

    if (paying.length > 0)
      throw new ApiError(
        409,
        `A payment for ${paying.map((key) => productCatalog[key].name).join(", ")} is still being processed. Wait for the confirmation before starting another checkout.`,
      );
    if (preparing && cleared.length === 0)
      throw new ApiError(409, "A checkout is still being prepared. Try again in a moment.");

    return { success: true, cleared };
  }

  /**
   * The provider settled this product one way or another; the open-session record is spent, but
   * only when the event is about that session. An event naming another checkout session, or one
   * about a subscription or payment created before the record was opened (a late cancel or
   * renewal of an older subscription), leaves a newer open checkout alone. A claim is a session
   * still being created, which no event can be about yet.
   */
  private static async settleCheckoutRecord(
    userId: string,
    productKey: ProductKey,
    event: { checkoutSessionId?: string | null; createdAt?: string | null },
  ) {
    try {
      const redis = getRedis();
      const key = checkoutRecordKey(userId, productKey);
      const raw = await redis.get(key);
      const record = parseCheckoutRecord(raw);
      if (!record || record.state !== "open") return;

      if (event.checkoutSessionId) {
        if (event.checkoutSessionId !== record.sessionId) return;
      } else if (event.createdAt) {
        const eventCreatedAt = Date.parse(event.createdAt);
        const openedAt = Date.parse(record.createdAt);
        if (eventCreatedAt < openedAt - CHECKOUT_SETTLE_CLOCK_SLACK_MS) return;
      }

      // Compare-and-delete on the exact record read: a session opened meanwhile stays.
      await redis.eval(compareAndDeleteScript, { keys: [key], arguments: [raw as string] });
    } catch (error) {
      logger.warn("Failed to clear a settled checkout record", { error });
    }
  }

  /**
   * The customer portal (receipts, invoices, cancellation). A subscriber's customer id is on the
   * subscription row; a pass or credit-pack buyer's is the one recorded from their payment
   * (V-175).
   */
  static async createPortal(userId: string) {
    const [subscription, user] = await Promise.all([
      prisma.subscription.findFirst({
        where: { userId, providerCustomerId: { not: null } },
        orderBy: { updatedAt: "desc" },
        select: { providerCustomerId: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { billingCustomerId: true } }),
    ]);
    const customerId = subscription?.providerCustomerId ?? user?.billingCustomerId ?? null;

    if (!customerId) throw new ApiError(409, "No billing account exists yet.");

    const portal = await getDodoClient().customers.customerPortal.create(customerId, {
      return_url: config.dodo.portalReturnUrl,
    });

    return { url: portal.link };
  }

  /**
   * Schedules (or withdraws) a cancellation at the end of the paid period at the provider, and
   * returns what the provider now reports (V-169). Dodo is the system that charges the card, so
   * a cancellation that only exists in our database cancels nothing. Any failure is a 502 before
   * anything local changes; the caller writes the provider's answer, not its own request.
   */
  static async setProviderCancelAtPeriodEnd(providerSubId: string, cancelAtPeriodEnd: boolean) {
    let result: Awaited<ReturnType<DodoPayments["subscriptions"]["update"]>>;
    try {
      result = await getDodoClient().subscriptions.update(providerSubId, {
        cancel_at_next_billing_date: cancelAtPeriodEnd,
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        502,
        "The billing provider did not confirm the change, so nothing was changed. Try again.",
        { reason: error instanceof Error ? error.message : "provider unavailable" },
      );
    }

    return {
      cancelAtPeriodEnd: Boolean(result.cancel_at_next_billing_date),
      status: result.status,
      nextBillingDate: result.next_billing_date ? new Date(result.next_billing_date) : null,
    };
  }

  /**
   * What the provider reports for a subscription right now, as its raw status and the status it
   * maps to. Admin edits that end a subscription locally check this first (the provider charges
   * the card, so only its word can say a subscription has ended). Any failure is a 502.
   */
  static async getProviderSubscriptionState(providerSubId: string) {
    let result: Awaited<ReturnType<DodoPayments["subscriptions"]["retrieve"]>>;
    try {
      result = await getDodoClient().subscriptions.retrieve(providerSubId);
    } catch (error) {
      throw new ApiError(
        502,
        "The billing provider could not be asked about this subscription, so nothing was changed. Try again.",
        { reason: error instanceof Error ? error.message : "provider unavailable" },
      );
    }

    return { rawStatus: result.status, status: statusFromDodo(result.status)?.status ?? null };
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
    const checkout = await getDodoCheckoutClient().checkoutSessions.create({
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
    if (isProduction) return false;

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

    // Token lock, renewed while the attempt runs and released by compare-and-delete (V-127):
    // an attempt that outlives the TTL keeps its lock, and never deletes a retry's.
    const lock = await acquireJobLock(`billing:webhook:lock:${providerEventId}`, {
      ttlMs: WEBHOOK_LOCK_TTL_SECONDS * 1000,
    });

    if (!lock) {
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
            ...(await summarizeStoredEvent(parsedEvent)),
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
        let attributedUserId: string | null = null;
        let note: string | null = null;
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
          attributedUserId = userId;
        }
        if (parsedEvent.type === "payment.succeeded") {
          const payment = dodoPaymentSchema.parse(parsedEvent.data);
          const userId = await this.applyPaymentEvent(payment, new Date(parsedEvent.timestamp));
          await prisma.billingWebhookEvent.update({ where: { id: stored.id }, data: { userId } });
          attributedUserId = userId;
          // Applied to nobody: the account is gone, but the money was taken.
          if (!userId) note = refundNeededNote(payment);
        }
        if (parsedEvent.type === "refund.succeeded") {
          const refund = refundEventSchema.parse(parsedEvent.data);
          const userId = await this.applyRefund(refund);
          if (userId)
            await prisma.billingWebhookEvent.update({ where: { id: stored.id }, data: { userId } });
          attributedUserId = userId;
        }
        if (parsedEvent.type === "payment.failed") {
          const payment = dodoPaymentSchema.parse(parsedEvent.data);
          const userId = await this.applyPaymentFailed(payment);
          await prisma.billingWebhookEvent.update({ where: { id: stored.id }, data: { userId } });
          attributedUserId = userId;
        }

        // Decision 5: an event for a deleted account is kept without the personal data in it.
        if (!attributedUserId) await redactIfForDeletedAccount(stored.id, parsedEvent.data);

        // The note rides on the event's `error` field, which the admin webhook list shows and
        // searches: a processed event with a note is one a human still has to act on.
        await prisma.billingWebhookEvent.update({
          where: { id: stored.id },
          data: { status: "PROCESSED", processedAt: new Date(), ...(note ? { error: note } : {}) },
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
      await lock.release();
    }
  }

  /** Post-commit work, safe to repeat: every call here is an invalidation, not a mutation. */
  private static async invalidateAfterBillingChange(userId: string) {
    // Grants first: the free-tier move below reads them through the entitlement cache.
    await EntitlementService.invalidateEntitlements(userId);
    await this.settleLapsedPortfolio(userId);

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
      // Every grant write in this file and in reconcileAccess's callers ends here (V-108).
      // Bumped again: a reader between the first bump and the writes above may have re-cached.
      EntitlementService.invalidateEntitlements(userId),
    ]);
  }

  /**
   * Decision 6: a premium portfolio this change lapsed (billing suspended it, or its grace is
   * over) moves to its free template now rather than sitting offline until the hourly
   * `portfolioAccessJob`. Moderation and the user's own unpublish are never touched (see
   * `PortfolioService.settleLapsedPortfolioFor`). Never throws: the billing change is committed,
   * and the job settles the row on its next run if this fails.
   */
  private static async settleLapsedPortfolio(userId: string) {
    try {
      // Imported here: portfolioService imports this module at load time.
      const { PortfolioService } = await import("#services/portfolioService");
      await PortfolioService.settleLapsedPortfolioFor(userId);
    } catch (error) {
      logger.warn("Could not move a lapsed portfolio to the free tier; the job will retry", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private static async applySubscriptionEvent(
    subscription: z.infer<typeof dodoSubscriptionSchema>,
    eventTime: Date,
  ) {
    const existing = await prisma.subscription.findUnique({
      where: { providerSubId: subscription.subscription_id },
    });

    const userId = subscription.metadata.veriworkly_user_id || existing?.userId;

    if (await isDeletedAccount(userId, existing, { subscriptionId: subscription.subscription_id }))
      return null;
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

        // The checkout record is the only thing standing between a customer and a second
        // subscription for one product (V-125); if it ever failed, this is the alarm. Not a
        // reason to fail the event: the customer paid, and the fix is a refund by hand.
        if (normalizedStatus === "ACTIVE") {
          const others = await tx.subscription.count({
            where: {
              userId,
              productKey,
              status: "ACTIVE",
              providerSubId: { not: subscription.subscription_id },
              OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
            },
          });
          if (others > 0)
            logger.error(
              `CRITICAL: user ${userId} holds more than one ACTIVE subscription for ${productKey}; refund the duplicate.`,
              { userId, productKey, subscriptionId: subscription.subscription_id, others },
            );
        }

        const access = accessStatus({ status: normalizedStatus, currentPeriodEnd, graceEndsAt });

        if (touchesGrants)
          await syncSubscriptionGrants(tx, {
            userId,
            sourceId: subscription.subscription_id,
            productKey,
            status: normalizedStatus,
            currentPeriodEnd,
            graceEndsAt,
            at: eventTime,
          });

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

    // Any outcome settles the open checkout; `pending` is not one yet (the first charge or the
    // mandate is still in flight), and the record must keep a second session closed meanwhile.
    if (subscription.status !== "pending")
      await this.settleCheckoutRecord(userId, productKey, { createdAt: subscription.created_at });
    await this.invalidateAfterBillingChange(userId);

    if (staleEvent) return userId;

    // A purchase is a subscription that becomes ACTIVE for the first time: new, or out of
    // `pending` (V-177). Renewals and recoveries from dunning are not purchases. The claim row
    // keys it on the subscription, so a redelivered activation mails once.
    if (normalizedStatus === "ACTIVE" && (isNewSubscription || previousStatus === "INACTIVE")) {
      const amountFromProvider = subscription.recurring_pre_tax_amount ?? null;
      const allowance = productCatalog[productKey].creditAllowance?.[rawInterval] ?? 0;
      void notifyOnce("purchase_subscription", subscription.subscription_id, userId, {
        template: "purchase_confirmation",
        details: {
          kind: "subscription",
          productName: purchaseName(productKey, rawInterval),
          amountCents: amountFromProvider ?? productCatalog[productKey].prices[rawInterval] ?? null,
          currency: (amountFromProvider !== null && subscription.currency) || "USD",
          amountExcludesTax: amountFromProvider === null || !subscription.tax_inclusive,
          accessEndsAt: currentPeriodEnd,
          renewsAt: subscription.cancel_at_next_billing_date ? null : currentPeriodEnd,
          billingPeriod: rawInterval === "annual" ? "year" : "month",
          credits: null,
          creditsNote:
            allowance <= 0
              ? null
              : (productCatalog[productKey].creditNotes?.[rawInterval] ??
                `${allowance.toLocaleString("en-US")} credits each month. Unused credits expire at the end of the month; nothing rolls over.`),
        },
      });
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
    if (await isDeletedAccount(userId, subscription, { paymentId: payment.payment_id }))
      return null;
    if (!userId) {
      logger.error("Payment webhook cannot be attributed to a user", {
        paymentId: payment.payment_id,
        subscriptionId: payment.subscription_id ?? null,
      });
      throw new ApiError(400, "Payment webhook is missing VeriWorkly user metadata.");
    }

    // The billing portal needs a Dodo customer; a pass or pack buyer has no subscription row to
    // carry one (V-175). The latest payment's customer wins.
    const customerId = payment.customer?.customer_id;
    if (customerId)
      await prisma.user.updateMany({
        where: {
          id: userId,
          OR: [{ billingCustomerId: null }, { billingCustomerId: { not: customerId } }],
        },
        data: { billingCustomerId: customerId },
      });

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
      const expiresAt = addDays(paidAt, pack.expiresInDays);
      await CreditService.grant(userId, pack.credits, {
        requestId: `payment-credit:${payment.payment_id}`,
        source: CREDIT_SOURCES.creditPack,
        sourceId: payment.payment_id,
        expiresAt,
        reason: pack.name,
      });
      void notifyOnce("purchase_payment", payment.payment_id, userId, {
        template: "purchase_confirmation",
        details: {
          ...oneTimePurchase(payment),
          kind: "credit_pack",
          productName: pack.name,
          accessEndsAt: expiresAt,
          credits: pack.credits,
        },
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
      // A subscription payment that names no checkout session is a renewal; the subscription's
      // own events settle its checkout.
      if (payment.checkout_session_id || !payment.subscription_id)
        await this.settleCheckoutRecord(userId, productKey, {
          checkoutSessionId: payment.checkout_session_id,
          createdAt: payment.created_at,
        });

      // The allowance lives at least one catalog interval from the payment. The stored period
      // end is only trusted when it is further out: `payment.succeeded` and
      // `subscription.renewed` have no ordering guarantee, and after dunning recovery the row
      // still holds the period that just ended, so a grant keyed on it would expire at once.
      const intervalEnd = addCatalogInterval(paidAt, interval);
      const periodEndGuess =
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
      } else if (allowance > 0 && interval === "annual" && payment.subscription_id) {
        // Annual plans deliver 1,000 a month, not the year's allowance up front (owner
        // decision 4): the payment opens the schedule for the period it pays for and grants
        // month one now; `jobs/annualCreditJob` grants the rest as each month starts.
        const schedule = await openAnnualCreditSchedule({
          userId,
          providerSubId: payment.subscription_id,
          productKey,
          paymentId: payment.payment_id,
          periodStart: servicePeriod ? new Date(servicePeriod.starts_at) : paidAt,
          periodEnd: servicePeriod ? new Date(servicePeriod.ends_at) : periodEndGuess,
          servicePeriodKnown: Boolean(servicePeriod),
        });
        // Month one arrives with the payment, or with its period when that starts within a day
        // (a renewal charged just ahead of it); a period further out is the job's to start.
        // No schedule: a legacy up-front year still covers this period.
        if (schedule) {
          const now = new Date();
          const startsSoon =
            schedule.periodStart > now && schedule.periodStart.getTime() - now.getTime() <= DAY_MS;
          await grantDueMonths(schedule.id, startsSoon ? schedule.periodStart : now);
        }
      } else if (allowance > 0) {
        // One allowance per credit month, and nothing rolls over: the grant expires when the
        // month it pays for ends (the service period's end when the payload names one), and it
        // replaces whatever is left of the subscription's earlier credits. When the payload names
        // the service period, the grant is keyed on it so a second successful charge in the same
        // period cannot mint a second allowance. The request id stays per payment, so a retry of
        // this event returns the grant it already made. Without a service period the payment id
        // is the only stable key (the stored period end moves with webhook order and would
        // collide across renewals); a pass has no subscription to key on.
        const sourceId = servicePeriod
          ? `${payment.subscription_id}:${servicePeriod.starts_at}`
          : payment.subscription_id
            ? `${payment.subscription_id}:payment:${payment.payment_id}`
            : payment.payment_id;
        const creditMonthStart = servicePeriod ? new Date(servicePeriod.starts_at) : paidAt;
        // Accepted, customer-favourable: grants have no start date, so a renewal charged before
        // its month starts is spendable at once, and until that start (the cut below never moves
        // earlier than it) last month's remainder is spendable too. For that short overlap two
        // months' credits can be spent; from the new month's start only the new 1,000 is left.

        try {
          await CreditService.grant(userId, allowance, {
            requestId: `subscription-credit:${payment.payment_id}`,
            source: CREDIT_SOURCES.subscriptionPayment,
            sourceId,
            expiresAt: servicePeriod ? new Date(servicePeriod.ends_at) : periodEndGuess,
            reason: `${productCatalog[productKey].name} credit allowance`,
            ...(payment.subscription_id
              ? {
                  supersedes: {
                    where: await subscriptionCreditGrantsWhere(payment.subscription_id),
                    at: creditMonthStart,
                  },
                }
              : {}),
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

      // Passes have no subscription event, so their confirmation hangs on the payment (V-177).
      if (isPass)
        void notifyOnce("purchase_payment", payment.payment_id, userId, {
          template: "purchase_confirmation",
          details: {
            ...oneTimePurchase(payment),
            kind: "pass",
            productName: PASS_NAMES[interval as "one_day" | "seven_day"],
            accessEndsAt: intervalEnd,
            credits: earnsAllowance && allowance > 0 ? allowance : null,
          },
        });
    }

    await this.recordAffiliateCommission(userId, payment);
    await this.invalidateAfterBillingChange(userId);
    return userId;
  }

  /**
   * A fully refunded annual payment stops the monthly credit schedule it opened: no further month
   * is granted for a year that was paid back. A partial refund (a goodwill credit, a proration)
   * leaves it running. Full means the provider's `is_partial` is false, or, without that flag, a
   * refund amount at least the payment's total as its stored `payment.succeeded` event recorded
   * it. Credits already granted stay (their month expires on its own). Every other refund needs
   * nothing here: access follows the provider's subscription events, and a refunded pack or pass
   * is handled by hand as before. Returns the schedule's user, or null when nothing applies.
   */
  private static async applyRefund(refund: z.infer<typeof refundEventSchema>) {
    const paymentId = refund.payment_id;
    const schedule = await prisma.subscriptionCreditSchedule.findFirst({
      where: { openedByPaymentId: paymentId },
      select: { id: true, userId: true, providerSubId: true },
    });
    if (!schedule) return null;

    let full = refund.is_partial === false;
    if (refund.is_partial == null && refund.amount != null) {
      const paid = await prisma.billingWebhookEvent.findFirst({
        where: {
          type: "payment.succeeded",
          payload: { path: ["data", "payment_id"], equals: paymentId },
        },
        select: { payload: true },
      });
      const data = (paid?.payload as { data?: { total_amount?: unknown } } | null)?.data;
      full = typeof data?.total_amount === "number" && refund.amount >= data.total_amount;
    }
    if (!full) {
      logger.info("Partial refund of an annual payment; its monthly credits continue", {
        scheduleId: schedule.id,
        paymentId,
      });
      return schedule.userId;
    }

    const stopped = await prisma.subscriptionCreditSchedule.updateMany({
      where: { id: schedule.id, stoppedAt: null },
      data: { stoppedAt: new Date() },
    });
    if (stopped.count)
      logger.info("Annual credit schedule stopped: its payment was refunded", {
        scheduleId: schedule.id,
        providerSubId: schedule.providerSubId,
        paymentId,
      });
    return schedule.userId;
  }

  /**
   * A subscription charge failed: dunning has started (V-172). Nothing changes in access here
   * (the subscription's own `on_hold`/`past_due` event does that); the customer gets one email
   * per failed payment saying what failed and until when the plan is kept. A failed one-time
   * checkout is not mailed: the customer is still on the checkout page and sees it there.
   */
  private static async applyPaymentFailed(payment: z.infer<typeof dodoPaymentSchema>) {
    const subscription = payment.subscription_id
      ? await prisma.subscription.findUnique({
          where: { providerSubId: payment.subscription_id },
          select: { userId: true, productKey: true, graceEndsAt: true },
        })
      : null;
    const userId = payment.metadata.veriworkly_user_id || subscription?.userId;
    // Before anything is attributed: a deleted account's event is recorded as processed (and
    // redacted), never written against a user id that no longer exists.
    if (await isDeletedAccount(userId, subscription, { paymentId: payment.payment_id }))
      return null;
    if (!userId || !subscription) return userId ?? null;

    const now = new Date();
    const graceEndsAt =
      subscription.graceEndsAt && subscription.graceEndsAt > now
        ? subscription.graceEndsAt
        : addDays(now, config.portfolio.graceDays);
    const productName = isProductKey(subscription.productKey)
      ? PRODUCT_NAMES[subscription.productKey]
      : "VeriWorkly";

    void notifyOnce("payment_failed", payment.payment_id, userId, {
      template: "payment_failed",
      subscriptionId: payment.subscription_id ?? undefined,
      details: {
        productName,
        amountCents: payment.total_amount ?? null,
        currency: payment.currency ?? null,
        graceEndsAt,
      },
    });
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

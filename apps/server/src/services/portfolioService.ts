import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { config } from "#config";
import { BILLING_SUSPENSION_REASONS, BillingService } from "#services/billingService";
import { EntitlementService } from "#services/entitlementService";
import { enforcedEntitlement } from "#services/entitlementEnforcement";
import {
  PortfolioAssetService,
  referencedAssetIds,
  USER_UNPUBLISHED_REASON,
} from "#services/portfolioAssetService";
import { ENTITLEMENT_KEYS } from "#services/productCatalog";

import {
  invalidatePublicPortfolioCaches,
  publicPortfolioCacheKey,
  publicPortfolioListCacheKey,
  revalidatePublicPortfolios,
} from "#utils/portfolioPublicationCache";

import { prisma } from "#lib/prisma";
import { logger } from "#lib/logger";
import { ApiError, handleValidationError } from "#lib/errors";
import { normalizePortfolioSubdomain, portfolioSubdomainLookupKey } from "#utils/slugs";
import { cacheGet, cacheSet, cacheDel, getRedis } from "#lib/redis";
import { acquireJobLock } from "#lib/jobLock";
import { bumpGeneration, singleFlight } from "#lib/cacheGeneration";
import { cacheNamespaces, documentCacheNamespaces, userProfileCacheKey } from "#lib/cacheKeys";
import { hashForAnalytics } from "#utils/analyticsHash";
import { sendPortfolioUpdatedEmail } from "#services/mail/portfolioMail";

import {
  isPremiumPortfolioTemplate,
  portfolioContentSchema,
  type PortfolioContentInput,
} from "#validators/portfolioValidator";

/** The paid portfolio features, each checked below (V-142; see `entitlementEnforcement`). */
const PORTFOLIO_PUBLISH = enforcedEntitlement(
  ENTITLEMENT_KEYS.PORTFOLIO_PUBLISH,
  "PortfolioService.publish (premium templates), getPublicPortfolio (premium rendering)",
);
const WATERMARK_REMOVAL = enforcedEntitlement(
  ENTITLEMENT_KEYS.WATERMARK_REMOVAL,
  "PortfolioService.publish (badge)",
);
const SEO_CONTROLS = enforcedEntitlement(
  ENTITLEMENT_KEYS.SEO_CONTROLS,
  "PortfolioService.publish (SEO block)",
);
const ANALYTICS = enforcedEntitlement(ENTITLEMENT_KEYS.ANALYTICS, "PortfolioService.getAnalytics");

const VIEW_BUFFER_TTL_SECONDS = 14 * 24 * 60 * 60;
const MAX_VIEW_BUFFER_FIELDS = 10_000;
// A vanity metric doesn't need per-request precision, but trivially repeatable POSTs shouldn't be
// able to inflate it either — collapse repeat views from the same viewer within this window.
const VIEW_DEDUP_WINDOW_SECONDS = 30 * 60;
/** Above the flush's whole budget (one INSERT under the 30 s statement timeout, plus Redis). */
const VIEW_FLUSH_LOCK_SECONDS = 300;

/**
 * V-114: one round trip, and the cap check cannot race. KEYS: buffer, pending, dedup (or "").
 * ARGV: field, fallback field, cap, date key, buffer TTL, dedup TTL. Returns 0 for a repeat view.
 */
const BUFFER_PORTFOLIO_VIEW_SCRIPT = `
  if KEYS[3] ~= "" and not redis.call("SET", KEYS[3], "1", "NX", "EX", ARGV[6]) then
    return 0
  end
  local field = ARGV[1]
  if redis.call("HEXISTS", KEYS[1], field) == 0 and redis.call("HLEN", KEYS[1]) >= tonumber(ARGV[3]) then
    field = ARGV[2]
  end
  redis.call("HINCRBY", KEYS[1], field, 1)
  redis.call("HINCRBY", KEYS[2], ARGV[4], 1)
  redis.call("EXPIRE", KEYS[1], ARGV[5])
  redis.call("EXPIRE", KEYS[2], ARGV[5])
  return 1
`;

// The sitemap asks for everything; a bound keeps one unparameterised GET from streaming the table.
const PUBLIC_LIST_MAX = 1000;

/**
 * `suspensionReason` values that make a suspension sticky. An admin takedown is stored as
 * `moderation:<free text>`; `user_unpublished` is the user's own takedown and billing's own
 * reasons are listed in `BILLING_SUSPENSION_REASONS`. Anything else on a SUSPENDED row is
 * treated as moderation too, so an unknown reason fails closed. A locked row is left alone by
 * the user's Publish/Unpublish and by billing; only an admin setting the status back to LIVE
 * (`adminPortfolioService.updatePublicationStatus`) lifts it.
 */
export const MODERATION_SUSPENSION_PREFIX = "moderation:";

export function isModerationLocked(publication: {
  status: string;
  suspensionReason: string | null;
}) {
  if (publication.status !== "SUSPENDED") return false;

  const reason = publication.suspensionReason;

  return (
    reason !== null &&
    reason !== USER_UNPUBLISHED_REASON &&
    !(BILLING_SUSPENSION_REASONS as readonly string[]).includes(reason)
  );
}

/** Owner-facing: `keep` lists the names this user already holds (see `ownedSubdomains`). */
function normalizeSubdomain(value: string, keep: Iterable<string> = []) {
  const subdomain = normalizePortfolioSubdomain(value, keep);

  if (!subdomain) throw new ApiError(400, "Choose a valid portfolio subdomain.");

  return subdomain;
}

/**
 * The subdomains a user already holds: their publication's and their draft's stored slug.
 * Re-saving or re-publishing one of these skips the new-name rules (reserved list, punycode,
 * trailing dash), so a site published before a name was reserved keeps working for its owner.
 */
async function ownedSubdomains(userId: string, documentId?: string) {
  const [publication, document] = await Promise.all([
    prisma.portfolioPublication.findUnique({ where: { userId }, select: { subdomain: true } }),
    prisma.document.findFirst({
      where: {
        userId,
        type: "PORTFOLIO",
        deletedAt: null,
        ...(documentId ? { id: documentId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: { slug: true },
    }),
  ]);

  return [publication?.subdomain, document?.slug].filter((name): name is string => Boolean(name));
}

/** A subscription that still pays for premium publishing, or whose grace window is running. */
function governsPublication(
  subscription: { status: string; currentPeriodEnd: Date | null; graceEndsAt: Date | null },
  now: Date,
) {
  const inPeriod = !subscription.currentPeriodEnd || subscription.currentPeriodEnd > now;

  return (
    (subscription.status === "ACTIVE" && inPeriod) ||
    (subscription.status === "CANCELED" &&
      subscription.currentPeriodEnd !== null &&
      subscription.currentPeriodEnd > now) ||
    (subscription.graceEndsAt !== null && subscription.graceEndsAt > now)
  );
}

function utcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function normalizeReferrerHost(referrer?: string) {
  if (!referrer) return "";

  try {
    return new URL(referrer).hostname.toLowerCase().slice(0, 255);
  } catch {
    return "";
  }
}

/**
 * `removeWatermark` arrives inside the client-supplied content payload, so it is a
 * request rather than a fact. The published snapshot must record the server's own
 * decision: a publisher without the `watermark_removal` entitlement always stores
 * `false`, whatever was posted.
 *
 * The public renderer independently guards on `isPremium`, so this is defence in
 * depth - but it also keeps the persisted snapshot honest for everything that reads
 * it later (admin views, support, any future export of the publication).
 */
export function resolveWatermarkFlag(
  requested: boolean | undefined,
  canRemoveWatermark: boolean,
): boolean {
  return canRemoveWatermark ? requested === true : false;
}

/**
 * The SEO block (meta title, description, social image) is a paid control (`seo_controls`,
 * V-142). Without it the published snapshot carries the empty block, and the public page
 * falls back to the name and bio as it does for any portfolio that never set one. The draft
 * keeps what the user typed, so it goes live as soon as they upgrade and republish.
 */
export function resolveSeo(
  requested: PortfolioContentInput["seo"],
  canControlSeo: boolean,
): PortfolioContentInput["seo"] {
  return canControlSeo ? requested : { title: "", description: "", socialImage: null };
}

export class PortfolioService {
  static async listPublicPortfolios(limit?: number, offset?: number) {
    type PublicListItem = { subdomain: string; updatedAt: string | Date };

    const cacheKey = await publicPortfolioListCacheKey(limit, offset);
    const readCache = async () => (cacheKey ? cacheGet<PublicListItem[]>(cacheKey) : null);
    const cached = await readCache();

    if (cached) return cached;

    const build = async (): Promise<PublicListItem[]> => {
      const result = await prisma.portfolioPublication.findMany({
        where: { status: { in: ["LIVE", "GRACE"] } },
        select: { subdomain: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: limit ?? PUBLIC_LIST_MAX,
        skip: offset,
      });

      if (cacheKey) await cacheSet(cacheKey, result, 300);

      return result;
    };

    // Concurrent cold misses (the sitemap build fans out) run the query once (V-117).
    return cacheKey ? singleFlight(cacheKey, 2_000, build, readCache) : build();
  }

  /**
   * Read-only: rows are looked up by their stored key, so a reserved name is simply one with no
   * publication behind it (404) while a site published before the name was reserved still
   * serves. A GRACE row whose subscription grace has lapsed is hidden here but suspended only
   * by `jobs/portfolioAccessJob` — a public GET never writes.
   */
  static async getPublicPortfolio(subdomain: string) {
    const normalized = portfolioSubdomainLookupKey(subdomain);

    if (!normalized) return null;

    const cacheKey = publicPortfolioCacheKey(normalized);
    const now = new Date();

    const cached = await cacheGet<{
      id: string;
      subdomain: string;
      templateId: string;
      snapshot: unknown;
      status: string;
      updatedAt: string;
      isPremium: boolean;
    }>(cacheKey);

    if (cached) return cached;

    const publication = await prisma.portfolioPublication.findUnique({
      where: { subdomain: normalized },
      select: {
        id: true,
        subdomain: true,
        templateId: true,
        snapshot: true,
        status: true,
        updatedAt: true,
        user: {
          select: {
            // The latest portfolio subscription, whatever its state: a GRACE row is hidden once
            // that subscription's grace has lapsed. A GRACE row with no subscription at all (an
            // expired pass) has no provider clock and serves until the job suspends it.
            subscriptions: {
              where: { productKey: { in: ["portfolio_pro", "bundle"] } },
              select: { status: true, currentPeriodEnd: true, graceEndsAt: true },
              orderBy: [{ graceEndsAt: "desc" }, { updatedAt: "desc" }],
              take: 1,
            },
            // Premium rendering follows the publish grant whatever its source (subscription,
            // pass, MANUAL comp), the same predicate `canPublish` uses.
            entitlementGrants: {
              where: {
                key: PORTFOLIO_PUBLISH,
                startsAt: { lte: now },
                revokedAt: null,
                OR: [{ endsAt: null }, { endsAt: { gt: now } }],
              },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!publication || publication.status === "SUSPENDED") return null;

    const subscription = publication.user.subscriptions[0];
    const subscriptionGoverns = subscription ? governsPublication(subscription, now) : false;
    const graceEndsAt =
      subscription && subscription.status !== "ACTIVE" ? subscription.graceEndsAt : null;

    if (publication.status === "GRACE" && subscription && !subscriptionGoverns) return null;

    // Premium rendering is for premium templates only, while a publish grant is in effect
    // (any source: subscription, pass, MANUAL comp) or during the GRACE courtesy window, when
    // the grant is already gone but the site still renders as paid until the job suspends it.
    const isPremium =
      isPremiumPortfolioTemplate(publication.templateId) &&
      (publication.user.entitlementGrants.length > 0 || publication.status === "GRACE");

    const result = {
      id: publication.id,
      subdomain: publication.subdomain,
      templateId: publication.templateId,
      snapshot: publication.snapshot,
      status: publication.status,
      updatedAt: publication.updatedAt.toISOString(),
      isPremium,
    };

    let ttl = 600;

    if (publication.status === "GRACE" && graceEndsAt) {
      const msLeft = new Date(graceEndsAt).getTime() - Date.now();

      if (msLeft > 0) {
        ttl = Math.min(600, Math.ceil(msLeft / 1000));
      } else {
        ttl = 0;
      }
    }

    if (ttl > 0) await cacheSet(cacheKey, result, ttl);

    return result;
  }

  static async getDraft(userId: string) {
    return prisma.document.findFirst({
      where: { userId, type: "PORTFOLIO", deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        templateId: true,
        content: true,
        revision: true,
        updatedAt: true,
      },
    });
  }

  static async getMe(userId: string) {
    const [draft, publication, billing] = await Promise.all([
      this.getDraft(userId),
      prisma.portfolioPublication.findUnique({
        where: { userId },
        select: {
          subdomain: true,
          status: true,
          publishedRevision: true,
          publishedAt: true,
          updatedAt: true,
        },
      }),
      BillingService.getSummary(userId),
    ]);

    return { draft, publication, billing };
  }

  static async getPreview(userId: string, documentId: string) {
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId, type: "PORTFOLIO", deletedAt: null },
      select: { id: true, templateId: true, content: true, revision: true, updatedAt: true },
    });

    if (!document) throw new ApiError(404, "Portfolio draft not found.");

    return document;
  }

  static async isSubdomainAvailable(userId: string, value: string) {
    const subdomain = normalizeSubdomain(value, await ownedSubdomains(userId));

    const existing = await prisma.portfolioPublication.findUnique({
      where: { subdomain },
      select: { userId: true },
    });

    return { subdomain, available: !existing || existing.userId === userId };
  }

  static async saveDraft(
    userId: string,
    input: {
      documentId?: string;
      subdomain: string;
      revision?: number;
      snapshot: PortfolioContentInput;
    },
  ) {
    const subdomain = normalizeSubdomain(
      input.subdomain,
      await ownedSubdomains(userId, input.documentId),
    );

    // `content` too: the images the body being replaced referenced are released after the save.
    const existing = input.documentId
      ? await prisma.document.findFirst({
          where: { id: input.documentId, userId, type: "PORTFOLIO", deletedAt: null },
          select: { id: true, revision: true, content: true },
        })
      : await prisma.document.findFirst({
          where: { userId, type: "PORTFOLIO", deletedAt: null },
          orderBy: { updatedAt: "desc" },
          select: { id: true, revision: true, content: true },
        });

    if (input.documentId && !existing) throw new ApiError(404, "Portfolio draft not found.");

    if (existing && input.revision !== existing.revision)
      throw new ApiError(409, "Portfolio draft changed in another session.", {
        revision: existing.revision,
      });

    try {
      const document = existing
        ? await prisma.document.update({
            where: { id: existing.id },
            data: {
              content: input.snapshot as Prisma.InputJsonValue,
              templateId: input.snapshot.templateId,
              slug: subdomain,
              revision: { increment: 1 },
              lastSyncedAt: new Date(),
            },
            select: {
              id: true,
              slug: true,
              templateId: true,
              content: true,
              revision: true,
              updatedAt: true,
            },
          })
        : await prisma.document.create({
            data: {
              userId,
              type: "PORTFOLIO",
              title: "Portfolio",
              slug: subdomain,
              content: input.snapshot as Prisma.InputJsonValue,
              templateId: input.snapshot.templateId,
              visibility: "PRIVATE",
              lastSyncedAt: new Date(),
            },
            select: {
              id: true,
              slug: true,
              templateId: true,
              content: true,
              revision: true,
              updatedAt: true,
            },
          });

      await Promise.all([
        bumpGeneration(...documentCacheNamespaces(userId, document.id)),
        cacheDel(userProfileCacheKey(userId)),
      ]);

      // A replaced avatar or cover is deleted once nothing references it (V-045).
      if (existing)
        await PortfolioAssetService.releaseReplacedAssets(
          userId,
          referencedAssetIds(existing.content),
        );

      return document;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ApiError(
          409,
          "That portfolio subdomain conflicts with an existing document slug.",
        );

      throw error;
    }
  }

  static async publish(
    userId: string,
    input: { documentId: string; subdomain: string; revision: number },
  ) {
    const hasSubscription = await EntitlementService.has(userId, PORTFOLIO_PUBLISH);

    const document = await prisma.document.findFirst({
      where: { id: input.documentId, userId, type: "PORTFOLIO", deletedAt: null },
    });

    if (!document) throw new ApiError(404, "Portfolio draft not found.");

    if (isPremiumPortfolioTemplate(document.templateId) && !hasSubscription) {
      throw new ApiError(
        402,
        `Publishing the premium template "${document.templateId}" requires an active Creator Pro subscription.`,
      );
    }

    if (document.revision !== input.revision) {
      throw new ApiError(409, "Save the latest draft before publishing.");
    }

    const existingPublication = await prisma.portfolioPublication.findUnique({
      where: { userId },
      select: {
        documentId: true,
        subdomain: true,
        status: true,
        suspensionReason: true,
        // The images the snapshot being replaced shows are released after the publish.
        snapshot: true,
      },
    });

    const subdomain = normalizeSubdomain(
      input.subdomain,
      [existingPublication?.subdomain, document.slug].filter((name): name is string =>
        Boolean(name),
      ),
    );

    const publishable = portfolioContentSchema.safeParse(document.content);

    if (!publishable.success) {
      // The standard `[{ path, message }]` details (V-135), not zod's `flatten()` shape.
      throw new ApiError(
        400,
        "Complete the required portfolio details before publishing.",
        handleValidationError(publishable.error).details,
      );
    }

    // Every image the body shows, extra pages included (the same walk the asset cleanup uses).
    const assetIds = [...referencedAssetIds(publishable.data)];
    if (assetIds.length) {
      const ownedAssets = await prisma.portfolioAsset.count({
        where: { id: { in: assetIds }, userId, status: "READY" },
      });
      if (ownedAssets !== assetIds.length)
        throw new ApiError(400, "Portfolio contains an unavailable or invalid image.");
    }

    // See resolveWatermarkFlag and resolveSeo: the posted values are requests, not facts.
    const [canRemoveWatermark, canControlSeo] = await Promise.all([
      EntitlementService.has(userId, WATERMARK_REMOVAL),
      EntitlementService.has(userId, SEO_CONTROLS),
    ]);

    const snapshot: PortfolioContentInput = {
      ...publishable.data,
      removeWatermark: resolveWatermarkFlag(publishable.data.removeWatermark, canRemoveWatermark),
      seo: resolveSeo(publishable.data.seo, canControlSeo),
    };

    if (existingPublication && isModerationLocked(existingPublication))
      throw new ApiError(403, "This portfolio was taken down by a moderator.");

    try {
      const publication = await prisma.$transaction(async (tx) => {
        if (existingPublication && existingPublication.documentId !== document.id) {
          await tx.document.update({
            where: { id: existingPublication.documentId },
            data: { visibility: "PRIVATE" },
          });
        }

        await tx.document.update({
          where: { id: document.id },
          data: { visibility: "PUBLIC" },
        });

        return tx.portfolioPublication.upsert({
          where: { userId },
          create: {
            userId,
            documentId: document.id,
            subdomain,
            templateId: document.templateId,
            snapshot: snapshot as Prisma.InputJsonValue,
            publishedRevision: document.revision,
          },
          update: {
            documentId: document.id,
            subdomain,
            templateId: document.templateId,
            snapshot: snapshot as Prisma.InputJsonValue,
            publishedRevision: document.revision,
            status: "LIVE",
            suspensionReason: null,
            suspendedAt: null,
            publishedAt: new Date(),
          },
        });
      });

      const subdomains = [subdomain, existingPublication?.subdomain ?? ""];

      await Promise.all([
        invalidatePublicPortfolioCaches(subdomains),
        bumpGeneration(
          ...documentCacheNamespaces(userId, document.id),
          ...(existingPublication && existingPublication.documentId !== document.id
            ? [cacheNamespaces.document(userId, existingPublication.documentId)]
            : []),
        ),
      ]);

      void revalidatePublicPortfolios(subdomains);

      // Images only the replaced snapshot showed are deleted now (V-045).
      if (existingPublication)
        await PortfolioAssetService.releaseReplacedAssets(
          userId,
          referencedAssetIds(existingPublication.snapshot),
        );

      const publicUrl =
        config.nodeEnv === "development"
          ? `http://${publication.subdomain}.localhost:3004`
          : `https://${publication.subdomain}.veriworkly.com`;

      if (existingPublication?.status !== "LIVE") {
        void this.notifyPortfolioLive(userId, publicUrl);
      }

      return { ...publication, publicUrl };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ApiError(409, "That portfolio subdomain is already in use.");

      throw error;
    }
  }

  private static async notifyPortfolioLive(userId: string, publicUrl: string) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user?.email) return;

      await sendPortfolioUpdatedEmail(user.email, publicUrl);
    } catch (error) {
      logger.warn("Failed to send portfolio live email", error);
    }
  }

  static async unpublish(userId: string) {
    const publication = await prisma.portfolioPublication.findUnique({ where: { userId } });

    if (!publication) throw new ApiError(404, "Portfolio is not published.");

    const result = await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: publication.documentId },
        data: { visibility: "PRIVATE" },
      });

      // A moderated row keeps its moderation reason: rewriting it as the user's own takedown
      // would let the next Publish lift the lock.
      if (isModerationLocked(publication)) return publication;

      return tx.portfolioPublication.update({
        where: { userId },
        data: {
          status: "SUSPENDED",
          suspensionReason: USER_UNPUBLISHED_REASON,
          suspendedAt: new Date(),
        },
      });
    });

    await Promise.all([
      invalidatePublicPortfolioCaches([publication.subdomain]),
      bumpGeneration(...documentCacheNamespaces(userId, publication.documentId)),
    ]);

    void revalidatePublicPortfolios([publication.subdomain]);

    return result;
  }

  static async recordView(subdomain: string, referrer?: string, ipAddress?: string) {
    const publication = await this.getPublicPortfolio(subdomain);

    if (!publication) throw new ApiError(404, "Portfolio not found");

    await this.bufferView(publication.id, normalizeReferrerHost(referrer), ipAddress);
  }

  /**
   * Buffers one view for today in a single script (V-114): the dedup check, the field-cap check
   * (past the cap a new referrer folds into the publication's direct field) and both counters.
   * Returns false for a repeat view inside the dedup window.
   */
  static async bufferView(publicationId: string, referrerHost: string, ipAddress?: string) {
    const dateKey = utcDay().toISOString().slice(0, 10);
    const dedupKey = ipAddress
      ? `portfolio:views:dedup:${publicationId}:${hashForAnalytics(ipAddress)}`
      : "";

    const recorded = await getRedis().eval(BUFFER_PORTFOLIO_VIEW_SCRIPT, {
      keys: [
        `portfolio:views:buffer:${dateKey}`,
        `portfolio:views:pending:${publicationId}`,
        dedupKey,
      ],
      arguments: [
        `${publicationId}:${referrerHost}`,
        `${publicationId}:`,
        String(MAX_VIEW_BUFFER_FIELDS),
        dateKey,
        String(VIEW_BUFFER_TTL_SECONDS),
        String(VIEW_DEDUP_WINDOW_SECONDS),
      ],
    });

    return Number(recorded) === 1;
  }

  static async getPendingViewDates() {
    const redis = getRedis();
    const dates = new Set<string>();

    for await (const keys of redis.scanIterator({
      MATCH: "portfolio:views:buffer:*",
      COUNT: 100,
    })) {
      const keyList = Array.isArray(keys) ? keys : [keys];

      for (const key of keyList) {
        const match = /^portfolio:views:buffer:(\d{4}-\d{2}-\d{2})(?::processing)?$/.exec(key);

        if (match) dates.add(match[1]);
      }
    }

    return [...dates].sort();
  }

  static async flushViewsForDate(dateKey: string) {
    const redis = getRedis();
    const key = `portfolio:views:buffer:${dateKey}`;
    const processingKey = `${key}:processing`;
    const batchKey = `${processingKey}:batch-id`;
    const pendingAdjustedKey = `${processingKey}:pending-adjusted`;
    const lockKey = `${key}:flush-lock`;

    // Serialize flush attempts for this date so a manual admin retry overlapping the cron tick
    // (or a rolling deploy briefly running two worker processes) can't race the same batch id and
    // permanently discard that day's buffered views on a unique-constraint rollback. A token
    // lock, renewed while the flush runs and released by compare-and-delete (V-127).
    const lock = await acquireJobLock(lockKey, { ttlMs: VIEW_FLUSH_LOCK_SECONDS * 1000 });

    if (!lock) return { dateKey, flushedCount: 0, skipped: true as const };

    try {
      if (!(await redis.exists(processingKey))) {
        try {
          await redis.rename(key, processingKey);
        } catch (error) {
          if (error instanceof Error && error.message.includes("no such key"))
            return { dateKey, flushedCount: 0 };

          throw error;
        }
      }

      const data = await redis.hGetAll(processingKey);
      const entries = Object.entries(data);

      if (entries.length === 0) {
        await redis.del([processingKey, batchKey, pendingAdjustedKey]);
        return { dateKey, flushedCount: 0 };
      }

      // No TTL on purpose: under volatile-lru a batch id with a TTL could be evicted mid-retry and
      // the retry would commit the same views again under a new id. It is deleted with the batch.
      await redis.set(batchKey, randomUUID(), { NX: true });
      const batchId = await redis.get(batchKey);

      if (!batchId) throw new Error(`Failed to initialize portfolio views batch for ${dateKey}`);

      const publicationIds = [
        ...new Set(entries.map(([field]) => field.slice(0, field.indexOf(":"))).filter(Boolean)),
      ];
      const survivingPublications = new Set(
        (
          await prisma.portfolioPublication.findMany({
            where: { id: { in: publicationIds } },
            select: { id: true },
          })
        ).map((publication) => publication.id),
      );
      // Computed outside the transaction (V-124), so the P2002 recovery below has them too.
      let flushedCount = 0;
      const pendingAdjustments = new Map<string, number>();
      const rows = new Map<
        string,
        { publicationId: string; referrerHost: string; count: number }
      >();

      for (const [field, rawCount] of entries) {
        const separator = field.indexOf(":");
        const publicationId = field.slice(0, separator);
        const referrerHost = field.slice(separator + 1);
        if (!publicationId || !survivingPublications.has(publicationId)) continue;
        const count = parseInt(rawCount, 10) || 0;
        if (count <= 0) continue;
        const pendingKey = `portfolio:views:pending:${publicationId}`;
        pendingAdjustments.set(pendingKey, (pendingAdjustments.get(pendingKey) ?? 0) + count);
        const rowKey = `${publicationId}:${referrerHost}`;
        const row = rows.get(rowKey) ?? { publicationId, referrerHost, count: 0 };
        row.count += count;
        rows.set(rowKey, row);
        flushedCount += count;
      }

      const values = [...rows.values()];

      try {
        // V-103: one statement for the whole day instead of one upsert per field inside a 5 s
        // interactive transaction. The batch row and the counts still commit together.
        await prisma.$transaction([
          prisma.viewFlushBatch.create({ data: { id: batchId, kind: "portfolio" } }),
          prisma.$executeRaw`
            INSERT INTO "PortfolioViewDaily"
              ("id", "publicationId", "date", "referrerHost", "count", "createdAt", "updatedAt")
            SELECT gen_random_uuid()::text, v."publicationId", ${dateKey}::date::timestamp,
                   v."referrerHost", v."count", now(), now()
            FROM unnest(
              ${values.map((row) => row.publicationId)}::text[],
              ${values.map((row) => row.referrerHost)}::text[],
              ${values.map((row) => row.count)}::int[]
            ) AS v("publicationId", "referrerHost", "count")
            ON CONFLICT ("publicationId", "date", "referrerHost")
            DO UPDATE SET "count" = "PortfolioViewDaily"."count" + EXCLUDED."count",
                          "updatedAt" = now()
          `,
        ]);
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
          throw error;
        }

        // We hold the flush lock, so a batch-id collision can only mean a prior attempt already
        // committed this exact batch before crashing without cleaning up Redis. Confirm that
        // rather than assuming it.
        const existingBatch = await prisma.viewFlushBatch.findUnique({ where: { id: batchId } });
        if (!existingBatch) throw error;
      }

      const staleCount = publicationIds.length - survivingPublications.size;
      if (staleCount > 0)
        logger.warn("Discarded portfolio views for deleted publications", { staleCount });

      // Committed. A runner that took the lock over meanwhile may be reading `:processing`;
      // deleting it and the batch id under them would let them commit these views again under
      // a fresh id. They finish the cleanup (their retry hits the batch row and confirms it).
      if (!(await lock.stillOwner())) {
        logger.warn(
          "Views flush lost its lock after committing; leaving Redis cleanup to the holder",
          {
            dateKey,
          },
        );
        return { dateKey, flushedCount };
      }

      if (!(await redis.exists(pendingAdjustedKey))) {
        const adjustment = redis.multi();
        for (const [pendingKey, count] of pendingAdjustments) {
          adjustment.hIncrBy(pendingKey, dateKey, -count);
        }
        adjustment.set(pendingAdjustedKey, "1");
        await adjustment.exec();
      }

      await redis.del([processingKey, batchKey, pendingAdjustedKey]);
      return { dateKey, flushedCount };
    } finally {
      await lock.release();
    }
  }

  static async getAnalytics(userId: string) {
    // Visitor analytics is a Creator Pro feature. This is the enforcement point — the
    // dashboard's lock overlay is presentation only, so without this check the numbers
    // were still serialized into the page (and readable straight off the endpoint) for
    // every free account. Gated on the `analytics` grant itself (V-142), which every
    // portfolio plan carries alongside `portfolio_publish`.
    if (!(await EntitlementService.has(userId, ANALYTICS)))
      return { locked: true, totalViews: 0, daily: [], referrers: [] };

    const publication = await prisma.portfolioPublication.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!publication) return { locked: false, totalViews: 0, daily: [], referrers: [] };

    const [totals, daily, referrers] = await Promise.all([
      prisma.portfolioViewDaily.aggregate({
        where: { publicationId: publication.id },
        _sum: { count: true },
      }),

      prisma.portfolioViewDaily.groupBy({
        by: ["date"],
        where: { publicationId: publication.id },
        _sum: { count: true },
        orderBy: { date: "desc" },
        take: 30,
      }),
      prisma.portfolioViewDaily.groupBy({
        by: ["referrerHost"],
        where: { publicationId: publication.id, referrerHost: { not: "" } },
        _sum: { count: true },
        orderBy: { _sum: { count: "desc" } },
        take: 10,
      }),
    ]);

    let totalViews = totals._sum.count ?? 0;
    const dailyMap = new Map<string, number>();

    daily.forEach((item) => {
      const dateStr = item.date.toISOString().slice(0, 10);
      dailyMap.set(dateStr, item._sum.count ?? 0);
    });

    try {
      const pending = await getRedis().hGetAll(`portfolio:views:pending:${publication.id}`);

      for (const [dateStr, rawCount] of Object.entries(pending)) {
        const count = Math.max(0, parseInt(rawCount, 10) || 0);
        totalViews += count;
        dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + count);
      }
    } catch (err) {
      logger.error("Failed to read buffered portfolio views from Redis", err);
    }

    const sortedDaily = Array.from(dailyMap.entries())
      .map(([dateStr, count]) => ({
        date: new Date(`${dateStr}T00:00:00.000Z`),
        count,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 30);

    return {
      locked: false,
      totalViews,
      daily: sortedDaily,
      referrers: referrers.map((item) => ({
        host: item.referrerHost,
        count: item._sum.count ?? 0,
      })),
    };
  }
}

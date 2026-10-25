import { Prisma } from "@prisma/client";

import { prisma } from "#lib/prisma";
import { ApiError } from "#lib/errors";

import { cacheGet, cacheSet, cacheDel, cacheDelByPrefix } from "#lib/redis";
import { documentListCachePrefix, userProfileCacheKey } from "#lib/cacheKeys";
import { logger } from "#lib/logger";
import { usernameInvalidReason } from "#utils/slugs";
import { revokeAllSessionsForUserSafely } from "#auth/sessions";
import {
  invalidatePublicPortfolioCaches,
  revalidatePublicPortfolios,
} from "#utils/portfolioPublicationCache";
import { invalidateAffiliate } from "#services/affiliate/cache";
import { ApiKeyService } from "#services/apiKeyService";
import { CreditService } from "#services/creditService";
import { PortfolioAssetService } from "#services/portfolioAssetService";
import { sendAccountDeletedEmail } from "#services/mail/index";

const userProfileSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  emailVerified: true,
  autoSyncEnabled: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      apiKeys: true,
      shareLinks: true,
      resumes: true,
    },
  },
} satisfies Prisma.UserSelect;

/**
 * Everything a user deletion removes inside ONE transaction. Shared by the self-service path
 * and the admin path so neither can drift from the other again.
 *
 * `creditUsageAllocation` goes first: `CreditUsageAllocation.grant` is `onDelete: Restrict`,
 * so an allocation still present when the cascade reaches the user's CreditGrant rows aborts
 * the whole delete. Today the cascade happens to reach CreditTransaction (which removes the
 * allocations) before CreditGrant, but only because that constraint was created a migration
 * earlier and Postgres fires the cascade triggers in creation order. That is nothing to build on.
 */
export async function deleteUserCascade(tx: Prisma.TransactionClient, userId: string) {
  await tx.creditUsageAllocation.deleteMany({
    where: { OR: [{ transaction: { userId } }, { grant: { userId } }] },
  });

  // Cascades to Document, MasterProfile, ShareLink, PortfolioPublication, CreditWallet,
  // ApiKey, Session, and the affiliate/ambassador records.
  await tx.user.delete({ where: { id: userId } });
}

export type DeletedUserCacheTargets = {
  userId: string;
  username: string | null;
  documentIds: string[];
  /** Share-link slugs and document slugs: `share:public-readable` is cached under both. */
  publicSlugs: string[];
  subdomain: string | null;
};

/**
 * Read before the delete: once the rows are gone there is no way to name the exact keys
 * (`share:public-readable:{username}:{slug}` in particular keeps serving a deleted user's
 * snapshot for up to an hour otherwise).
 */
export async function readDeletedUserCacheTargets(
  userId: string,
): Promise<DeletedUserCacheTargets | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      resumes: { select: { id: true, slug: true } },
      shareLinks: { select: { slug: true } },
      portfolioPublication: { select: { subdomain: true } },
    },
  });

  if (!user) return null;

  return {
    userId,
    username: user.username,
    documentIds: user.resumes.map((document) => document.id),
    publicSlugs: [
      ...new Set([
        ...user.shareLinks.map((share) => share.slug),
        ...user.resumes.map((document) => document.slug),
      ]),
    ],
    subdomain: user.portfolioPublication?.subdomain ?? null,
  };
}

/**
 * Every per-user cache entry the server writes, dropped after the rows are gone. Best effort:
 * the account is already deleted, so nothing here may throw back to the caller.
 */
export async function purgeDeletedUserCaches(targets: DeletedUserCacheTargets): Promise<void> {
  const { userId, username } = targets;

  await Promise.allSettled([
    cacheDel(userProfileCacheKey(userId)),
    cacheDel(`profile:${userId}`),
    ...targets.documentIds.map((documentId) => cacheDel(`document:${userId}:${documentId}`)),
    ...(username
      ? targets.publicSlugs.map((slug) => cacheDel(`share:public-readable:${username}:${slug}`))
      : []),
    // credits:summary, credits:history and billing:summary.
    CreditService.invalidate(userId),
    cacheDel(`billing:history:${userId}`),
    invalidateAffiliate(userId),
    ...(targets.subdomain ? [invalidatePublicPortfolioCaches([targets.subdomain])] : []),
    // These three lists are keyed by pagination/filter variants, so there is no fixed set of
    // names to delete; a prefix SCAN is the only option. cacheDelByPrefix walks the whole
    // keyspace (Phase 3 replaces it) — keep these the only prefix deletes on this path.
    cacheDelByPrefix(documentListCachePrefix(userId)),
    cacheDelByPrefix(`share:list:${userId}:`),
    cacheDelByPrefix(`share:shared-document-ids:${userId}:`),
  ]);
}

export class UserService {
  static async requireUsernameForUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (!user) throw new ApiError(404, "User not found");
    if (!user.username) throw new ApiError(400, "Username required before sharing");

    return user.username;
  }

  /**
   * Get a user by ID with related counts.
   * Results are cached for 30 minutes.
   * @param userId User ID
   */

  static async getUserById(userId: string) {
    const cacheKey = userProfileCacheKey(userId);
    const cached = await cacheGet(cacheKey);

    if (cached) return cached;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userProfileSelect,
    });

    if (!user) throw new ApiError(404, "User not found");

    await cacheSet(cacheKey, user, 1800);

    return user;
  }

  /**
   * Update a user's name.
   * Invalidates cache upon success.
   * @param userId User ID
   * @param name New name
   */

  static async updateUserName(userId: string, name: string) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: userProfileSelect,
    });

    await cacheSet(userProfileCacheKey(userId), updated, 1800);

    return updated;
  }

  static async getUsernameAvailability(username: string) {
    const reason = usernameInvalidReason(username);

    if (reason) {
      return { available: false, normalizedUsername: username, reason };
    }

    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    const available = !existing;

    return {
      available,
      normalizedUsername: username,
      reason: available ? undefined : "taken",
    };
  }

  static async updateUsername(userId: string, username: string) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!current) throw new ApiError(404, "User not found");
    if (current.username === username) return this.getUserById(userId);
    if (current.username) throw new ApiError(409, "Username is locked and cannot be changed");

    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { username },
        select: userProfileSelect,
      });

      await cacheSet(userProfileCacheKey(userId), updated, 1800);
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiError(409, "Username is already taken");
      }

      throw error;
    }
  }

  static async updateAutoSync(userId: string, enabled: boolean) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { autoSyncEnabled: enabled },
      select: userProfileSelect,
    });

    await cacheSet(userProfileCacheKey(userId), updated, 1800);
    return updated;
  }

  /**
   * Permanently delete a user account and all associated data across all tables and R2 storage.
   * Satisfies GDPR / DPDP "Right to Erasure".
   * @param userId User ID to delete
   */
  static async deleteUserAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Captured before the delete so the exact cache keys can be purged afterwards. Once the
    // rows are gone the username, slugs and subdomain are unrecoverable, and a cached share
    // snapshot or published portfolio would keep serving a deleted user's page.
    const cacheTargets = await readDeletedUserCacheTargets(userId);

    /**
     * Refuse to delete while billing is live at the provider.
     *
     * We have no way to cancel a Dodo subscription from here — there is no
     * subscription-cancel call anywhere in this codebase, because cancellation happens
     * in Dodo's own customer portal. Deleting the account would therefore drop our
     * Subscription row while the card keeps being charged, and the renewal webhook
     * would arrive for a user that no longer exists, so it could not even be
     * reconciled. The user would be paying for nothing, with no record on our side
     * showing why.
     *
     * Blocking here and telling them to cancel first is the only honest option.
     */
    const liveSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["ACTIVE", "PAST_DUE"] },
        cancelAtPeriodEnd: false,
      },
      select: { id: true },
    });

    if (liveSubscription) {
      throw new ApiError(
        409,
        "Cancel your subscription before deleting your account. Open Billing and use Manage Subscription — we cannot cancel it for you, and deleting now would leave you being charged for an account that no longer exists.",
      );
    }

    /**
     * Refuse to delete while a withdrawal is open. The cascade would remove a REQUESTED or
     * APPROVED `AffiliateWithdrawal` the admin is about to pay (or has already sent money for),
     * leaving no record of the payout on our side.
     */
    const openWithdrawal = await prisma.affiliateWithdrawal.findFirst({
      where: { userId, status: { in: ["REQUESTED", "APPROVED"] } },
      select: { id: true },
    });

    if (openWithdrawal) {
      throw new ApiError(
        409,
        "You have a withdrawal in progress. Wait for it to be paid or rejected before deleting your account.",
      );
    }

    // The API-key auth cache (`apikey:auth:{hash}`, TTL 300 s) can only be found through the
    // ApiKey rows, so it has to be purged while they still exist; afterwards a deleted
    // account's keys would keep authenticating for five minutes. A plain DEL is not enough: a
    // validation that read the row just before the cascade can re-cache it, so each key gets
    // the revoked marker first (V-122).
    await ApiKeyService.markAllRevokedForUser(userId);

    // better-auth's `findSession` reads its Redis entry before Postgres, so the cascade below
    // deleting the Session rows signs nobody out on its own. Revoke first, while the tokens
    // can still be read; this also clears the `active-sessions-{userId}` index and this app's
    // `auth:session:*` cache. If the transaction then fails the user is signed out but still
    // exists, which is the safer side to err on.
    await revokeAllSessionsForUserSafely(userId);

    /**
     * Order matters here, and it is the reverse of the obvious one.
     *
     * The database delete runs FIRST. R2 objects are unrecoverable, so deleting them
     * before the transaction means a failed transaction leaves the user with an intact
     * account whose images have silently vanished. Deleting the rows first means the
     * worst case is orphaned R2 objects — waste, not data loss for someone who still
     * has an account.
     */
    await prisma.$transaction((tx) => deleteUserCascade(tx, userId));

    // Best-effort cleanup from here on. The account is already gone, so none of this
    // may throw back to the caller — a failed cache purge or a failed R2 delete must
    // not turn a successful deletion into a 500 the user reads as "it didn't work".
    const subdomain = cacheTargets?.subdomain ?? null;

    await Promise.allSettled([
      PortfolioAssetService.deleteAllUserAssets(userId),
      ...(cacheTargets ? [purgeDeletedUserCaches(cacheTargets)] : []),
    ]);

    if (subdomain) void revalidatePublicPortfolios([subdomain]);

    void sendAccountDeletedEmail(user.email, user.name || "").catch((error) => {
      logger.warn("Failed to send account deletion confirmation email", { error });
    });

    return { success: true };
  }
}

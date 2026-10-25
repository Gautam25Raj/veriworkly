import { Prisma } from "@prisma/client";

import { config } from "#config";
import { prisma } from "#lib/prisma";
import { ApiError } from "#lib/errors";
import { getRedis } from "#lib/redis";
import { acquireJobLock } from "#lib/jobLock";
import { recordJobSuccess } from "#lib/metrics";
import { logger } from "#lib/logger";

import {
  fetchAllGitHubReleases,
  parseReleaseBody,
  samePullRequests,
  unionPullRequests,
  listedPullRequests,
  reparseStoredRelease,
  fetchMergedPullRequests,
  assignPullRequestsToReleases,
  type ReleasePrRef,
  type GitHubReleasePayload,
} from "#services/github/index";
import { slugifyVersion, parseReleaseTag, deriveReleaseType } from "#utils/changelogVersion";

import { CHANGELOG_CACHE_KEYS, invalidateChangelogReadCaches } from "./cache.js";
import { refreshContributorStats } from "./contributors.js";

/**
 * Whether a startup sync is worth running. Cron runs deliberately bypass this — the schedule is
 * the intent there — so only the boot path pays the freshness check.
 */
export async function shouldSyncChangelogReleases(): Promise<boolean> {
  try {
    const marker = await getRedis().get(CHANGELOG_CACHE_KEYS.SYNC_MARKER);
    return marker === null;
  } catch (error) {
    logger.warn("Changelog release sync freshness check failed; syncing anyway", error);
    return true;
  }
}

const reportedCollisions = new Set<string>();

/** A skipped tag is said at warn once per process; every later sync repeats it at debug. */
function reportCollision(key: string, message: string) {
  if (reportedCollisions.has(key)) {
    logger.debug(message);
    return;
  }

  reportedCollisions.add(key);
  logger.warn(message);
}

/**
 * Whether a P2002 came from ChangelogEntry's id or version unique. The classic engine names the
 * columns in `meta.target`; the pg driver adapter usually names only the constraint.
 */
function isIdOrVersionConflict(error: Prisma.PrismaClientKnownRequestError): boolean {
  const meta = error.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { fields?: unknown; index?: unknown } } };
      }
    | undefined;
  const constraint = meta?.driverAdapterError?.cause?.constraint;
  const fields = Array.isArray(meta?.target) ? meta.target : constraint?.fields;

  if (Array.isArray(fields)) return fields.some((field) => field === "id" || field === "version");

  const name = typeof meta?.target === "string" ? meta.target : constraint?.index;
  return name === "ChangelogEntry_pkey" || name === "ChangelogEntry_version_key";
}

function deriveTitle(release: GitHubReleasePayload, version: string): string {
  if (!release.name) return `Release v${version}`;

  return release.name.replace(/^v?[\d.]+(?:-[\w.]+)?\s*[–-]\s*/i, "").trim() || release.name;
}

/**
 * Syncs GitHub releases into the changelog. New releases get a row. Every stored release has its
 * pull request list completed from GitHub, adding PRs and authors but never removing any. A
 * synced row no admin has edited is also parsed again, once, so parser fixes reach old entries;
 * hand-curated and admin-edited text is never modified. Safe to re-run.
 */
export async function syncChangelogFromGitHubReleases(): Promise<{
  created: number;
  refreshed: number;
  skipped: number;
  total: number;
}> {
  const { owner, repo, token } = config.github;

  if (!owner || !repo || !token) {
    logger.warn(
      "Changelog release sync skipped: GITHUB_OWNER/GITHUB_REPO/GITHUB_TOKEN not configured.",
    );
    return { created: 0, refreshed: 0, skipped: 0, total: 0 };
  }

  const redis = getRedis();
  // Renewed while the sync runs (V-127): 20 PR pages plus the releases can outlast a fixed TTL.
  const lock = await acquireJobLock(CHANGELOG_CACHE_KEYS.RELEASE_SYNC_LOCK, { ttlMs: 600_000 });

  if (!lock) {
    throw new ApiError(409, "Changelog release sync is already in progress");
  }

  // Checked after each fetch and before each write: a sync that lost its lock stops instead of
  // writing beside the runner that now holds it.
  const ensureStillOwner = async () => {
    if (!(await lock.stillOwner()))
      throw new ApiError(
        409,
        "Changelog release sync stopped: its lock was taken by another runner",
      );
  };

  try {
    const fetched = await fetchAllGitHubReleases(owner, repo, token);
    await ensureStillOwner();

    // Two tags can slugify to one id (3.0.0-1 and 3.0.0.1 are both v3-0-0-1). The first, oldest,
    // keeps the id; the later one is skipped and named, rather than its create hitting P2002 and
    // failing the whole sync on every run (V-158).
    const tagById = new Map<string, string>();
    const releases = fetched.filter((release) => {
      const id = slugifyVersion(parseReleaseTag(release.tag_name));
      const firstTag = tagById.get(id);

      if (firstTag !== undefined) {
        reportCollision(
          `${firstTag}\u0000${release.tag_name}`,
          `Changelog release sync: tag ${release.tag_name} skipped, its id ${id} is already used by tag ${firstTag}`,
        );
        return false;
      }

      tagById.set(id, release.tag_name);
      return true;
    });
    const duplicates = fetched.length - releases.length;

    const releaseIds = releases.map((release) => slugifyVersion(parseReleaseTag(release.tag_name)));
    const storedRows = await prisma.changelogEntry.findMany({
      where: { id: { in: releaseIds } },
      select: {
        id: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        summary: true,
        added: true,
        improved: true,
        fixed: true,
        breaking: true,
        security: true,
        prRefs: true,
      },
    });
    const storedById = new Map(storedRows.map((row) => [row.id, row]));
    const repoUrl = `https://github.com/${owner}/${repo}`;

    const parsedBodies = releases.map((release) => parseReleaseBody(release.body));

    // Most release notes name no PRs, so the PR list comes from what merged between releases.
    // A failed fetch only means this sync adds no PRs; the notes themselves still sync.
    const pulls = await fetchMergedPullRequests(owner, repo, token).catch((error) => {
      logger.error("Changelog release sync: could not list merged pull requests", error);
      return [];
    });
    const assigned = assignPullRequestsToReleases(
      releases.map((release, index) => ({
        id: releaseIds[index],
        publishedAt: release.published_at ?? new Date().toISOString(),
        listed: parsedBodies[index].pullRequests.map((pr) => pr.number),
      })),
      pulls,
    );

    let created = 0;
    let refreshed = 0;
    let skipped = duplicates;

    for (let index = 0; index < releases.length; index++) {
      await ensureStillOwner();

      const release = releases[index];
      const version = parseReleaseTag(release.tag_name);
      const id = releaseIds[index];
      const parsedBody = parsedBodies[index];
      const shippedPrs = unionPullRequests(
        assigned.get(id) ?? [],
        listedPullRequests(parsedBody.pullRequests, repoUrl),
      );

      const stored = storedById.get(id);

      if (stored) {
        const storedPrs = Array.isArray(stored.prRefs)
          ? (stored.prRefs as unknown as ReleasePrRef[])
          : [];

        // A synced entry an admin never touched still holds whatever the parser produced when it
        // was created, so its text is parsed again. updatedAt only moves on an update, which makes
        // this a one-time repair that never overwrites an admin's edit.
        const untouched = stored.updatedAt.getTime() - stored.createdAt.getTime() < 1000;
        const text =
          stored.tags.includes("auto-synced") && untouched
            ? reparseStoredRelease(release.body, { ...stored, prRefs: storedPrs }, repoUrl)
            : null;

        const prRefs = unionPullRequests(text?.prRefs ?? storedPrs, shippedPrs);
        const prsChanged = !samePullRequests(prRefs, storedPrs);

        if (text || prsChanged) {
          await prisma.changelogEntry.update({
            where: { id },
            data: {
              ...text,
              prRefs: (prRefs.length > 0
                ? prRefs
                : Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
            },
          });
          refreshed++;
        } else skipped++;

        continue;
      }

      const previousRelease = releases[index - 1];
      const type = deriveReleaseType(
        previousRelease ? parseReleaseTag(previousRelease.tag_name) : undefined,
        version,
      );

      const createdRow = await prisma.changelogEntry
        .create({
          data: {
            id,
            version,
            title: deriveTitle(release, version),
            summary: parsedBody.summary,
            type,
            publishedAt: release.published_at ? new Date(release.published_at) : new Date(),
            githubUrl: release.html_url,
            added: parsedBody.added,
            improved: parsedBody.improved,
            fixed: parsedBody.fixed,
            breaking: parsedBody.breaking,
            security: parsedBody.security,
            tags: ["auto-synced"],
            prRefs: (shippedPrs.length > 0
              ? shippedPrs
              : Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
          },
        })
        .catch((error: unknown) => {
          // A hand-made entry can already hold this version under another id.
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002" &&
            isIdOrVersionConflict(error)
          ) {
            reportCollision(
              `${release.tag_name}\u0000stored`,
              `Changelog release sync: tag ${release.tag_name} skipped, version ${version} or id ${id} already exists`,
            );
            return null;
          }
          throw error;
        });

      if (!createdRow) {
        skipped++;
        continue;
      }

      created++;
      logger.info(`Changelog release sync: created entry for ${id} (v${version})`);
    }

    const contributorsStored = await refreshContributorStats();

    if (created > 0 || refreshed > 0 || contributorsStored) {
      await invalidateChangelogReadCaches();
    }

    await redis
      .set(CHANGELOG_CACHE_KEYS.SYNC_MARKER, new Date().toISOString(), {
        EX: Math.max(60, config.changelogSync.minIntervalSeconds),
      })
      .catch((err) => logger.error("Failed to record changelog sync freshness marker", err));

    logger.info(
      `Changelog release sync complete: ${created} created, ${refreshed} re-parsed, ${skipped} already present`,
    );

    recordJobSuccess("changelog-sync");

    return { created, refreshed, skipped, total: fetched.length };
  } finally {
    await lock.release();
  }
}

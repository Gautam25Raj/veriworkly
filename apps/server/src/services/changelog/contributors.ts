import { config } from "#config";
import { logger } from "#lib/logger";
import { prisma } from "#lib/prisma";
import { cacheGet, cacheSet } from "#lib/redis";
import { fetchGitHubContributors, type GitHubContributorItem } from "#services/github/index";
import type { ChangelogContributor } from "./types.js";

type ContributorStats = { contributorCount: number; topContributors: ChangelogContributor[] };

/** Written by the release sync, read by /changelog/stats; the request path never calls GitHub. */
const CONTRIBUTORS_CACHE_KEY = "changelog:contributors";

const MAX_TOP_CONTRIBUTORS = 30;

// Known repository core contributors as base fallback
const KNOWN_CORE_CONTRIBUTORS: ChangelogContributor[] = [
  {
    login: "Gautam25Raj",
    avatarUrl: "https://avatars.githubusercontent.com/u/63155224?v=4",
    htmlUrl: "https://github.com/Gautam25Raj",
  },
  {
    login: "Atharv-Shandilya",
    avatarUrl: "https://avatars.githubusercontent.com/u/135959630?v=4",
    htmlUrl: "https://github.com/Atharv-Shandilya",
  },
  {
    login: "aaditya-rathore",
    avatarUrl: "https://avatars.githubusercontent.com/u/123990694?v=4",
    htmlUrl: "https://github.com/aaditya-rathore",
  },
  {
    login: "HirenGajjar",
    avatarUrl: "https://avatars.githubusercontent.com/u/40492198?v=4",
    htmlUrl: "https://github.com/HirenGajjar",
  },
  {
    login: "Akshay7057017063",
    avatarUrl: "https://avatars.githubusercontent.com/u/114216378?v=4",
    htmlUrl: "https://github.com/Akshay7057017063",
  },
  {
    login: "subhan-f",
    avatarUrl: "https://avatars.githubusercontent.com/u/67074140?v=4",
    htmlUrl: "https://github.com/subhan-f",
  },
  {
    login: "dicnunz",
    avatarUrl: "https://avatars.githubusercontent.com/u/139033898?v=4",
    htmlUrl: "https://github.com/dicnunz",
  },
];

/**
 * Aggregates all contributors from:
 * 1. Known core repository contributors
 * 2. Live GitHub contributors (passed in; fetched by the sync job, never by a request)
 * 3. DB prRefs authors
 * 4. In-text @username mentions
 */
export async function computeContributorStats(
  live: GitHubContributorItem[] = [],
): Promise<ContributorStats> {
  const seen = new Map<string, ChangelogContributor>();

  // 1. Seed known contributors
  for (const c of KNOWN_CORE_CONTRIBUTORS) {
    seen.set(c.login.toLowerCase(), c);
  }

  // 2. Live contributors from GitHub, when the sync job has them
  for (const c of live) {
    seen.set(c.login.toLowerCase(), { login: c.login, avatarUrl: c.avatarUrl, htmlUrl: c.htmlUrl });
  }

  // 3. Scan changelog DB entries for prRefs authors and @mentions
  const rows = await prisma.changelogEntry.findMany({
    select: {
      prRefs: true,
      added: true,
      improved: true,
      fixed: true,
      breaking: true,
      security: true,
    },
  });

  for (const row of rows) {
    // Scan PR refs
    if (Array.isArray(row.prRefs)) {
      for (const ref of row.prRefs as unknown[]) {
        if (!ref || typeof ref !== "object") continue;

        const author = (ref as Record<string, unknown>).author;
        if (!author || typeof author !== "object") continue;

        const { login, avatarUrl, htmlUrl } = author as Record<string, unknown>;
        if (
          typeof login === "string" &&
          typeof avatarUrl === "string" &&
          typeof htmlUrl === "string"
        ) {
          seen.set(login.toLowerCase(), { login, avatarUrl, htmlUrl });
        }
      }
    }

    // Scan text items for @user mentions
    const allItems = [
      ...row.added,
      ...row.improved,
      ...row.fixed,
      ...row.breaking,
      ...row.security,
    ];
    for (const item of allItems) {
      const mentions = item.match(/(?:^|\s)@([a-zA-Z0-9_-]+)(?=[\s,.:;!?)\]]|$)/g);
      if (mentions) {
        for (const m of mentions) {
          const username = m.trim().replace(/^@/, "");
          if (
            username &&
            username.length >= 2 &&
            username.toLowerCase() !== "veriworkly" &&
            username.toLowerCase() !== "veriworkl" &&
            !username.includes("npm")
          ) {
            const lower = username.toLowerCase();
            if (!seen.has(lower)) {
              seen.set(lower, {
                login: username,
                avatarUrl: `https://github.com/${username}.png`,
                htmlUrl: `https://github.com/${username}`,
              });
            }
          }
        }
      }
    }
  }

  const all = Array.from(seen.values());

  return {
    contributorCount: all.length,
    topContributors: all.slice(0, MAX_TOP_CONTRIBUTORS),
  };
}

/**
 * Called by the changelog sync: fetch the live contributors, merge, and store the result for the
 * changelog TTL. A failed fetch stores nothing, so the previous list keeps being served rather
 * than a degraded one for 30 days. Returns whether a list was stored.
 */
export async function refreshContributorStats(): Promise<boolean> {
  const { owner, repo, token } = config.github;
  if (!owner || !repo) return false;

  try {
    const live = await fetchGitHubContributors(owner, repo, token, { fresh: true });
    const stats = await computeContributorStats(live);

    await cacheSet(CONTRIBUTORS_CACHE_KEY, stats, config.cache.changelogTtlSeconds);
    return true;
  } catch (error) {
    logger.warn("Changelog sync: could not refresh contributors; keeping the previous list", error);
    return false;
  }
}

/**
 * What /changelog/stats serves: the list the sync stored, else known and in-database contributors
 * only. `complete` is false for the fallback so the caller does not cache it for long.
 */
export async function getContributorStats(): Promise<ContributorStats & { complete: boolean }> {
  const stored = await cacheGet<ContributorStats>(CONTRIBUTORS_CACHE_KEY);
  if (stored) return { ...stored, complete: true };

  return { ...(await computeContributorStats()), complete: false };
}

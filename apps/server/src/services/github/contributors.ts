import { cacheGet, cacheSet } from "#lib/redis";
import { fetchGitHubApi } from "./client.js";
import type { GitHubContributorItem } from "./types.js";

const CONTRIBUTORS_CACHE_TTL = 86400; // 24 hours

/**
 * Fetch top contributors from the GitHub API with 24-hour Redis caching. Throws when GitHub
 * fails: an empty list that looks like success would be stored for days (V-060). `fresh` skips the
 * cache read (the result is still cached): the changelog sync stores what it gets for its own TTL,
 * so reading a day-old cached list there would leave the stored one up to ~48 h behind.
 */
export async function fetchGitHubContributors(
  owner: string,
  repo: string,
  token?: string,
  options: { fresh?: boolean } = {},
): Promise<GitHubContributorItem[]> {
  const cacheKey = `github:repo:contributors:${owner}:${repo}`;
  const cached = options.fresh ? null : await cacheGet<GitHubContributorItem[]>(cacheKey);
  if (cached) return cached;

  const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`;
  const response = await fetchGitHubApi(url, token);

  const data = (await response.json()) as Array<{
    login?: string;
    avatar_url?: string;
    html_url?: string;
    contributions?: number;
    type?: string;
  }>;

  if (!Array.isArray(data)) throw new Error("GitHub contributors response was not a list");

  const contributors: GitHubContributorItem[] = data
    .filter((item) => item.login && item.avatar_url && item.html_url && item.type !== "Bot")
    .map((item) => ({
      login: item.login!,
      avatarUrl: item.avatar_url!,
      htmlUrl: item.html_url!,
      contributions: item.contributions ?? 1,
    }));

  if (contributors.length > 0) {
    await cacheSet(cacheKey, contributors, CONTRIBUTORS_CACHE_TTL);
  }

  return contributors;
}

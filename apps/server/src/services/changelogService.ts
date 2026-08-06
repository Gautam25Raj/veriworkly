import { config } from "#config";

import { prisma } from "#lib/prisma";
import { ApiError } from "#lib/errors";
import { cacheGet, cacheSet } from "#lib/redis";

export type ChangelogType = "major" | "minor" | "patch";

export interface ChangelogQuery {
  type?: ChangelogType;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export type ChangelogListResult = {
  items: Array<{
    id: string;
    version: string;
    title: string;
    summary: string | null;
    type: ChangelogType;
    publishedAt: Date;
    githubUrl: string | null;
    added: string[];
    improved: string[];
    fixed: string[];
    breaking: string[];
    security: string[];
    tags: string[];
    prRefs: unknown;
  }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  pagination: {
    mode: "offset";
    nextOffset: number | null;
    nextCursor: string | null;
  };
};

/**
 * Fetch changelog entries with optional filters and pagination, newest first.
 * Results are cached based on query parameters.
 */

const getChangelogEntries = async (query: ChangelogQuery = {}): Promise<ChangelogListResult> => {
  const { type, tag, search, limit = 20, offset = 0 } = query;

  const cacheKey = `changelog:list:${type || "all"}:${tag || "-"}:${search || "-"}:${limit}:${offset}`;
  const cached = await cacheGet<ChangelogListResult>(cacheKey);

  if (cached) return cached;

  const where: {
    type?: ChangelogType;
    tags?: { has: string };
    OR?: Array<{
      title?: { contains: string; mode: "insensitive" };
      summary?: { contains: string; mode: "insensitive" };
    }>;
  } = {};

  if (type) where.type = type;
  if (tag) where.tags = { has: tag };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.changelogEntry.findMany({
      where,
      select: {
        id: true,
        version: true,
        title: true,
        summary: true,
        type: true,
        publishedAt: true,
        githubUrl: true,
        added: true,
        improved: true,
        fixed: true,
        breaking: true,
        security: true,
        tags: true,
        prRefs: true,
      },
      orderBy: [{ publishedAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.changelogEntry.count({ where }),
  ]);

  const hasMore = offset + limit < total;
  const normalizedItems = items.map((item) => ({
    ...item,
    type: item.type as ChangelogType,
  }));

  const response = {
    items: normalizedItems,
    total,
    limit,
    offset,
    hasMore,
    pagination: {
      mode: "offset" as const,
      nextOffset: hasMore ? offset + limit : null,
      nextCursor: null as string | null,
    },
  };

  await cacheSet(cacheKey, response, config.cache.changelogTtlSeconds);

  return response;
};

/**
 * Fetch a single changelog entry by id (version slug).
 */

const getChangelogEntryById = async (id: string) => {
  const cacheKey = `changelog:entry:${id}`;
  const cached = await cacheGet(cacheKey);

  if (cached) return cached;

  const entry = await prisma.changelogEntry.findUnique({ where: { id } });

  if (!entry) throw new ApiError(404, "Changelog entry not found");

  await cacheSet(cacheKey, entry, config.cache.changelogTtlSeconds);

  return entry;
};

interface ChangelogContributor {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

const MAX_TOP_CONTRIBUTORS = 20;

/**
 * Scans every entry's prRefs for unique PR authors. The table is small
 * (tens of rows), so a single findMany + in-memory dedupe is simpler and
 * cheaper than trying to aggregate JSON arrays in SQL.
 */

async function computeContributorStats(): Promise<{
  contributorCount: number;
  topContributors: ChangelogContributor[];
}> {
  const rows = await prisma.changelogEntry.findMany({ select: { prRefs: true } });
  const seen = new Map<string, ChangelogContributor>();

  for (const row of rows) {
    if (!Array.isArray(row.prRefs)) continue;

    for (const ref of row.prRefs as unknown[]) {
      if (!ref || typeof ref !== "object") continue;

      const author = (ref as Record<string, unknown>).author;
      if (!author || typeof author !== "object") continue;

      const { login, avatarUrl, htmlUrl } = author as Record<string, unknown>;
      if (
        typeof login !== "string" ||
        typeof avatarUrl !== "string" ||
        typeof htmlUrl !== "string"
      ) {
        continue;
      }

      if (!seen.has(login)) seen.set(login, { login, avatarUrl, htmlUrl });
    }
  }

  const all = Array.from(seen.values());

  return {
    contributorCount: all.length,
    topContributors: all.slice(0, MAX_TOP_CONTRIBUTORS),
  };
}

/**
 * Compute aggregate changelog statistics (counts by type, latest version).
 * Cached to reduce database load.
 */

const getChangelogStats = async () => {
  const cacheKey = "changelog:stats";
  const cached = await cacheGet(cacheKey);

  if (cached) return cached;

  const [groupedByType, totalEntries, latest, contributorStats] = await Promise.all([
    prisma.changelogEntry.groupBy({
      by: ["type"],
      _count: { _all: true },
    }),
    prisma.changelogEntry.count(),
    prisma.changelogEntry.findFirst({
      orderBy: { publishedAt: "desc" },
      select: { version: true, publishedAt: true, title: true },
    }),
    computeContributorStats(),
  ]);

  const typeCounts = groupedByType.reduce<Record<string, number>>((acc, row) => {
    acc[row.type] = row._count._all;
    return acc;
  }, {});

  const stats = {
    totalEntries,
    major: typeCounts.major ?? 0,
    minor: typeCounts.minor ?? 0,
    patch: typeCounts.patch ?? 0,
    latest,
    contributorCount: contributorStats.contributorCount,
    topContributors: contributorStats.topContributors,
  };

  await cacheSet(cacheKey, stats, config.cache.changelogTtlSeconds);

  return stats;
};

export { getChangelogEntries, getChangelogEntryById, getChangelogStats };

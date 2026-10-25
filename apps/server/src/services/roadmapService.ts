import { config } from "#config";

import { prisma } from "#lib/prisma";
import { ApiError } from "#lib/errors";
import { cacheGet, cacheSet } from "#lib/redis";
import { MAX_CACHED_OFFSET } from "#utils/pagination";

export type RoadmapStatus = "todo" | "in-progress" | "done";
export type RoadmapSort = "newest" | "oldest" | "recently-completed";

export interface RoadmapQuery {
  status?: RoadmapStatus;
  sort?: RoadmapSort;
  limit?: number;
  offset?: number;
  excludeId?: string;
}

export type RoadmapListResult = {
  items: Array<{
    id: string;
    title: string;
    description: string;
    status: RoadmapStatus;
    eta: string | null;
    tags: string[];
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    completedQuarter: string | null;
    updatedAt: Date;
    timeline: string | null;
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

// Every order ends on id: many items share a createdAt, and without a unique tiebreaker offset
// pages repeat or skip them (V-062).
function getRoadmapOrderBy(sort: RoadmapSort) {
  if (sort === "oldest") return [{ createdAt: "asc" as const }, { id: "asc" as const }];

  if (sort === "recently-completed")
    return [
      { completedAt: { sort: "desc" as const, nulls: "last" as const } },
      { updatedAt: "desc" as const },
      { id: "asc" as const },
    ];

  return [{ createdAt: "desc" as const }, { id: "asc" as const }];
}

/**
 * Fetch roadmap features with optional filters and pagination.
 * Results are cached based on query parameters.
 */

const getRoadmapFeatures = async (query: RoadmapQuery = {}): Promise<RoadmapListResult> => {
  const { status, sort = "newest", limit = 20, offset = 0, excludeId } = query;

  // An excludeId query ("more like this" under a detail page) is not cached: each distinct id
  // would otherwise hold its own 30-day copy of the list, a key space any caller can grow (V-061).
  const cacheKey =
    excludeId || offset > MAX_CACHED_OFFSET
      ? null
      : `roadmap:list:${status || "all"}:${sort}:${limit}:${offset}`;
  const cached = cacheKey ? await cacheGet<RoadmapListResult>(cacheKey) : null;

  if (cached) return cached;

  const where: {
    status?: RoadmapStatus;
    id?: { not: string };
  } = {};

  if (status) where.status = status;
  if (excludeId) where.id = { not: excludeId };

  const [items, total] = await Promise.all([
    prisma.roadmapFeature.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        eta: true,
        tags: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        completedQuarter: true,
        updatedAt: true,
        timeline: true,
      },
      orderBy: getRoadmapOrderBy(sort),
      take: limit,
      skip: offset,
    }),
    prisma.roadmapFeature.count({ where }),
  ]);

  const hasMore = offset + limit < total;
  const normalizedItems = items.map((item) => ({
    ...item,
    status: item.status as RoadmapStatus,
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

  if (cacheKey) await cacheSet(cacheKey, response, config.cache.roadmapTtlSeconds);

  return response;
};

/**
 * Fetch a single roadmap feature by ID.
 * Uses cache for faster repeated access.
 */

const getRoadmapFeatureById = async (id: string) => {
  const cacheKey = `roadmap:feature:${id}`;
  const cached = await cacheGet(cacheKey);

  if (cached) return cached;

  const feature = await prisma.roadmapFeature.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      eta: true,
      tags: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      completedQuarter: true,
      updatedAt: true,
      fullDescription: true,
      whyItMatters: true,
      timeline: true,
      details: true,
    },
  });

  if (!feature) throw new ApiError(404, "Roadmap feature not found");

  await cacheSet(cacheKey, feature, config.cache.roadmapTtlSeconds);

  return feature;
};

/**
 * Compute roadmap statistics (counts by status + completion rate).
 * Cached to reduce database load.
 */

const getRoadmapStats = async () => {
  const cacheKey = "roadmap:stats";
  const cached = await cacheGet(cacheKey);

  if (cached) return cached;

  const [groupedByStatus, totalFeatures] = await Promise.all([
    prisma.roadmapFeature.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.roadmapFeature.count(),
  ]);

  const statusCounts = groupedByStatus.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const todoCount = statusCounts.todo ?? 0;
  const inProgressCount = statusCounts["in-progress"] ?? 0;
  const doneCount = statusCounts.done ?? 0;

  const stats = {
    totalFeatures,
    todo: todoCount,
    inProgress: inProgressCount,
    done: doneCount,
    completionRate: totalFeatures === 0 ? "0.00" : ((doneCount / totalFeatures) * 100).toFixed(2),
  };

  await cacheSet(cacheKey, stats, config.cache.roadmapStatsTtlSeconds);

  return stats;
};

export { getRoadmapFeatures, getRoadmapFeatureById, getRoadmapStats };

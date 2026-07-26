import { fetchApiData, ApiRequestError } from "@/utils/fetchApiData";

/**
 * Releases land roughly weekly, so a 5-minute window spent far more effort revalidating
 * than the data ever changed. 30 minutes still surfaces a new release well inside the
 * window anyone would notice, and a deploy invalidates the cache anyway — every release
 * ships with one.
 */
const CHANGELOG_REVALIDATE_SECONDS = 604800;

export type ChangelogType = "major" | "minor" | "patch";

export interface ChangelogPrAuthor {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
}

export interface ChangelogPrRef {
  number: number;
  title: string;
  url?: string;
  author?: ChangelogPrAuthor | null;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  summary: string | null;
  type: ChangelogType;
  publishedAt: string;
  githubUrl: string | null;
  added: string[];
  improved: string[];
  fixed: string[];
  breaking: string[];
  security: string[];
  tags: string[];
  prRefs?: ChangelogPrRef[] | null;
}

interface ChangelogListPayload {
  items: ChangelogEntry[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  pagination: {
    mode: "offset";
    nextOffset: number | null;
    nextCursor: string | null;
  };
}

export interface ChangelogStats {
  totalEntries: number;
  major: number;
  minor: number;
  patch: number;
  latest: { version: string; publishedAt: string; title: string } | null;
  contributorCount: number;
  topContributors: ChangelogPrAuthor[];
}

export interface ChangelogQuery {
  type?: ChangelogType;
  tag?: string;
  search?: string;
}

export const CHANGELOG_PAGE_SIZE = 15;

export interface ChangelogPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ChangelogResponse {
  entries: ChangelogEntry[];
  stats: ChangelogStats | null;
  pagination: ChangelogPagination;
  generatedAt: string;
}

function parsePrAuthor(raw: unknown): ChangelogPrAuthor | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;

  if (
    typeof item.login !== "string" ||
    typeof item.avatarUrl !== "string" ||
    typeof item.htmlUrl !== "string"
  ) {
    return null;
  }

  return { login: item.login, avatarUrl: item.avatarUrl, htmlUrl: item.htmlUrl };
}

function parsePrRefs(raw: unknown): ChangelogPrRef[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  return raw
    .map((entry): ChangelogPrRef | null => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const item = entry as Record<string, unknown>;
      if (typeof item.number !== "number" || typeof item.title !== "string") return null;

      return {
        number: item.number,
        title: item.title,
        url: typeof item.url === "string" ? item.url : undefined,
        author: parsePrAuthor(item.author),
      };
    })
    .filter((entry): entry is ChangelogPrRef => entry !== null);
}

function normalizeEntry(entry: ChangelogEntry): ChangelogEntry {
  return {
    ...entry,
    tags: entry.tags ?? [],
    added: entry.added ?? [],
    improved: entry.improved ?? [],
    fixed: entry.fixed ?? [],
    breaking: entry.breaking ?? [],
    security: entry.security ?? [],
    prRefs: parsePrRefs(entry.prRefs),
  };
}

async function fetchChangelogPage(
  query: ChangelogQuery,
  page: number,
): Promise<{ entries: ChangelogEntry[]; total: number }> {
  const offset = (page - 1) * CHANGELOG_PAGE_SIZE;
  const params = new URLSearchParams({
    limit: CHANGELOG_PAGE_SIZE.toString(),
    offset: offset.toString(),
  });
  if (query.type) params.set("type", query.type);
  if (query.tag) params.set("tag", query.tag);
  if (query.search) params.set("search", query.search);

  const listData = await fetchApiData<ChangelogListPayload>(`/changelog?${params.toString()}`, {
    next: { revalidate: CHANGELOG_REVALIDATE_SECONDS },
  });

  return { entries: listData.items.map(normalizeEntry), total: listData.total };
}

export async function fetchChangelogFromBackend(
  query: ChangelogQuery = {},
  page: number = 1,
): Promise<ChangelogResponse> {
  try {
    const [{ entries, total }, stats] = await Promise.all([
      fetchChangelogPage(query, page),
      fetchApiData<ChangelogStats>("/changelog/stats", {
        next: { revalidate: CHANGELOG_REVALIDATE_SECONDS },
      }).catch(() => null),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / CHANGELOG_PAGE_SIZE));

    return {
      entries,
      stats,
      pagination: { page, pageSize: CHANGELOG_PAGE_SIZE, total, totalPages },
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Failed to fetch changelog from backend:", err);
    return {
      entries: [],
      stats: null,
      pagination: { page, pageSize: CHANGELOG_PAGE_SIZE, total: 0, totalPages: 1 },
      generatedAt: new Date().toISOString(),
    };
  }
}

export async function fetchChangelogEntryById(id: string): Promise<ChangelogEntry | null> {
  try {
    const entry = await fetchApiData<ChangelogEntry>(`/changelog/${id}`, {
      next: { revalidate: CHANGELOG_REVALIDATE_SECONDS },
    });

    return normalizeEntry(entry);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

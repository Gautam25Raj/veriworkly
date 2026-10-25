import { Prisma } from "@prisma/client";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  statusCode?: number;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface RoadmapFeatureResponse {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  eta?: string;
  tags?: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  completedQuarter?: string;
  updatedAt: string;
  fullDescription?: string;
  whyItMatters?: string;
  timeline?: string;
  details?: Record<string, unknown>;
}

export interface RoadmapStatsResponse {
  totalFeatures: number;
  todo: number;
  inProgress: number;
  done: number;
  completionRate: string;
}

/** `GET /github/stats`, as `getGitHubStats` returns it (dates serialise to ISO strings). */
export interface GitHubStatsResponse {
  projectName: string;
  projectUrl: string;
  stats: {
    totalItems: number;
    /** @deprecated Same value as `totalItems`; kept until the site reads `totalItems` only. */
    total: number;
    issues: number;
    pullRequests: number;
    todo: number;
    inProgress: number;
    done: number;
    completionRate: string;
  };
  syncedAt: Date | string;
  nextSyncAt: Date | string | null;
}

export interface PublicShareLink {
  id: string;
  slug: string;
  passwordHash: string | null;
  expiresAt: string | Date | null;
  snapshot: Prisma.JsonValue;
  document: {
    title: string;
    slug?: string;
  };
}

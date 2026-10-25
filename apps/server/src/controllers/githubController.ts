import { z } from "zod";
import { Request, Response, NextFunction } from "express";

import * as githubService from "#services/github/index";

import {
  parseOffsetPagination,
  createOffsetPaginationMeta,
  notBothPageAndOffset,
  notBothPageAndOffsetError,
  publicOffsetParam,
  publicPageParam,
} from "#utils/pagination";
import { createSuccessResponse, handleValidationError } from "#lib/errors";

/**
 * Validation schema for GitHub query parameters.
 */

// A date (2026-08-01) or a full ISO datetime; anything else is a 400 rather than a silent no-op.
const isoDateFilter = z
  .union([z.string().date(), z.string().datetime({ offset: true })])
  .optional();

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `from` is inclusive. `to` is inclusive too: a datetime is `lte`, and a bare date covers that
 * whole UTC day, so `createdTo=2026-08-10` is `lt 2026-08-11T00:00Z`.
 */
function toDateRange(from?: string, to?: string): githubService.GitHubDateRange | undefined {
  if (!from && !to) return undefined;

  const range: githubService.GitHubDateRange = {};
  if (from) range.gte = new Date(from);
  if (to && DATE_ONLY.test(to)) range.lt = new Date(Date.parse(`${to}T00:00:00Z`) + DAY_MS);
  else if (to) range.lte = new Date(to);

  return range;
}

const githubQuerySchema = z
  .object({
    status: z.enum(["todo", "in-progress", "done"]).optional(),
    kind: z.enum(["issue", "pull-request", "all"]).optional(),
    page: publicPageParam,
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    offset: publicOffsetParam,
    createdFrom: isoDateFilter,
    createdTo: isoDateFilter,
    updatedFrom: isoDateFilter,
    updatedTo: isoDateFilter,
  })
  .strict()
  .refine(notBothPageAndOffset, notBothPageAndOffsetError);

export class GithubController {
  /**
   * Get GitHub project statistics (stars, forks, issues count, etc.).
   *
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await githubService.getGitHubStats();

      res.json(createSuccessResponse(stats, "GitHub stats fetched successfully"));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get GitHub issues with filtering, pagination, and status tracking.
   *
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */

  static async getIssues(req: Request, res: Response, next: NextFunction) {
    try {
      const query = githubQuerySchema.parse(req.query);

      const pagination = parseOffsetPagination(query, { defaultPageSize: 20, maxPageSize: 50 });

      const result = await githubService.getGitHubIssues({
        status: query.status,
        kind: query.kind,
        createdAt: toDateRange(query.createdFrom, query.createdTo),
        updatedAt: toDateRange(query.updatedFrom, query.updatedTo),
        limit: pagination.limit,
        offset: pagination.offset,
      });

      const meta = createOffsetPaginationMeta(result.total, pagination);

      res.json(
        createSuccessResponse(
          { items: result.items, ...meta, syncedAt: result.syncedAt },
          "GitHub issues fetched successfully",
        ),
      );
    } catch (error) {
      if (error instanceof z.ZodError) return next(handleValidationError(error));
      next(error);
    }
  }

  /**
   * Trigger a manual sync of GitHub data (Admin only).
   *
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */

  static async syncStats(req: Request, res: Response, next: NextFunction) {
    try {
      const syncResult = await githubService.syncGitHubStatsFromGitHub();

      res.json(createSuccessResponse(syncResult, "Manual GitHub sync completed successfully"));
    } catch (error) {
      next(error);
    }
  }
}

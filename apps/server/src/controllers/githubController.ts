import { z } from "zod";
import { Request, Response, NextFunction } from "express";

import * as githubService from "#services/github/index";
import { startGitHubSync } from "#services/admin/adminSyncTrigger";

import { parseOffsetPagination, createOffsetPaginationMeta } from "#utils/pagination";
import { githubQuerySchema } from "#validators/githubValidator";
import { createSuccessResponse, handleValidationError } from "#lib/errors";

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
   * Trigger a manual sync of GitHub data (Admin only). Answers 202 once the sync's lock is taken
   * and runs the sync in the background (V-080): it pages through GitHub for longer than a proxy
   * holds a request open. 409 while a sync is running, 503 when Redis is down.
   *
   * @param req Express request
   * @param res Express response
   * @param next Express next function
   */

  static async syncStats(req: Request, res: Response, next: NextFunction) {
    try {
      const started = await startGitHubSync(false);

      res.status(202).json(createSuccessResponse(started, "GitHub sync started"));
    } catch (error) {
      next(error);
    }
  }
}

import { RequestHandler, Router } from "express";

import { flexibleAuth } from "#middleware/flexibleAuth";
import { adminAuthMiddleware } from "#middleware/adminAuth";

import { StatsController, isInternalStatsRequest } from "#controllers/statsController";

const router = Router();

const publicStatsAuth = flexibleAuth({ skipSession: true });

/**
 * Internal callers (server jobs, SSR) send no Origin and no API key, so they authenticate with
 * `x-internal-key` = `STATS_INTERNAL_KEY` instead of passing through `flexibleAuth` (V-024).
 */
const statsEventAuth: RequestHandler = (req, res, next) =>
  isInternalStatsRequest(req) ? next() : publicStatsAuth(req, res, next);

router.post("/events", statsEventAuth, StatsController.recordUsageMetric);

router.get("/admin/dashboard", adminAuthMiddleware, StatsController.getAdminDashboardStats);

export default router;

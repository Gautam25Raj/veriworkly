import { Router } from "express";

import { flexibleAuth } from "#middleware/flexibleAuth";
import { adminAuthMiddleware } from "#middleware/adminAuth";
import { requireApiKeyScopes } from "#middleware/apiKeyScope";

import { GithubController } from "#controllers/githubController";

const router = Router();

router.get(
  "/stats",
  flexibleAuth({ skipSession: true }),
  requireApiKeyScopes("github:read"),
  GithubController.getStats,
);
router.get(
  "/issues",
  flexibleAuth({ skipSession: true }),
  requireApiKeyScopes("github:read"),
  GithubController.getIssues,
);

/**
 * Kept on this router because it is part of the published OpenAPI surface. `/admin/system/github/sync`
 * is the equivalent inside the admin router and additionally records who triggered the sync in the
 * admin audit log — prefer it for anything driven from the admin dashboard.
 */
router.post("/admin/sync", adminAuthMiddleware, GithubController.syncStats);

export default router;

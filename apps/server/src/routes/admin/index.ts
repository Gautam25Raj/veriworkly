import { Router } from "express";

import { adminAuthMiddleware } from "#middleware/adminAuth";

import overviewRoutes from "#routes/admin/overview";
import userRoutes from "#routes/admin/users";
import affiliateRoutes from "#routes/admin/affiliates";
import ambassadorRoutes from "#routes/admin/ambassadors";
import portfolioRoutes from "#routes/admin/portfolios";
import documentRoutes from "#routes/admin/documents";
import shareLinkRoutes from "#routes/admin/shareLinks";
import billingRoutes from "#routes/admin/billing";
import auditRoutes from "#routes/admin/audit";
import apiKeyRoutes from "#routes/admin/apiKeys";
import systemRoutes from "#routes/admin/system";
import roadmapRoutes from "#routes/admin/roadmap";
import changelogRoutes from "#routes/admin/changelog";
import monetizationRoutes from "#routes/admin/monetization";

/**
 * Every admin API lives under this one router, and the admin gate is applied once here rather
 * than repeated in each sub-router. That is deliberate: a new admin route file added later is
 * protected by construction, instead of being protected only if its author remembers to add
 * `router.use(adminAuthMiddleware)`.
 *
 * The middleware is authoritative — the studio's `requireAdminUser()` is defence in depth for
 * the UI shell, never a substitute for this check.
 */
const router = Router();

router.use(adminAuthMiddleware);

router.use("/overview", overviewRoutes);
router.use("/users", userRoutes);
router.use("/affiliates", affiliateRoutes);
router.use("/ambassadors", ambassadorRoutes);
router.use("/portfolios", portfolioRoutes);
router.use("/documents", documentRoutes);
router.use("/share-links", shareLinkRoutes);
router.use("/billing", billingRoutes);
router.use("/audit", auditRoutes);
router.use("/api-keys", apiKeyRoutes);
router.use("/system", systemRoutes);
router.use("/roadmap", roadmapRoutes);
router.use("/changelog", changelogRoutes);

// Pre-split path, response shape unchanged. See the note in the monetization router.
router.use("/monetization", monetizationRoutes);

// Singular alias for the old `/admin/ambassador` mount. The list response is now paginated
// (`{ items, total, ... }` rather than a bare array), so this is a path alias, not a shape one.
router.use("/ambassador", ambassadorRoutes);

export default router;

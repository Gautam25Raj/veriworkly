import { Router } from "express";

import { flexibleAuth } from "#middleware/flexibleAuth";
import { adminAuthMiddleware } from "#middleware/adminAuth";
import { requireApiKeyScopes } from "#middleware/apiKeyScope";

import {
  createChangelogEntryController,
  updateChangelogEntryController,
  deleteChangelogEntryController,
  syncChangelogReleasesController,
} from "#controllers/admin/adminChangelogController";
import { ChangelogController } from "#controllers/changelogController";

const router = Router();

router.get(
  "/",
  flexibleAuth({ skipSession: true }),
  requireApiKeyScopes("changelog:read"),
  ChangelogController.getEntries,
);

router.get(
  "/stats",
  flexibleAuth({ skipSession: true }),
  requireApiKeyScopes("changelog:read"),
  ChangelogController.getStats,
);

router.get(
  "/:id",
  flexibleAuth({ skipSession: true }),
  requireApiKeyScopes("changelog:read"),
  ChangelogController.getEntryById,
);

router.post("/admin", adminAuthMiddleware, createChangelogEntryController);
router.put("/admin/:id", adminAuthMiddleware, updateChangelogEntryController);
router.delete("/admin/:id", adminAuthMiddleware, deleteChangelogEntryController);
router.post("/admin/sync", adminAuthMiddleware, syncChangelogReleasesController);

export default router;

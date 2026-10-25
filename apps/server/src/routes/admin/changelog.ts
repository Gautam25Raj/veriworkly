import { Router } from "express";

import {
  createChangelogEntryController,
  updateChangelogEntryController,
  deleteChangelogEntryController,
  syncChangelogReleasesController,
  changelogSyncStatusController,
} from "#controllers/admin/adminChangelogController";

/**
 * Changelog writes. Reads stay on the public `/changelog` router, which is API-key
 * addressable — only the mutations belong behind the admin gate.
 */
const router = Router();

router.post("/", createChangelogEntryController);
router.get("/sync", changelogSyncStatusController);
router.post("/sync", syncChangelogReleasesController);
router.put("/:id", updateChangelogEntryController);
router.delete("/:id", deleteChangelogEntryController);

export default router;

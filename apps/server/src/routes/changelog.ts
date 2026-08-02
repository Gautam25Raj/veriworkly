import { Router } from "express";

import { flexibleAuth } from "#middleware/flexibleAuth";
import { requireApiKeyScopes } from "#middleware/apiKeyScope";

import { ChangelogController } from "#controllers/changelogController";

// Public, API-key addressable reads only. Changelog writes moved to `/api/v1/admin/changelog`
// so every admin capability sits behind the single admin router.

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

export default router;

import { Router } from "express";

import { flexibleAuth } from "#middleware/flexibleAuth";
import { requireApiKeyScopes } from "#middleware/apiKeyScope";

import { RoadmapController } from "#controllers/roadmapController";

// Public, API-key addressable reads only. Roadmap writes moved to `/api/v1/admin/roadmap`
// so every admin capability sits behind the single admin router.

const router = Router();

router.get(
  "/",
  flexibleAuth({ skipSession: true }),
  requireApiKeyScopes("roadmap:read"),
  RoadmapController.getFeatures,
);

router.get(
  "/stats",
  flexibleAuth({ skipSession: true }),
  requireApiKeyScopes("roadmap:read"),
  RoadmapController.getStats,
);

router.get(
  "/:id",
  flexibleAuth({ skipSession: true }),
  requireApiKeyScopes("roadmap:read"),
  RoadmapController.getFeatureById,
);

export default router;

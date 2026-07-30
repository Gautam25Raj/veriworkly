import { Router } from "express";

import {
  createRoadmapFeatureController,
  updateRoadmapFeatureController,
  deleteRoadmapFeatureController,
} from "#controllers/admin/adminRoadmapController";

/**
 * Roadmap writes. Reads stay on the public `/roadmap` router, which is API-key addressable —
 * only the mutations belong behind the admin gate.
 */
const router = Router();

router.post("/", createRoadmapFeatureController);
router.put("/:id", updateRoadmapFeatureController);
router.delete("/:id", deleteRoadmapFeatureController);

export default router;

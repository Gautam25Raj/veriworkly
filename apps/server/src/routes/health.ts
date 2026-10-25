import { Router } from "express";

import { HealthController } from "#controllers/healthController";

const router = Router();

router.get("/", HealthController.check);
router.get("/ready", HealthController.ready);
router.get("/metrics", HealthController.requireInternalKey, HealthController.metrics);
router.get("/jobs", HealthController.requireInternalKey, HealthController.jobs);

export default router;

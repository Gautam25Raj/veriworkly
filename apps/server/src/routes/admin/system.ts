import { Router } from "express";

import { AdminSystemController } from "#controllers/admin/adminSystemController";

const router = Router();

router.get("/health", AdminSystemController.health);
router.get("/jobs", AdminSystemController.jobs);
router.get("/metrics", AdminSystemController.metrics);
router.get("/dashboard", AdminSystemController.dashboard);
router.get("/request-logs", AdminSystemController.requestLogs);

router.get("/github", AdminSystemController.github);
router.post("/github/sync", AdminSystemController.syncGithub);

router.post("/cache/flush", AdminSystemController.flushCache);

export default router;

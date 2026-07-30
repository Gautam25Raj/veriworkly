import { Router } from "express";

import { AdminOverviewController } from "#controllers/admin/adminOverviewController";

const router = Router();

router.get("/", AdminOverviewController.getOverview);
router.get("/activity", AdminOverviewController.getRecentActivity);

export default router;

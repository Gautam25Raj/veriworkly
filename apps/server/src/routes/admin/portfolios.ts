import { Router } from "express";

import { AdminPortfolioController } from "#controllers/admin/adminPortfolioController";

const router = Router();

router.get("/summary", AdminPortfolioController.summary);
router.get("/assets", AdminPortfolioController.listAssets);

router.get("/", AdminPortfolioController.list);
router.get("/:id", AdminPortfolioController.detail);
router.patch("/:id", AdminPortfolioController.updateStatus);
router.delete("/:id", AdminPortfolioController.unpublish);

export default router;

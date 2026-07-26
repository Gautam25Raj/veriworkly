import { Router } from "express";

import { AdminAmbassadorController } from "#controllers/adminAmbassadorController";
import { adminAuthMiddleware } from "#middleware/adminAuth";

const router = Router();

router.use(adminAuthMiddleware);

router.get("/", AdminAmbassadorController.list);
router.patch("/:id", AdminAmbassadorController.review);

export default router;

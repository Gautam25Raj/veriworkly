import { Router } from "express";

import { AdminAmbassadorController } from "#controllers/admin/adminAmbassadorController";

const router = Router();

// Declared before `/:id` so the literal paths are not captured as an application id.
router.get("/summary", AdminAmbassadorController.summary);
router.get("/roster", AdminAmbassadorController.roster);

router.get("/", AdminAmbassadorController.list);
router.get("/:id", AdminAmbassadorController.detail);
router.patch("/:id", AdminAmbassadorController.review);

export default router;

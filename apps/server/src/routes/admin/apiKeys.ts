import { Router } from "express";

import { AdminApiKeyController } from "#controllers/admin/adminApiKeyController";

const router = Router();

router.get("/summary", AdminApiKeyController.summary);

router.get("/", AdminApiKeyController.list);
router.patch("/:id", AdminApiKeyController.update);
router.delete("/:id", AdminApiKeyController.revoke);

export default router;

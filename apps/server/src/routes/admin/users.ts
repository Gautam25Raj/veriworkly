import { Router } from "express";

import { AdminUserController } from "#controllers/admin/adminUserController";

const router = Router();

router.get("/", AdminUserController.list);
router.get("/:id", AdminUserController.detail);
router.patch("/:id", AdminUserController.update);
router.post("/:id/revoke-sessions", AdminUserController.revokeSessions);
router.delete("/:id", AdminUserController.remove);

export default router;

import { Router } from "express";

import { AdminShareLinkController } from "#controllers/admin/adminDocumentController";

const router = Router();

router.get("/", AdminShareLinkController.list);
router.delete("/:id", AdminShareLinkController.revoke);

export default router;

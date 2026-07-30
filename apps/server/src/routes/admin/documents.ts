import { Router } from "express";

import { AdminDocumentController } from "#controllers/admin/adminDocumentController";

const router = Router();

router.get("/summary", AdminDocumentController.summary);

router.get("/", AdminDocumentController.list);
router.get("/:id", AdminDocumentController.detail);
router.patch("/:id", AdminDocumentController.updateVisibility);
router.delete("/:id", AdminDocumentController.remove);
router.post("/:id/restore", AdminDocumentController.restore);

export default router;

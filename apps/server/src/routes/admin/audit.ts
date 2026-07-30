import { Router } from "express";

import { AdminAuditController } from "#controllers/admin/adminAuditController";

const router = Router();

router.get("/filters", AdminAuditController.filters);
router.get("/", AdminAuditController.list);

export default router;

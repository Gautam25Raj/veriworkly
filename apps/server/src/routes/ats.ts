import { Router } from "express";
import multer from "multer";

import { AtsAiController } from "#controllers/ats/aiController";
import { AtsCheckController } from "#controllers/ats/checkController";
import { AtsExtractController } from "#controllers/ats/extractController";
import { requireApiKeyScopes } from "#middleware/apiKeyScope";
import { flexibleAuth } from "#middleware/flexibleAuth";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

router.get("/quota", flexibleAuth, AtsCheckController.quota);
router.post("/extract", flexibleAuth, upload.single("resume"), AtsExtractController.extract);
router.post("/check", flexibleAuth, AtsCheckController.check);
router.post("/analyze", flexibleAuth, requireApiKeyScopes("ai:write"), AtsAiController.analyze);
router.post(
  "/convert-resume",
  flexibleAuth,
  requireApiKeyScopes("ai:write"),
  AtsAiController.convertResume,
);

export default router;

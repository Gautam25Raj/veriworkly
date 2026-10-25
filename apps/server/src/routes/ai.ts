import { json, Router } from "express";

import { AiController } from "#controllers/aiController";

import { requireApiKeyScopes } from "#middleware/apiKeyScope";
import { flexibleAuth } from "#middleware/flexibleAuth";

const router = Router();
// V-098: prompts and resume text; `app.ts` leaves this router unparsed for this.
const aiJsonBody = json({ limit: "256kb" });

router.get("/actions", flexibleAuth, AiController.actions);
router.post(
  "/generate",
  flexibleAuth,
  requireApiKeyScopes("ai:write"),
  aiJsonBody,
  AiController.generate,
);

export default router;

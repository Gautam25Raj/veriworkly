import { json, Router } from "express";

import { flexibleAuth } from "#middleware/flexibleAuth";
import { requireApiKeyScopes } from "#middleware/apiKeyScope";
import { autosaveRateLimit } from "#middleware/rateLimit";

import { DocumentController } from "#controllers/documentController";

const router = Router();

router.use(flexibleAuth);
// V-098: documents carry up to 4 MB; `app.ts` leaves this router's bodies unparsed for this.
// Parsed per route, after the autosave limiter, so a rate-limited autosave never parses 4 MB.
const parseLargeBody = json({ limit: "4mb" });

router
  .route("/")
  .get(requireApiKeyScopes("resume:read"), DocumentController.list)
  .post(requireApiKeyScopes("resume:write"), parseLargeBody, DocumentController.create);

router
  .route("/:id")
  .get(requireApiKeyScopes("resume:read"), DocumentController.get)
  .patch(
    requireApiKeyScopes("resume:write"),
    autosaveRateLimit,
    parseLargeBody,
    DocumentController.update,
  )
  .delete(requireApiKeyScopes("resume:write"), DocumentController.delete);

export default router;

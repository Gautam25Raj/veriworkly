import { json, Router } from "express";

import { flexibleAuth } from "#middleware/flexibleAuth";
import { requireApiKeyScopes } from "#middleware/apiKeyScope";
import { autosaveRateLimit } from "#middleware/rateLimit";

import { ProfileController } from "#controllers/profileController";

const router = Router();

router.use(flexibleAuth);
// V-098: the master profile and the imports carry up to 4 MB; `app.ts` leaves this router's
// bodies unparsed for this. Parsed per route, after the autosave limiter on PUT /master, so a
// rate-limited save never parses 4 MB.
const parseLargeBody = json({ limit: "4mb" });

router
  .route("/master")
  .get(requireApiKeyScopes("resume:read"), ProfileController.getMasterProfile)
  .put(
    requireApiKeyScopes("resume:write"),
    autosaveRateLimit,
    parseLargeBody,
    ProfileController.updateMasterProfile,
  );

// V-040: the imports write the master profile (`replaceMaster`) and the LinkedIn one runs an AI
// conversion, so a key needs the same scopes those actions need elsewhere. Session users are
// unaffected (the guard only applies when `req.apiKey` is set).
router.get("/import/quota", requireApiKeyScopes("resume:read"), ProfileController.getImportQuota);
router.post(
  "/import/github",
  requireApiKeyScopes("resume:write"),
  parseLargeBody,
  ProfileController.importGithub,
);
router.post(
  "/import/linkedin",
  requireApiKeyScopes("resume:write", "ai:write"),
  parseLargeBody,
  ProfileController.importLinkedin,
);

export default router;

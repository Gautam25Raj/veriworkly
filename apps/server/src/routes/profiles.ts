import { Router } from "express";

import { flexibleAuth } from "#middleware/flexibleAuth";
import { requireApiKeyScopes } from "#middleware/apiKeyScope";

import { ProfileController } from "#controllers/profileController";

const router = Router();

router.use(flexibleAuth);

router
  .route("/master")
  .get(requireApiKeyScopes("resume:read"), ProfileController.getMasterProfile)
  .put(requireApiKeyScopes("resume:write"), ProfileController.updateMasterProfile);

// V-040: the imports write the master profile (`replaceMaster`) and the LinkedIn one runs an AI
// conversion, so a key needs the same scopes those actions need elsewhere. Session users are
// unaffected (the guard only applies when `req.apiKey` is set).
router.get("/import/quota", requireApiKeyScopes("resume:read"), ProfileController.getImportQuota);
router.post("/import/github", requireApiKeyScopes("resume:write"), ProfileController.importGithub);
router.post(
  "/import/linkedin",
  requireApiKeyScopes("resume:write", "ai:write"),
  ProfileController.importLinkedin,
);

export default router;

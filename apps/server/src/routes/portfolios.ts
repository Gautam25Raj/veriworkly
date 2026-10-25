import { json, Router } from "express";

import { authMiddleware } from "#middleware/auth";
import { flexibleAuth } from "#middleware/flexibleAuth";

import { PortfolioController } from "#controllers/portfolioController";

const router = Router();

router.get("/public", flexibleAuth({ skipSession: true }), PortfolioController.listPublic);
router.get(
  "/public/:subdomain",
  flexibleAuth({ skipSession: true }),
  PortfolioController.getPublic,
);

router.post(
  "/public/:subdomain/view",
  flexibleAuth({ skipSession: true }),
  PortfolioController.recordView,
);

router.get("/me", authMiddleware, PortfolioController.getMe);
// V-098: the draft is a whole portfolio; `app.ts` leaves this path unparsed for this.
router.put("/draft", authMiddleware, json({ limit: "4mb" }), PortfolioController.saveDraft);

router.get(
  "/subdomains/:slug/availability",
  authMiddleware,
  PortfolioController.subdomainAvailability,
);
router.get("/preview/:documentId", authMiddleware, PortfolioController.preview);

router.post("/publish", authMiddleware, PortfolioController.publish);
router.post("/unpublish", authMiddleware, PortfolioController.unpublish);

router.get("/analytics", authMiddleware, PortfolioController.analytics);

export default router;

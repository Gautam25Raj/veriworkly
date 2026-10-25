import { json, Router, text } from "express";

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

// V-131: also `text/plain`, a CORS-safelisted type, so the public page's `sendBeacon` needs no
// preflight from a wildcard portfolio origin (which is never granted credentialed CORS). The
// controller parses the text as JSON and validates it like the JSON body. A beacon is tiny, but
// its referrer is not bounded by us: browsers send up to 4 KB of it (Chrome trims longer ones),
// and the validator truncates rather than refuses, so the limit leaves room for that.
router.post(
  "/public/:subdomain/view",
  text({ type: "text/plain", limit: "5kb" }),
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

import { Router } from "express";

import { AdminAffiliateController } from "#controllers/admin/adminAffiliateController";
import { AdminBillingController } from "#controllers/admin/adminBillingController";
import { AdminMonetizationController } from "#controllers/admin/adminMonetizationController";

/**
 * Compatibility surface for the original `/admin/monetization` endpoints.
 *
 * These were the whole admin API before the domain split, so they stay mounted and behave
 * exactly as before. New work should target the domain routers instead — `/admin/billing` for
 * credits, entitlements, subscriptions and webhooks, and `/admin/affiliates` for the affiliate
 * program — which expose filtering, pagination and detail views this surface never had.
 */
const router = Router();

router.get("/", AdminMonetizationController.overview);

router.post("/credits", AdminBillingController.adjustCredits);
router.post("/entitlements", AdminBillingController.grantEntitlement);

router.post("/commissions", AdminAffiliateController.createCommission);
router.patch("/commissions/:id", AdminAffiliateController.updateCommission);
router.patch("/withdrawals/:id", AdminAffiliateController.updateWithdrawal);
router.patch("/affiliates/:id", AdminAffiliateController.update);

export default router;

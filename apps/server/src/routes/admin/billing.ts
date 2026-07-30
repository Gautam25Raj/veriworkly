import { Router } from "express";

import { AdminBillingController } from "#controllers/admin/adminBillingController";

const router = Router();

router.get("/summary", AdminBillingController.summary);

router.get("/subscriptions", AdminBillingController.listSubscriptions);
router.patch("/subscriptions/:id", AdminBillingController.updateSubscription);

router.get("/credits", AdminBillingController.listWallets);
router.post("/credits", AdminBillingController.adjustCredits);

router.get("/entitlements", AdminBillingController.listEntitlements);
router.post("/entitlements", AdminBillingController.grantEntitlement);
router.delete("/entitlements/:id", AdminBillingController.revokeEntitlement);

router.get("/webhooks", AdminBillingController.listWebhooks);
router.get("/webhooks/:id", AdminBillingController.webhookDetail);
router.post("/webhooks/:id/replay", AdminBillingController.replayWebhook);

export default router;

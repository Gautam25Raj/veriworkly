import { Router } from "express";

import { AdminAffiliateController } from "#controllers/admin/adminAffiliateController";

const router = Router();

/**
 * Literal sub-resources are declared before `/:id`, because Express matches in declaration
 * order — registering `/:id` first would swallow `/summary`, `/referrals` and the rest.
 */
router.get("/summary", AdminAffiliateController.summary);

router.get("/referrals", AdminAffiliateController.listReferrals);

router.get("/commissions", AdminAffiliateController.listCommissions);
router.post("/commissions", AdminAffiliateController.createCommission);
router.patch("/commissions/:id", AdminAffiliateController.updateCommission);

router.get("/withdrawals", AdminAffiliateController.listWithdrawals);
router.patch("/withdrawals/:id", AdminAffiliateController.updateWithdrawal);

router.get("/", AdminAffiliateController.list);
router.get("/:id", AdminAffiliateController.detail);
router.patch("/:id", AdminAffiliateController.update);

export default router;

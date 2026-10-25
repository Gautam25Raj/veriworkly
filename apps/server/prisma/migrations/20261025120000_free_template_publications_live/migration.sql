-- Data only (V-042). Only premium templates (nimbus, cipher) follow a subscription into GRACE
-- and SUSPENDED; a free-template publication (signal, atelier) never needed a grant to publish
-- and is no longer taken down by a lapse. Rows an earlier lapse parked in GRACE, or suspended
-- for a billing reason (the subscription statuses billing wrote, or the job's `grace_expired`),
-- go back to LIVE. Rows a user unpublished or a moderator took down are left alone.
-- The template ids are the free entries of PORTFOLIO_TEMPLATE_IDS (src/validators/portfolioValidator.ts);
-- the reasons are BILLING_SUSPENSION_REASONS (src/services/billingService.ts).
UPDATE "PortfolioPublication"
SET "status" = 'LIVE', "suspensionReason" = NULL, "suspendedAt" = NULL
WHERE "templateId" IN ('signal', 'atelier')
  AND (
    "status" = 'GRACE'
    OR (
      "status" = 'SUSPENDED'
      AND "suspensionReason" IN ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INACTIVE', 'grace_expired')
    )
  );

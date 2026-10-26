-- V-192: what a committed AI request returned, so a retry with the same requestId after a lost
-- response gets the draft it paid for instead of a 409. Cleared by the retention job.
ALTER TABLE "CreditReservation" ADD COLUMN "replay" JSONB;

-- The retention job's "creditReplays" rule reads only rows that still hold a replay. Partial, so
-- it stays as small as the replays alive inside RETENTION_CREDIT_REPLAY_DAYS. Hand-written
-- because Prisma cannot model partial indexes (like "CreditReservation_sweep_idx").
CREATE INDEX "CreditReservation_replay_idx" ON "CreditReservation"("updatedAt") WHERE "replay" IS NOT NULL;

-- V-197: the product and amount behind a billing event, kept on the row so billing history can
-- show them after the payload is redacted.
ALTER TABLE "BillingWebhookEvent" ADD COLUMN "productName" TEXT,
ADD COLUMN "amountCents" INTEGER,
ADD COLUMN "currency" TEXT;

-- Backfill from the payloads that are still intact (redacted ones carry no `data`), so history
-- keeps these after the 30-day redaction. Fills NULL columns only, so it is safe to re-run. Names
-- come from the checkout metadata and match services/productNames.ts; a payload that names its
-- product only by provider id stays NULL and is still described from its payload while it lasts.
-- Each statement below starts with a "-- backfill" line (the integration test runs them).
-- backfill
UPDATE "BillingWebhookEvent" AS e
SET
  "productName" = COALESCE(e."productName", (
    SELECT CASE
      WHEN e."type" LIKE 'payment.%' AND m.product = 'credit_pack_250' THEN '250 extra credits'
      WHEN e."type" LIKE 'payment.%' AND m.product = 'credit_pack_500' THEN '500 extra credits'
      WHEN m.product = 'bundle' AND m.interval = 'one_day' THEN '3-Day Sprint Pass'
      WHEN m.product = 'bundle' AND m.interval = 'seven_day' THEN '7-Day Hunt Pass'
      WHEN m.product IN ('ai_credits', 'portfolio_pro', 'bundle') AND m.interval IN ('monthly', 'annual') THEN
        CASE m.product
          WHEN 'ai_credits' THEN 'AI Credits'
          WHEN 'portfolio_pro' THEN 'Creator Pro'
          ELSE 'Job Hunter Bundle'
        END || ' (' || m.interval || ')'
    END
    FROM (
      SELECT
        e."payload" -> 'data' -> 'metadata' ->> 'veriworkly_product' AS product,
        e."payload" -> 'data' -> 'metadata' ->> 'veriworkly_interval' AS interval
    ) AS m
    WHERE e."type" LIKE 'payment.%' OR e."type" LIKE 'subscription.%'
  )),
  "amountCents" = COALESCE(e."amountCents", (
    SELECT CASE WHEN jsonb_typeof(a.value) = 'number' THEN round((a.value #>> '{}')::numeric)::integer END
    FROM (
      SELECT CASE
        WHEN e."type" LIKE 'payment.%' THEN e."payload" -> 'data' -> 'total_amount'
        WHEN e."type" LIKE 'subscription.%' THEN e."payload" -> 'data' -> 'recurring_pre_tax_amount'
        WHEN e."type" LIKE 'refund.%' THEN e."payload" -> 'data' -> 'amount'
      END AS value
    ) AS a
  )),
  "currency" = COALESCE(e."currency", (
    SELECT CASE WHEN jsonb_typeof(e."payload" -> 'data' -> 'currency') = 'string'
      THEN upper(e."payload" -> 'data' ->> 'currency') END
  ))
WHERE jsonb_typeof(e."payload" -> 'data') = 'object'
  AND (e."type" LIKE 'payment.%' OR e."type" LIKE 'subscription.%' OR e."type" LIKE 'refund.%')
  AND (e."productName" IS NULL OR e."amountCents" IS NULL OR e."currency" IS NULL);

-- A refund names the product of the payment it refunds, once that payment row is named.
-- backfill
UPDATE "BillingWebhookEvent" AS r
SET "productName" = p."productName"
FROM "BillingWebhookEvent" AS p
WHERE r."type" LIKE 'refund.%'
  AND r."productName" IS NULL
  AND jsonb_typeof(r."payload" -> 'data') = 'object'
  AND p."type" = 'payment.succeeded'
  AND p."productName" IS NOT NULL
  AND p."payload" -> 'data' ->> 'payment_id' = r."payload" -> 'data' ->> 'payment_id';

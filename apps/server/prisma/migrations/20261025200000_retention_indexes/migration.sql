-- Indexes for the retention job (V-116). Each one serves the `LIMIT`ed id subquery of one rule,
-- which filters on a column no existing index leads with. IF NOT EXISTS so it is safe to re-run.
CREATE INDEX IF NOT EXISTS "AffiliateClick_createdAt_idx" ON "AffiliateClick"("createdAt");
CREATE INDEX IF NOT EXISTS "CreditReservation_status_updatedAt_idx" ON "CreditReservation"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "Document_deletedAt_idx" ON "Document"("deletedAt");
CREATE INDEX IF NOT EXISTS "UsageMetricFlushBatch_createdAt_idx" ON "UsageMetricFlushBatch"("createdAt");
CREATE INDEX IF NOT EXISTS "ViewFlushBatch_createdAt_idx" ON "ViewFlushBatch"("createdAt");

-- Admin query indexes (V-070, V-105, V-111). Every statement is IF [NOT] EXISTS so the migration
-- is safe to re-run by hand. Plain CREATE INDEX (not CONCURRENTLY): migrate deploy runs each
-- migration in a transaction, and these tables are small enough at current scale for a short lock.

-- Redundant: each is a leading prefix of another index or unique constraint on the same table.
DROP INDEX IF EXISTS "ApiKey_userId_idx";                         -- ApiKey(userId, isActive)
DROP INDEX IF EXISTS "GitHubSyncItem_syncId_idx";                 -- GitHubSyncItem(syncId, githubId) unique
DROP INDEX IF EXISTS "PortfolioViewDaily_publicationId_date_idx"; -- (publicationId, date, referrerHost) unique
DROP INDEX IF EXISTS "RoadmapFeature_status_idx";                 -- RoadmapFeature(status, createdAt)

-- Admin windows, queues and time series (each filters or orders on these without a userId).
CREATE INDEX IF NOT EXISTS "AdminAuditEntry_createdAt_idx" ON "AdminAuditEntry"("createdAt");
CREATE INDEX IF NOT EXISTS "AffiliateCommission_status_createdAt_idx" ON "AffiliateCommission"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ApiKey_lastUsed_idx" ON "ApiKey"("lastUsed");
CREATE INDEX IF NOT EXISTS "BillingWebhookEvent_createdAt_idx" ON "BillingWebhookEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "CreditTransaction_type_createdAt_idx" ON "CreditTransaction"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "Document_createdAt_idx" ON "Document"("createdAt");
CREATE INDEX IF NOT EXISTS "PortfolioAsset_status_createdAt_idx" ON "PortfolioAsset"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "PortfolioPublication_publishedAt_idx" ON "PortfolioPublication"("publishedAt");
CREATE INDEX IF NOT EXISTS "PortfolioViewDaily_date_idx" ON "PortfolioViewDaily"("date");
CREATE INDEX IF NOT EXISTS "Subscription_createdAt_idx" ON "Subscription"("createdAt");
CREATE INDEX IF NOT EXISTS "Subscription_status_createdAt_idx" ON "Subscription"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");

-- Trigram search for the admin user search (`contains` + `mode: insensitive` is ILIKE '%x%').
-- The extension is hand-written: the schema has no `postgresqlExtensions`, so Prisma ignores it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "User_email_trgm_idx" ON "User" USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_name_trgm_idx" ON "User" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "User_username_trgm_idx" ON "User" USING GIN ("username" gin_trgm_ops);

-- Hand-written partial indexes for the credit sweep job (Prisma cannot model a WHERE clause; see
-- the comments on CreditGrant and CreditReservation in schema.prisma). Only live grants and
-- pending reservations are ever swept, which is a small slice of each table.
CREATE INDEX IF NOT EXISTS "CreditGrant_sweep_idx" ON "CreditGrant"("expiresAt", "userId") WHERE "remaining" > 0;
CREATE INDEX IF NOT EXISTS "CreditReservation_sweep_idx" ON "CreditReservation"("expiresAt", "userId") WHERE "status" = 'PENDING';

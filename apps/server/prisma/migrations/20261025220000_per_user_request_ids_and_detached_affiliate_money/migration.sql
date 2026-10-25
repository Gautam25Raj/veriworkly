-- Per-user credit request ids and affiliate money history that survives account deletion.
--
-- * `CreditReservation.requestId` / `CreditTransaction.requestId` were unique across all users.
--   The AI request id is client-supplied, so one user's UUID could 409 (or 500) another user's
--   request. Uniqueness is now (userId, requestId). No data check is needed: every existing row
--   satisfied the global constraint, so no two rows can share (userId, requestId). The new index is
--   created before the old one is dropped so the ledger never runs without an idempotency key.
-- * `AffiliateCommission.affiliateId` and `AffiliateWithdrawal.userId` cascaded, so deleting an
--   affiliate erased what they earned and what was paid out. Both now SET NULL: the money rows stay,
--   detached. Existing rows all reference live users and are untouched. The partial index
--   `AffiliateWithdrawal_one_active_per_user` still holds (NULLs are distinct), and an open
--   withdrawal still blocks deletion in the application.

-- CreateIndex
CREATE UNIQUE INDEX "CreditReservation_userId_requestId_key" ON "CreditReservation"("userId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_userId_requestId_key" ON "CreditTransaction"("userId", "requestId");

-- DropIndex
DROP INDEX "CreditReservation_requestId_key";

-- DropIndex
DROP INDEX "CreditTransaction_requestId_key";

-- DropForeignKey
ALTER TABLE "AffiliateCommission" DROP CONSTRAINT "AffiliateCommission_affiliateId_fkey";

-- DropForeignKey
ALTER TABLE "AffiliateWithdrawal" DROP CONSTRAINT "AffiliateWithdrawal_userId_fkey";

-- AlterTable
ALTER TABLE "AffiliateCommission" ALTER COLUMN "affiliateId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AffiliateWithdrawal" ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateWithdrawal" ADD CONSTRAINT "AffiliateWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

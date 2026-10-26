-- Billing customer id, billing email ledger and annual credit schedules (server audit Phase 6).
--
-- * `User.billingCustomerId` (V-175): the Dodo customer id from any successful payment, so a pass
--   or credit-pack buyer (no Subscription row) can open the billing portal. Nullable, no backfill:
--   it fills in on the customer's next payment, and subscribers already reach the portal through
--   their Subscription row.
-- * `BillingNotification` (V-172, V-177): one row per billing email, unique on (kind, reference),
--   so a redelivered webhook cannot send a second purchase confirmation or payment-failed notice.
--   The row is the send's claim: `payload` (what the email says, no address) lets the hourly job
--   retry a claim whose send failed or never happened, and `sentAt` marks the one that went out.
--   SET NULL on account deletion, like the other billing records.
-- * `SubscriptionCreditSchedule` (owner decision 4): annual plans grant 1,000 credits a month for
--   twelve months instead of 12,000 up front, each month's credits expiring when the month ends.
--   Applies to annual payments from this release on; annual subscribers who already received
--   12,000 keep them and get no schedule for that period.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingCustomerId" TEXT;

-- CreateTable
CREATE TABLE "BillingNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "payload" JSONB,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCreditSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerSubId" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "monthlyCredits" INTEGER NOT NULL,
    "openedByPaymentId" TEXT,
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionCreditSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingNotification_userId_createdAt_idx" ON "BillingNotification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingNotification_kind_reference_key" ON "BillingNotification"("kind", "reference");

-- CreateIndex
CREATE INDEX "BillingNotification_sentAt_claimedAt_idx" ON "BillingNotification"("sentAt", "claimedAt");

-- CreateIndex
CREATE INDEX "SubscriptionCreditSchedule_stoppedAt_periodEnd_idx" ON "SubscriptionCreditSchedule"("stoppedAt", "periodEnd");

-- CreateIndex
CREATE INDEX "SubscriptionCreditSchedule_userId_idx" ON "SubscriptionCreditSchedule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCreditSchedule_providerSubId_periodStart_key" ON "SubscriptionCreditSchedule"("providerSubId", "periodStart");

-- AddForeignKey
ALTER TABLE "BillingNotification" ADD CONSTRAINT "BillingNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCreditSchedule" ADD CONSTRAINT "SubscriptionCreditSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


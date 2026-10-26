-- V-183, owner decision 5: billing records are kept after account deletion with the user link
-- set to null. Subscription, EntitlementGrant, CreditWallet, CreditTransaction and CreditGrant
-- used to cascade with the User row; they now detach. CreditUsageAllocation follows its
-- transaction and grant, so it is kept too. Dropping NOT NULL is a catalogue change only.

-- DropForeignKey
ALTER TABLE "CreditGrant" DROP CONSTRAINT "CreditGrant_userId_fkey";

-- DropForeignKey
ALTER TABLE "CreditTransaction" DROP CONSTRAINT "CreditTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "CreditWallet" DROP CONSTRAINT "CreditWallet_userId_fkey";

-- DropForeignKey
ALTER TABLE "EntitlementGrant" DROP CONSTRAINT "EntitlementGrant_userId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- AlterTable
ALTER TABLE "CreditGrant" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CreditTransaction" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CreditWallet" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EntitlementGrant" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditGrant" ADD CONSTRAINT "CreditGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


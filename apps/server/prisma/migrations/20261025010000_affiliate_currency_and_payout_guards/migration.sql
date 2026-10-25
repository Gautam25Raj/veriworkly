-- Affiliate money guards (V-007, V-016, V-017). Everything here is additive.
--
-- * `currency` on commissions and withdrawals: Dodo settles the account in USD and the wallet is a
--   USD balance, so existing rows are backfilled to 'USD' by the default.
-- * `ipHash` / `userAgentHash` on referrals and clicks: peppered sha256 of the request signals;
--   `sharedAddressWithAffiliate` records that the referred user applied the code from one of the
--   affiliate's own session addresses, which forces that referral's commissions to PENDING review.
-- * One active withdrawal per user, enforced by a partial unique index. Prisma cannot express the
--   predicate, so it is created here by hand and documented next to the model in schema.prisma.
--   `migrate diff` ignores partial indexes, so the drift guard stays clean.

-- Existing duplicate active withdrawals are money an admin has to look at, not something a
-- migration may merge or reject on its own, so nothing below runs until this check names the
-- affected users. Resolve each one (reject or pay the extra request through the admin panel) and
-- deploy again.
DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg("userId", ', ') INTO offenders
  FROM (
    SELECT "userId" FROM "AffiliateWithdrawal"
    WHERE "status" IN ('REQUESTED', 'APPROVED')
    GROUP BY "userId" HAVING COUNT(*) > 1
  ) duplicates;
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'affiliate_currency_and_payout_guards: users with more than one active withdrawal must be resolved first: %', offenders;
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "AffiliateClick" ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "userAgentHash" TEXT;

-- AlterTable
ALTER TABLE "AffiliateCommission" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- AlterTable
ALTER TABLE "AffiliateReferral" ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "sharedAddressWithAffiliate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userAgentHash" TEXT;

-- AlterTable
ALTER TABLE "AffiliateWithdrawal" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- One REQUESTED or APPROVED withdrawal per affiliate at a time. A second concurrent request fails
-- with 23505 (Prisma P2002), which `requestWithdrawal` maps to 409 "A withdrawal is already in
-- progress"; its wallet reservation rolls back with the transaction.
CREATE UNIQUE INDEX "AffiliateWithdrawal_one_active_per_user"
  ON "AffiliateWithdrawal"("userId")
  WHERE "status" IN ('REQUESTED', 'APPROVED');

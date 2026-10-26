-- V-180: affiliates are now promoted when a conversion crosses a threshold (Growth at 10, Partner
-- at 50, `AFFILIATE_TIERS`), but only at the moment of that conversion. An affiliate who crossed a
-- threshold before this release is still on the tier they started on: promote them now, by the
-- same rule `promoteForConversions` applies (services/affiliate/commissions.ts):
--
-- - only clean conversions count (`cleanConversionsWhere`): a converted referral with at least one
--   commission that is neither REVERSED nor held PENDING for a shared address;
-- - promotes only, never demotes;
-- - an admin's tier decision (the latest `affiliate.update` audit entry that set a tier) holds
--   until a threshold is crossed after it: the earned tier must be above both the current tier and
--   the tier the conversions at the time of that decision had earned;
-- - idempotent: a second run finds nothing left to promote.
--
-- Data only; the schema is unchanged. Tier keys compare as text: TIER_1 < TIER_2 < TIER_3.
WITH clean_conversions AS (
  SELECT r."id", r."affiliateId", r."convertedAt"
  FROM "AffiliateReferral" AS r
  WHERE r."status" = 'CONVERTED'
    AND EXISTS (
      SELECT 1
      FROM "AffiliateCommission" AS c
      WHERE c."referralId" = r."id"
        AND (
          c."status" IN ('AVAILABLE', 'PAID')
          OR (
            c."status" = 'PENDING'
            AND c."reason" IS DISTINCT FROM 'Shared address with affiliate; review before release'
          )
        )
    )
),
affiliates AS (
  SELECT
    u."id",
    u."affiliateTier"::text AS current_tier,
    (
      SELECT COUNT(*) FROM clean_conversions AS cc WHERE cc."affiliateId" = u."id"
    ) AS conversions,
    (
      SELECT a."createdAt"
      FROM "AdminAuditEntry" AS a
      WHERE a."action" = 'affiliate.update'
        AND a."targetType" = 'User'
        AND a."targetId" = u."id"
        AND jsonb_typeof(a."metadata" -> 'tier') = 'string'
      ORDER BY a."createdAt" DESC
      LIMIT 1
    ) AS decided_at
  FROM "User" AS u
  WHERE EXISTS (SELECT 1 FROM clean_conversions AS cc WHERE cc."affiliateId" = u."id")
),
earned AS (
  SELECT
    f."id",
    f.current_tier,
    CASE
      WHEN f.conversions >= 50 THEN 'TIER_3'
      WHEN f.conversions >= 10 THEN 'TIER_2'
      ELSE 'TIER_1'
    END AS earned_tier,
    CASE
      WHEN f.decided_at IS NULL THEN 'TIER_1'
      ELSE (
        SELECT
          CASE
            WHEN COUNT(*) >= 50 THEN 'TIER_3'
            WHEN COUNT(*) >= 10 THEN 'TIER_2'
            ELSE 'TIER_1'
          END
        FROM clean_conversions AS cc
        WHERE cc."affiliateId" = f."id"
          AND cc."convertedAt" <= f.decided_at
      )
    END AS earned_at_decision
  FROM affiliates AS f
)
UPDATE "User" AS u
SET "affiliateTier" = e.earned_tier::"AffiliateTier"
FROM earned AS e
WHERE u."id" = e."id"
  AND e.earned_tier > e.current_tier
  AND e.earned_tier > e.earned_at_decision;

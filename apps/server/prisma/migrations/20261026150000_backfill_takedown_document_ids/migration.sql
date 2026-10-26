-- A portfolio takedown (admin force-unpublish, audit action `portfolio.unpublish`) now records the
-- document it forced private in `metadata.documentId`, which is what `madePrivateByModerator`
-- (services/moderationRecord.ts) reads to stop the owner republishing or unlisting it. Takedowns
-- recorded before that only name the subdomain, and the publication row they targeted is gone.
--
-- Backfill: match each such entry to the PORTFOLIO document whose slug is the taken-down
-- subdomain (the default subdomain is the document's slug) and that existed at the time. Only an
-- unambiguous match (exactly one document) is written; anything else is left for a human. Data
-- only; idempotent: entries that already name a document are skipped.
WITH matches AS (
  SELECT a."id" AS audit_id, MIN(d."id") AS document_id
  FROM "AdminAuditEntry" AS a
  JOIN "Document" AS d
    ON d."type" = 'PORTFOLIO'
   AND d."slug" = a."metadata" ->> 'subdomain'
   AND d."createdAt" <= a."createdAt"
  WHERE a."action" = 'portfolio.unpublish'
    AND jsonb_typeof(a."metadata") = 'object'
    AND NOT (a."metadata" ? 'documentId')
  GROUP BY a."id"
  HAVING COUNT(*) = 1
)
UPDATE "AdminAuditEntry" AS a
SET "metadata" = a."metadata" || jsonb_build_object('documentId', m.document_id)
FROM matches AS m
WHERE a."id" = m.audit_id;

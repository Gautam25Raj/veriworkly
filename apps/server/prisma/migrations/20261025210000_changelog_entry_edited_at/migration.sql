-- V-066: whether an admin has edited a changelog entry, which `updatedAt` cannot say because the
-- release sync's own prRefs update moves it. The sync re-parses an auto-synced entry's text only
-- while this is null.
ALTER TABLE "ChangelogEntry" ADD COLUMN "editedAt" TIMESTAMP(3);

-- Backfill from the admin audit trail: an entry an admin created or updated keeps its text.
UPDATE "ChangelogEntry" AS entry
SET "editedAt" = audit."lastEditAt"
FROM (
  SELECT "targetId", MAX("createdAt") AS "lastEditAt"
  FROM "AdminAuditEntry"
  WHERE "targetType" = 'ChangelogEntry'
    AND "action" IN ('changelog.entry.create', 'changelog.entry.update')
    AND "targetId" IS NOT NULL
  GROUP BY "targetId"
) AS audit
WHERE entry."id" = audit."targetId";

-- Edits made before changelog writes were audited, or straight in the database (Prisma Studio),
-- left no audit entry. The sync this replaces treated any row whose updatedAt sat a second or
-- more after its createdAt as edited and never re-parsed it; mark those rows too, so the first
-- sync after deploy overwrites nothing the old one would have kept. This also marks rows that only
-- the sync's own prRefs update moved: they keep their current text, exactly as they did before.
UPDATE "ChangelogEntry"
SET "editedAt" = "updatedAt"
WHERE "editedAt" IS NULL
  AND "updatedAt" - "createdAt" >= INTERVAL '1 second';

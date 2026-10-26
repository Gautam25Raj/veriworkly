-- V-171: the public share lookup no longer serves a link on a PRIVATE document, and sharing a
-- document now unlists it. Documents start PRIVATE and sharing never changed that, so every
-- document shared before this release is still PRIVATE: unlist those so their links keep working.
--
-- A document whose latest admin visibility decision was "Make private" stays PRIVATE: that is the
-- moderation takedown this change makes effective. Only resumes and cover letters are unlisted:
-- they are the only documents a share link may point at from this release on. A portfolio is
-- published, not shared, and a portfolio forced private by a takedown (force-unpublish) must stay
-- private, so no PORTFOLIO (or LINK_IN_BIO) document is touched. Data only; the schema is
-- unchanged.
UPDATE "Document" AS d
SET "visibility" = 'UNLISTED'
WHERE d."visibility" = 'PRIVATE'
  AND d."type" IN ('RESUME', 'COVER_LETTER')
  AND EXISTS (SELECT 1 FROM "ShareLink" AS s WHERE s."documentId" = d."id")
  AND COALESCE(
    (
      SELECT a."metadata" ->> 'visibility'
      FROM "AdminAuditEntry" AS a
      WHERE a."targetType" = 'Document'
        AND a."targetId" = d."id"
        AND a."action" = 'document.visibility.change'
      ORDER BY a."createdAt" DESC
      LIMIT 1
    ),
    ''
  ) <> 'PRIVATE';

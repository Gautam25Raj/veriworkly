-- This migration documents schema that was already applied to the database via `prisma db push`
-- (the Prisma CLI's schema-diffing engine couldn't reach the database from the environment that
-- authored this change, so the table was created directly via a `pg` connection instead). It is
-- being recorded now, and marked as already-applied, to bring migration history back in sync with
-- both schema.prisma and the live database — no structural change results from running it.

-- CreateTable
CREATE TABLE "ChangelogEntry" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "type" TEXT NOT NULL DEFAULT 'minor',
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "githubUrl" TEXT,
    "added" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "improved" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fixed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "breaking" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "security" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prRefs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangelogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangelogEntry_version_key" ON "ChangelogEntry"("version");

-- CreateIndex
CREATE INDEX "ChangelogEntry_publishedAt_idx" ON "ChangelogEntry"("publishedAt");

-- CreateIndex
CREATE INDEX "ChangelogEntry_type_idx" ON "ChangelogEntry"("type");

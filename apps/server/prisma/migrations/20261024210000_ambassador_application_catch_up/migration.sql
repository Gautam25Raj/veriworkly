-- Catch-up migration (V-106). The AmbassadorApplication table, its enum, unique index, status
-- index and foreign key were created with `db push` and never recorded as a migration, while
-- `20260724025906_sync_ambassador_program_columns` added `User.collegeName`/`graduationYear`
-- that the schema no longer has (they live on AmbassadorApplication). It also created plain
-- indexes on `User.email` and `ApiKey.keyHash`, both of which are already covered by the UNIQUE
-- indexes Prisma creates for `@unique`.
--
-- Every statement is guarded so this applies cleanly both to a database that was `db push`ed to
-- the current schema (production) and to one built only from the migration history (CI, a fresh
-- shadow database). After it, `prisma migrate diff --from-migrations --to-schema` is empty.

-- CreateEnum (guarded: Postgres has no CREATE TYPE IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AmbassadorApplicationStatus') THEN
    CREATE TYPE "AmbassadorApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END
$$;

-- DropIndex (redundant with the UNIQUE indexes on the same columns)
DROP INDEX IF EXISTS "ApiKey_keyHash_idx";
DROP INDEX IF EXISTS "User_email_idx";

-- AlterTable (the ambassador fields moved to AmbassadorApplication)
ALTER TABLE "User" DROP COLUMN IF EXISTS "collegeName",
DROP COLUMN IF EXISTS "graduationYear";

-- CreateTable
CREATE TABLE IF NOT EXISTS "AmbassadorApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collegeName" TEXT NOT NULL,
    "graduationYear" TEXT NOT NULL,
    "whyJoin" TEXT NOT NULL,
    "superpower" TEXT NOT NULL,
    "funFact" TEXT NOT NULL,
    "vibeCheck" TEXT,
    "socialHandle" TEXT,
    "status" "AmbassadorApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmbassadorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AmbassadorApplication_userId_key" ON "AmbassadorApplication"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AmbassadorApplication_status_createdAt_idx" ON "AmbassadorApplication"("status", "createdAt");

-- AddForeignKey (guarded: ADD CONSTRAINT has no IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AmbassadorApplication_userId_fkey'
  ) THEN
    ALTER TABLE "AmbassadorApplication"
      ADD CONSTRAINT "AmbassadorApplication_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

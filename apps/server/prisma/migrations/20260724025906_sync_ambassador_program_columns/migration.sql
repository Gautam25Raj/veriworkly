-- This migration documents schema that was already applied to the database via `prisma db push`
-- during ambassador-program development, without ever being captured as a migration file. It is
-- being recorded now (and marked as already-applied) to bring migration history back in sync with
-- both schema.prisma and the live database — no structural change results from running it.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'AMBASSADOR', 'ADMIN');

-- AlterTable
ALTER TABLE "User"
ALTER COLUMN "autoSyncEnabled" SET DEFAULT true,
ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER',
ADD COLUMN "ambassadorStatus" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN "collegeName" TEXT,
ADD COLUMN "graduationYear" TEXT,
ADD COLUMN "lastLinkedinImportAt" TIMESTAMP(3),
ADD COLUMN "lastGithubImportAt" TIMESTAMP(3);

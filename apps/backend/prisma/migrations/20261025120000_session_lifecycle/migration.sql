-- B6 session lifecycle. Additive only: two nullable columns and one unique
-- index. Existing rows keep NULL (Postgres allows any number of NULLs under a
-- unique index), so no backfill and no web-visible change.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "timezone" TEXT;

-- AlterTable
ALTER TABLE "TrainingAttempt" ADD COLUMN "clientAttemptId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAttempt_clientAttemptId_key" ON "TrainingAttempt"("clientAttemptId");

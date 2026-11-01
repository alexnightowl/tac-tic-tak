-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "ruleset" TEXT;

-- AlterTable
ALTER TABLE "UserStyleProgression" ADD COLUMN     "level" INTEGER,
ADD COLUMN     "levelGuard" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserExperience" (
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "trainingSec" INTEGER NOT NULL DEFAULT 0,
    "reviewsResolved" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserExperience_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XpEvent_userId_createdAt_idx" ON "XpEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserExperience" ADD CONSTRAINT "UserExperience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: experience for the training already done (2 XP per whole
-- minute of every finished session, 15 XP per mistake cleared).
INSERT INTO "UserExperience" ("userId", "xp", "trainingSec", "reviewsResolved", "updatedAt")
SELECT u."id",
       (COALESCE(t."sec", 0) / 60) * 2 + COALESCE(r."n", 0) * 15,
       COALESCE(t."sec", 0),
       COALESCE(r."n", 0),
       CURRENT_TIMESTAMP
FROM "User" u
LEFT JOIN (
  SELECT "userId",
         SUM(LEAST(GREATEST(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")), 0), "durationSec"))::int AS "sec"
  FROM "TrainingSession"
  WHERE "endedAt" IS NOT NULL
  GROUP BY "userId"
) t ON t."userId" = u."id"
LEFT JOIN (
  SELECT "userId", COUNT(*)::int AS "n"
  FROM "ReviewItem"
  WHERE "resolvedAt" IS NOT NULL
  GROUP BY "userId"
) r ON r."userId" = u."id";

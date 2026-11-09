-- Mobile trainers (D40): blind and daily-plan sessions, haste timing, Woodpecker sets.
ALTER TABLE "TrainingSession" ADD COLUMN "themes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TrainingSession" ADD COLUMN "variant" TEXT;

ALTER TABLE "TrainingAttempt" ADD COLUMN "mistakeMs" INTEGER;

CREATE TABLE "WoodpeckerSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "puzzleIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "WoodpeckerSet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WoodpeckerSet_userId_createdAt_idx" ON "WoodpeckerSet"("userId", "createdAt");

ALTER TABLE "WoodpeckerSet" ADD CONSTRAINT "WoodpeckerSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "style" TEXT NOT NULL DEFAULT 'blitz';

-- AlterTable
ALTER TABLE "UserSetting" ADD COLUMN     "defaultStyle" TEXT NOT NULL DEFAULT 'blitz';

-- CreateTable
CREATE TABLE "UserStyleProgression" (
    "userId" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "startPuzzleRating" INTEGER NOT NULL DEFAULT 1200,
    "currentPuzzleRating" INTEGER NOT NULL DEFAULT 1200,
    "unlockedStartRating" INTEGER NOT NULL DEFAULT 1200,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStyleProgression_pkey" PRIMARY KEY ("userId","style")
);

-- CreateIndex
CREATE INDEX "TrainingSession_userId_style_startedAt_idx" ON "TrainingSession"("userId", "style", "startedAt");

-- AddForeignKey
ALTER TABLE "UserStyleProgression" ADD CONSTRAINT "UserStyleProgression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSetting" (
    "userId" TEXT NOT NULL,
    "focusMode" BOOLEAN NOT NULL DEFAULT true,
    "accentColor" TEXT NOT NULL DEFAULT '#22c55e',
    "boardTheme" TEXT NOT NULL DEFAULT 'green',
    "pieceSet" TEXT NOT NULL DEFAULT 'cburnett',
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserSetting_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserProgression" (
    "userId" TEXT NOT NULL,
    "startPuzzleRating" INTEGER NOT NULL DEFAULT 1200,
    "currentPuzzleRating" INTEGER NOT NULL DEFAULT 1200,
    "unlockedStartRating" INTEGER NOT NULL DEFAULT 1200,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgression_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Puzzle" (
    "id" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "moves" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "ratingDeviation" INTEGER NOT NULL,
    "popularity" INTEGER NOT NULL,
    "nbPlays" INTEGER NOT NULL,
    "gameUrl" TEXT,

    CONSTRAINT "Puzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuzzleTheme" (
    "puzzleId" TEXT NOT NULL,
    "themeId" INTEGER NOT NULL,

    CONSTRAINT "PuzzleTheme_pkey" PRIMARY KEY ("puzzleId","themeId")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "theme" TEXT,
    "startRating" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "peakRating" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgResponseMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "puzzleRating" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "responseMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPuzzleHistory" (
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "UserPuzzleHistory_pkey" PRIMARY KEY ("userId","puzzleId")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");

-- CreateIndex
CREATE INDEX "Puzzle_rating_idx" ON "Puzzle"("rating");

-- CreateIndex
CREATE INDEX "Puzzle_rating_popularity_idx" ON "Puzzle"("rating", "popularity");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_slug_key" ON "Theme"("slug");

-- CreateIndex
CREATE INDEX "PuzzleTheme_themeId_idx" ON "PuzzleTheme"("themeId");

-- CreateIndex
CREATE INDEX "TrainingSession_userId_startedAt_idx" ON "TrainingSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "TrainingAttempt_sessionId_idx" ON "TrainingAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "TrainingAttempt_userId_createdAt_idx" ON "TrainingAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserPuzzleHistory_userId_lastSeenAt_idx" ON "UserPuzzleHistory"("userId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "ReviewItem_userId_resolvedAt_idx" ON "ReviewItem"("userId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewItem_userId_puzzleId_key" ON "ReviewItem"("userId", "puzzleId");

-- AddForeignKey
ALTER TABLE "UserSetting" ADD CONSTRAINT "UserSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgression" ADD CONSTRAINT "UserProgression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleTheme" ADD CONSTRAINT "PuzzleTheme_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuzzleTheme" ADD CONSTRAINT "PuzzleTheme_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttempt" ADD CONSTRAINT "TrainingAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttempt" ADD CONSTRAINT "TrainingAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingAttempt" ADD CONSTRAINT "TrainingAttempt_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPuzzleHistory" ADD CONSTRAINT "UserPuzzleHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPuzzleHistory" ADD CONSTRAINT "UserPuzzleHistory_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

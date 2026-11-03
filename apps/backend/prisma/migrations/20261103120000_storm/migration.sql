-- CreateTable
CREATE TABLE "StormStream" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "base" INTEGER NOT NULL,
    "puzzleIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StormStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StormRun" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "challengeId" TEXT,
    "score" INTEGER NOT NULL,
    "mistakes" INTEGER NOT NULL,
    "bestCombo" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "lastSolveMs" INTEGER NOT NULL,
    "hardest" INTEGER,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StormRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "avgRating" INTEGER NOT NULL,
    "note" TEXT,
    "challengerRunId" TEXT,
    "opponentRunId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StormStream_userId_createdAt_idx" ON "StormStream"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StormRun_clientId_key" ON "StormRun"("clientId");

-- CreateIndex
CREATE INDEX "StormRun_userId_challengeId_createdAt_idx" ON "StormRun"("userId", "challengeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StormRun_challengeId_userId_key" ON "StormRun"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "Challenge_challengerId_createdAt_idx" ON "Challenge"("challengerId", "createdAt");

-- CreateIndex
CREATE INDEX "Challenge_opponentId_status_idx" ON "Challenge"("opponentId", "status");

-- AddForeignKey
ALTER TABLE "StormStream" ADD CONSTRAINT "StormStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StormRun" ADD CONSTRAINT "StormRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StormRun" ADD CONSTRAINT "StormRun_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "StormStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_challengerRunId_fkey" FOREIGN KEY ("challengerRunId") REFERENCES "StormRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_opponentRunId_fkey" FOREIGN KEY ("opponentRunId") REFERENCES "StormRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


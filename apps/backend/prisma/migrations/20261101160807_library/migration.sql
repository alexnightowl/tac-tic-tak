-- CreateTable
CREATE TABLE "LibraryAttempt" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryAttempt_clientId_key" ON "LibraryAttempt"("clientId");

-- CreateIndex
CREATE INDEX "LibraryAttempt_userId_bookId_idx" ON "LibraryAttempt"("userId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryAttempt_userId_puzzleId_cycle_key" ON "LibraryAttempt"("userId", "puzzleId", "cycle");

-- AddForeignKey
ALTER TABLE "LibraryAttempt" ADD CONSTRAINT "LibraryAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

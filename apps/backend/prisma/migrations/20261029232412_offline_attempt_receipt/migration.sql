-- CreateTable
CREATE TABLE "OfflineAttemptReceipt" (
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineAttemptReceipt_pkey" PRIMARY KEY ("clientId")
);

-- CreateIndex
CREATE INDEX "OfflineAttemptReceipt_userId_createdAt_idx" ON "OfflineAttemptReceipt"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "OfflineAttemptReceipt" ADD CONSTRAINT "OfflineAttemptReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

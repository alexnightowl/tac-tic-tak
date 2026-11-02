-- CreateTable
CREATE TABLE "CourseExam" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "byTheme" JSONB NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseExam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseExam_clientId_key" ON "CourseExam"("clientId");

-- CreateIndex
CREATE INDEX "CourseExam_userId_courseId_idx" ON "CourseExam"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "CourseExam" ADD CONSTRAINT "CourseExam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


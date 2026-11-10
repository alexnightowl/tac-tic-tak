-- AlterTable
ALTER TABLE "WoodpeckerSet" ADD COLUMN     "calibratedAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "method" TEXT,
ADD COLUMN     "size" INTEGER;

-- The D40 sets are their whole list.
UPDATE "WoodpeckerSet" SET "size" = cardinality("puzzleIds") WHERE "size" IS NULL;

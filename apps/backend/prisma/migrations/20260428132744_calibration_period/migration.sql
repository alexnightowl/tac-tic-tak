-- AlterTable: add column with default 0 so existing players (who
-- already established a ceiling through play) skip provisional and
-- land straight in stable mode.
ALTER TABLE "UserStyleProgression" ADD COLUMN "calibrationSessionsLeft" INTEGER NOT NULL DEFAULT 0;

-- Bump the default to 5 for fresh rows going forward — new players
-- and any new style progressions get the calibration window.
ALTER TABLE "UserStyleProgression" ALTER COLUMN "calibrationSessionsLeft" SET DEFAULT 5;

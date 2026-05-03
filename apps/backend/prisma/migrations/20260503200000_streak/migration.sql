-- Daily-streak tracking on User. We store the last play day as a
-- 'YYYY-MM-DD' string in the user's local TZ (supplied by the
-- client on session finish) instead of a UTC timestamp — saves
-- having to track per-user TZ on the server. streakFreezes is
-- automatically consumed when the player misses exactly one day,
-- and regenerates one week after consumption (cap of 1 in pocket).

ALTER TABLE "User" ADD COLUMN "streakDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "streakFreezes" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN "streakLastDay" TEXT;
ALTER TABLE "User" ADD COLUMN "streakFreezeRegenAt" TEXT;

ALTER TABLE "UserSetting" ADD COLUMN "showStreak" BOOLEAN NOT NULL DEFAULT true;

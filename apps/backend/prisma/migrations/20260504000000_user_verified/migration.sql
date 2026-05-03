-- Verified-checkmark flag on User. No backfill — defaults to false
-- for everyone; the operator flips this on directly in the DB for
-- accounts they want recognised. Surfaced everywhere the nickname
-- is displayed (profile, leaderboard, friends, search).

ALTER TABLE "User" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

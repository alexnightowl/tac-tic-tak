-- Admin-only access gate for the /admin page. Defaults to false;
-- the flag is flipped manually in the DB. No UI grants it.

ALTER TABLE "User"
  ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Seed the creator's verified flag. Idempotent — re-running this
-- on a row that's already true is a no-op. Lower-cased compare so
-- nickname casing in the DB doesn't trip the match.

UPDATE "User"
SET "verified" = true
WHERE LOWER("nickname") = 'lazynightowl';

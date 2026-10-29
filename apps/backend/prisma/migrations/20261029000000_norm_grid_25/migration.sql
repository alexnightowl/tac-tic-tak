-- Snap every level-up ceiling ("norm") to the 25-point grid the play
-- slider and its floor (norm - 50) use. Nearest multiple; at most 12
-- points either way. Live ratings (currentPuzzleRating) stay as they are.
UPDATE "UserStyleProgression"
SET "unlockedStartRating" = (ROUND("unlockedStartRating" / 25.0) * 25)::int
WHERE "unlockedStartRating" % 25 <> 0;

-- Legacy single-style table, kept in sync for older readers.
UPDATE "UserProgression"
SET "unlockedStartRating" = (ROUND("unlockedStartRating" / 25.0) * 25)::int
WHERE "unlockedStartRating" % 25 <> 0;

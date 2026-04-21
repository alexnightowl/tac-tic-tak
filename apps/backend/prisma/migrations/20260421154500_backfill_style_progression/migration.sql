-- Backfill: seed a row per training style for every existing user,
-- copying numbers from the legacy single-row UserProgression.
INSERT INTO "UserStyleProgression"
  ("userId", "style", "startPuzzleRating", "currentPuzzleRating", "unlockedStartRating", "updatedAt")
SELECT u.id, s.style, COALESCE(p."startPuzzleRating", 1200),
       COALESCE(p."currentPuzzleRating", 1200),
       COALESCE(p."unlockedStartRating", 1200),
       NOW()
FROM "User" u
CROSS JOIN (VALUES ('bullet'), ('blitz'), ('rapid')) AS s(style)
LEFT JOIN "UserProgression" p ON p."userId" = u.id
ON CONFLICT ("userId", "style") DO NOTHING;

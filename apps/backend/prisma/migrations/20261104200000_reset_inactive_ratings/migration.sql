-- One-time data change (owner, 2026-11-04): players with no activity in the
-- last 60 days start over like a new account in every style: rating 1200
-- and a fresh 5-session calibration window. XP, streaks, achievements and
-- history stay. "Activity" is the latest of: sign-up, a training session,
-- an XP award, a seen puzzle, a Storm run, a Library attempt, a course exam
-- or an offline receipt (logins alone leave no trace in the database).
-- The deploy dumps the database before running a new migration.

CREATE TEMP TABLE "_inactive" AS
SELECT u."id"
FROM "User" u
WHERE GREATEST(
  u."createdAt",
  (SELECT MAX(t."startedAt") FROM "TrainingSession" t WHERE t."userId" = u."id"),
  (SELECT MAX(x."createdAt") FROM "XpEvent" x WHERE x."userId" = u."id"),
  (SELECT MAX(h."lastSeenAt") FROM "UserPuzzleHistory" h WHERE h."userId" = u."id"),
  (SELECT MAX(s."createdAt") FROM "StormRun" s WHERE s."userId" = u."id"),
  (SELECT MAX(l."createdAt") FROM "LibraryAttempt" l WHERE l."userId" = u."id"),
  (SELECT MAX(c."createdAt") FROM "CourseExam" c WHERE c."userId" = u."id"),
  (SELECT MAX(o."createdAt") FROM "OfflineAttemptReceipt" o WHERE o."userId" = u."id")
) < NOW() - INTERVAL '60 days';

UPDATE "UserStyleProgression" p
SET "startPuzzleRating" = 1200,
    "currentPuzzleRating" = 1200,
    "unlockedStartRating" = 1200,
    "weakSessionStreak" = 0,
    "calibrationSessionsLeft" = 5,
    "calibrationStartedAt" = NOW(),
    "level" = NULL,
    "levelGuard" = 0,
    "updatedAt" = NOW()
FROM "_inactive" i
WHERE p."userId" = i."id";

-- The legacy single-style row (pre-styles API) follows along.
UPDATE "UserProgression" p
SET "startPuzzleRating" = 1200,
    "currentPuzzleRating" = 1200,
    "unlockedStartRating" = 1200,
    "updatedAt" = NOW()
FROM "_inactive" i
WHERE p."userId" = i."id";

DROP TABLE "_inactive";

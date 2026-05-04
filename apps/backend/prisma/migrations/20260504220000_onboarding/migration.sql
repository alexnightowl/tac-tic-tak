-- Onboarding-completion flag. New accounts default to false so
-- the welcome slide-deck fires on first login. Existing users who
-- already have a finished session count as "in the loop" and get
-- flipped to true so the modal doesn't surprise-show on their
-- next visit (they don't need it).

ALTER TABLE "UserSetting"
  ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill anyone with at least one finished session.
UPDATE "UserSetting"
SET "onboardingCompleted" = true
WHERE "userId" IN (
  SELECT DISTINCT "userId" FROM "TrainingSession" WHERE "endedAt" IS NOT NULL
);

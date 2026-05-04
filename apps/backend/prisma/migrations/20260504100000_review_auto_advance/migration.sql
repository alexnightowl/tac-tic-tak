-- Per-user toggle for the review-runner's "auto-advance after a
-- solve" behaviour. Default off so existing and new users land on
-- the manual-Next flow (a tester pointed out that the previous
-- 650ms auto-advance whisked the solved position off-screen
-- before they could study it).

ALTER TABLE "UserSetting"
  ADD COLUMN "reviewAutoAdvance" BOOLEAN NOT NULL DEFAULT false;

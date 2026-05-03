-- Switch the default piece set from cburnett to maestro for new
-- signups, and migrate existing users who are still on the previous
-- default. Anyone who already picked a non-cburnett set keeps theirs
-- untouched. We can't tell apart "never changed it" from "explicitly
-- chose cburnett" since only the current value is stored — accepted
-- trade-off, that group is small.

ALTER TABLE "UserSetting" ALTER COLUMN "pieceSet" SET DEFAULT 'maestro';

UPDATE "UserSetting" SET "pieceSet" = 'maestro' WHERE "pieceSet" = 'cburnett';

-- Flip the default focus-mode setting from on to off for new
-- signups. Existing users keep whatever they have — anyone who
-- enabled it on purpose stays opted in, anyone who never touched
-- it stays in their current state (no migration of existing rows
-- by design, only the column default changes).

ALTER TABLE "UserSetting" ALTER COLUMN "focusMode" SET DEFAULT false;

-- Drop the per-user "default training style" setting. The /play
-- screen now remembers the last-played style in localStorage, so
-- a server-side preference is dead weight (and an out-of-sync one
-- if the player switches devices).

ALTER TABLE "UserSetting" DROP COLUMN "defaultStyle";

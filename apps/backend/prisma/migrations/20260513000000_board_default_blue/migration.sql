-- Default board theme is now `blue`. The previous default `green`
-- couldn't be distinguished from a deliberate green pick, so we
-- flip every row currently set to "green" — anyone who explicitly
-- wants green can repick from Settings. Non-green picks are
-- preserved as-is.

ALTER TABLE "UserSetting" ALTER COLUMN "boardTheme" SET DEFAULT 'blue';

UPDATE "UserSetting" SET "boardTheme" = 'blue' WHERE "boardTheme" = 'green';

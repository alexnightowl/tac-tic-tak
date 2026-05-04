-- Training-mode board flip. When on, the runner orients the
-- board from the opponent's side so the player has to spot
-- threats coming AT them rather than reading the position the
-- comfortable way. Move logic stays unchanged — visual only.

ALTER TABLE "UserSetting"
  ADD COLUMN "mirrorView" BOOLEAN NOT NULL DEFAULT false;

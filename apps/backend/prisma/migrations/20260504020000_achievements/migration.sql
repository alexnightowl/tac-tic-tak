-- Per-user achievement unlocks. Slug-keyed so the registry can
-- evolve (rename, retire) without breaking already-stored rows.
-- We never delete unlocked rows on registry change — old slugs
-- just stop showing up in the API list, which is fine.

CREATE TABLE "UserAchievement" (
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId", "slug")
);

CREATE INDEX "UserAchievement_userId_unlockedAt_idx"
  ON "UserAchievement"("userId", "unlockedAt");

ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Self-attested "I starred the repo" flag, driven by a button on
-- the achievements page. Trust-based — no GitHub OAuth integration.
ALTER TABLE "User" ADD COLUMN "starredRepo" BOOLEAN NOT NULL DEFAULT false;

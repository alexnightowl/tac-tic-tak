-- Removing a challenge from a player's own list (additive, nullable).
ALTER TABLE "Challenge" ADD COLUMN "challengerHiddenAt" TIMESTAMP(3),
ADD COLUMN "opponentHiddenAt" TIMESTAMP(3);

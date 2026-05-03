-- Snap existing unlock ceilings to the 50-grid so they line up
-- with the +50 unlock-reward / +50 calibration-step ladder.
-- Pre-existing rows ended up on arbitrary integers because
-- evaluateCalibration used to use the off-grid session.startRating
-- directly; that's now rounded server-side, but rows already in
-- the DB need a one-time snap to match.
--
-- Round-to-nearest. The next demote (-25) or unlock (+50) keeps
-- the ceiling on the grid going forward.

UPDATE "UserStyleProgression"
SET "unlockedStartRating" = ROUND("unlockedStartRating"::numeric / 50) * 50;

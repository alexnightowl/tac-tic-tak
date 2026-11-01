/**
 * Per-puzzle update of the style rating: Elo against the puzzle's rating.
 *
 *   step = K * (score - expected),  expected = 1 / (1 + 10^((puzzle - rating) / 400))
 *
 * A solve against a puzzle you'd be expected to solve earns little, a
 * miss against one costs a lot, and the other way round for hard ones,
 * so the rating settles where the player solves about half of the
 * puzzles at their own rating. A fast solve earns up to SPEED_BONUS
 * more; a miss always costs the plain K, so speed can't inflate the
 * rating by much (about +40 for a player who is always fast).
 *
 * The step used to average a window of attempts and reward a fast solve
 * about twice what a miss cost, which let the rating outgrow the player
 * within a session (docs/mobile/DECISIONS.md D24, D25).
 */
export type RatedAttempt = {
  correct: boolean;
  responseMs: number;
  puzzleRating: number;
};

export const RATING_K = 16;
// "Settling in": a new or recalibrating player's first sessions move
// the rating this many times faster.
export const PROVISIONAL_K_FACTOR = 2;
export const SPEED_BONUS = 0.25;
const FAST_MS = 4_000;
const SLOW_MS = 12_000;

export function expectedSolve(puzzleRating: number, rating: number): number {
  return 1 / (1 + Math.pow(10, (puzzleRating - rating) / 400));
}

// 1 at FAST_MS or quicker, 0 at SLOW_MS or slower.
function speedNorm(ms: number): number {
  const clamped = Math.max(FAST_MS, Math.min(SLOW_MS, ms));
  return 1 - (clamped - FAST_MS) / (SLOW_MS - FAST_MS);
}

export function computeRatingStep(
  currentRating: number,
  attempt: RatedAttempt,
  opts: { provisional?: boolean } = {},
): number {
  const expected = expectedSolve(attempt.puzzleRating, currentRating);
  let k = RATING_K * (opts.provisional ? PROVISIONAL_K_FACTOR : 1);
  if (attempt.correct) k *= 1 + SPEED_BONUS * speedNorm(attempt.responseMs);
  return Math.round(k * ((attempt.correct ? 1 : 0) - expected));
}

/**
 * Compact per-session stats derived from attempts.
 */
export function deriveSessionStats(attempts: {
  correct: boolean;
  responseMs: number;
  puzzleRating: number;
}[], startRating: number) {
  const solved = attempts.filter((a) => a.correct).length;
  const failed = attempts.length - solved;
  const accuracy = attempts.length === 0 ? 0 : solved / attempts.length;
  const avgResponseMs = attempts.length === 0
    ? 0
    : Math.round(attempts.reduce((s, a) => s + a.responseMs, 0) / attempts.length);
  const peakRating = attempts.reduce((m, a) => Math.max(m, a.correct ? a.puzzleRating : m), startRating);
  return { solved, failed, accuracy, avgResponseMs, peakRating };
}

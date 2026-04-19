/**
 * Adaptive rating update for the SESSION puzzle rating (not a true Elo).
 *
 * Inputs from a rolling window of the last N attempts:
 *   correct   — did the solver get it right
 *   responseMs — how fast
 *   puzzleRating — rating of the puzzle attempted
 *
 * Output: the new currentPuzzleRating.
 *
 * Algorithm intent (per spec):
 *   - correctness drives the step sign
 *   - speed scales the step (fast correct => bigger step up; slow correct => smaller)
 *   - puzzle rating vs current rating scales the step (beat a harder puzzle => bigger step)
 */
export type AttemptWindow = {
  correct: boolean;
  responseMs: number;
  puzzleRating: number;
}[];

const FAST_MS = 4_000;
const SLOW_MS = 12_000;

function speedFactor(ms: number, correct: boolean): number {
  // Faster correct attempts earn more; slower correct earn less.
  // Faster wrong attempts cost slightly less (you were guessing / acting quickly).
  const clamped = Math.max(FAST_MS, Math.min(SLOW_MS, ms));
  const norm = 1 - (clamped - FAST_MS) / (SLOW_MS - FAST_MS); // 1 at fast, 0 at slow
  if (correct) return 0.5 + norm; // 0.5..1.5
  return 0.8 - norm * 0.3;        // 0.5..0.8
}

function difficultyFactor(puzzleRating: number, currentRating: number): number {
  const delta = puzzleRating - currentRating;
  // clamp [-200, +200] -> [0.5, 1.5]
  const c = Math.max(-200, Math.min(200, delta));
  return 1 + c / 400;
}

export function computeRatingStep(currentRating: number, window: AttemptWindow): number {
  if (window.length === 0) return 0;
  let total = 0;
  const base = 12;
  for (const a of window) {
    const sign = a.correct ? 1 : -1;
    const speed = speedFactor(a.responseMs, a.correct);
    const diff = difficultyFactor(a.puzzleRating, currentRating);
    // Mistakes against easy puzzles sting more; successes vs hard puzzles reward more.
    const diffAdj = a.correct ? diff : 2 - diff;
    total += sign * base * speed * diffAdj;
  }
  // Take the average so the magnitude is independent of window size.
  return Math.round(total / window.length);
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

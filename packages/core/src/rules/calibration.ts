// Verbatim copy of apps/backend/src/sessions/calibration.ts. Do not edit here
// without editing the backend too: test/parity.test.ts fails on drift.

// Calibration placement: where a new (or recalibrating) player's norm
// lands after each session of the calibration window.
//
// 1. Fit the player's puzzle rating to every attempt of the window
//    (estimatePerformance), and their response time against puzzle
//    difficulty (fitResponseTime).
// 2. Replay sessions with that model under the real rules: the buffer's
//    rating mix, the per-puzzle rating step, the unlock criteria.
// 3. The norm is the highest 25-grid start from which a session levels
//    up at least CALIBRATION_LEVEL_UP_ODDS of the time. The first raise
//    should feel within reach, not like a wall.
//
// Deterministic (fixed seed) so a window always places the same norm.

import { computeRatingStep, deriveSessionStats } from './rating';
import { evaluateUnlock } from './unlock';
import type { TrainingStyle } from './unlock';

// Calibration sessions start this far below the fitted rating, so the
// player meets mostly solvable puzzles while the fit still sees the
// harder ones the buffer mixes in.
export const CALIBRATION_PROBE_BELOW = 75;
// A session's start may rise at most this much over the previous one,
// since a flawless run has no upper bound in the fit.
export const CALIBRATION_PROBE_MAX_RISE = 200;
// Share of sessions started at the norm that must meet all three
// unlock criteria.
export const CALIBRATION_LEVEL_UP_ODDS = 0.6;
// The norm search stops this far below the fitted rating.
const MAX_SEARCH_DEPTH = 800;

// Logistic scale of puzzle ratings: 400 points = 10:1 odds.
const ELO_SCALE = 400;
const SIM_SESSIONS = 200;
const SIM_SEED = 0x5eed;
// Session clock spent between puzzles: feedback and the opponent's move.
const BETWEEN_PUZZLES_MS = 1000;
// Mirrors PuzzleBufferService.preload: one refill of 12 puzzles, rating
// bands relative to the live rating, refilled at REFILL_BELOW left.
const BUFFER_BANDS = [
  { count: 7, min: -40, max: 60 },
  { count: 3, min: -120, max: -40 },
  { count: 2, min: 60, max: 180 },
];
const REFILL_BELOW = 6;
const MIN_RATING = 400;
const MAX_RATING = 3000;

export type CalibrationAttempt = {
  correct: boolean;
  responseMs: number;
  puzzleRating: number;
};

export type ResponseTimeModel = {
  // ln(ms) at a puzzle of the player's own rating.
  logMsAtLevel: number;
  // d ln(ms) / d rating: harder puzzles take longer.
  slope: number;
  sigma: number;
};

function expectedScore(puzzleRating: number, rating: number): number {
  return 1 / (1 + Math.pow(10, (puzzleRating - rating) / ELO_SCALE));
}

/**
 * Maximum-likelihood puzzle rating: the rating at which the expected
 * solves over `attempts` add up to the actual ones. One solve and one
 * miss at `prior` keep a flawless or a hopeless run finite.
 */
export function estimatePerformance(attempts: CalibrationAttempt[], prior: number): number {
  const points = [
    { rating: prior, score: 1 },
    { rating: prior, score: 0 },
    ...attempts.map((a) => ({ rating: a.puzzleRating, score: a.correct ? 1 : 0 })),
  ];
  const actual = points.reduce((sum, p) => sum + p.score, 0);
  // Expected solves rise with the rating, so bisect for the crossing.
  let lo = 0;
  let hi = 4000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const expected = points.reduce((sum, p) => sum + expectedScore(p.rating, mid), 0);
    if (expected < actual) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

/** Least-squares fit of ln(responseMs) on the puzzle's offset from `performance`. */
export function fitResponseTime(attempts: CalibrationAttempt[], performance: number): ResponseTimeModel {
  const pts = attempts
    .filter((a) => a.responseMs > 0)
    .map((a) => ({ x: a.puzzleRating - performance, y: Math.log(a.responseMs) }));
  if (pts.length < 5) return { logMsAtLevel: Math.log(10_000), slope: Math.LN2 / 300, sigma: 0.4 };
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  // Clamp to "no slower on harder puzzles" .. "twice as slow per 150".
  const slope = Math.max(0, Math.min(Math.LN2 / 150, sxx > 0 ? sxy / sxx : 0));
  const logMsAtLevel = my - slope * mx;
  const resid = pts.reduce((s, p) => s + (p.y - logMsAtLevel - slope * p.x) ** 2, 0) / n;
  return { logMsAtLevel, slope, sigma: Math.min(1, Math.sqrt(resid)) };
}

// mulberry32
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

/** Share of simulated sessions started at `start` that meet all unlock criteria. */
export function levelUpOdds(
  style: TrainingStyle,
  performance: number,
  time: ResponseTimeModel,
  start: number,
  durationSec: number,
): number {
  const rand = seededRandom(SIM_SEED);
  const limitMs = durationSec * 1000;
  let met = 0;
  for (let s = 0; s < SIM_SESSIONS; s++) {
    let live = start;
    let clock = 0;
    const queue: number[] = [];
    const attempts: CalibrationAttempt[] = [];
    const refill = () => {
      for (const b of BUFFER_BANDS) {
        for (let i = 0; i < b.count; i++) queue.push(live + b.min + rand() * (b.max - b.min));
      }
    };
    refill();
    for (;;) {
      const puzzleRating = Math.round(queue.shift() as number);
      if (queue.length <= REFILL_BELOW) refill();
      const responseMs = Math.exp(
        time.logMsAtLevel + time.slope * (puzzleRating - performance) + time.sigma * gaussian(rand),
      );
      // A puzzle still on the board when the clock runs out isn't recorded.
      if (clock + responseMs > limitMs) break;
      clock += responseMs + BETWEEN_PUZZLES_MS;
      const correct = rand() < expectedScore(puzzleRating, performance);
      attempts.push({ correct, responseMs, puzzleRating });
      const step = computeRatingStep(live, { correct, responseMs, puzzleRating });
      live = Math.max(MIN_RATING, Math.min(MAX_RATING, live + step));
    }
    if (evaluateUnlock(style, deriveSessionStats(attempts, start), durationSec, start).met) met++;
  }
  return met / SIM_SESSIONS;
}

/**
 * The norm a calibration window places, or null with no attempts yet.
 * Never above the hardest puzzle solved in the window.
 */
export function calibrationNorm(
  style: TrainingStyle,
  attempts: CalibrationAttempt[],
  anchor: number,
  durationSec: number,
): { target: number | null; performance: number } {
  const performance = estimatePerformance(attempts, anchor);
  if (attempts.length === 0) return { target: null, performance };
  const time = fitResponseTime(attempts, performance);
  const hardestSolved = attempts.reduce(
    (m, a) => (a.correct ? Math.max(m, a.puzzleRating) : m),
    -Infinity,
  );
  // Nothing solved: as low as the norm goes.
  if (!Number.isFinite(hardestSolved)) return { target: MIN_RATING, performance };
  const top = Math.floor(Math.min(performance, hardestSolved) / 25) * 25;
  const bottom = performance - MAX_SEARCH_DEPTH;
  let n = top;
  while (n > bottom && levelUpOdds(style, performance, time, n, durationSec) < CALIBRATION_LEVEL_UP_ODDS) {
    n -= 25;
  }
  return { target: n, performance };
}

/**
 * Start rating of a calibration session. `anchor` is the rating the
 * window opened at; `prevStart` is the previous calibration session's
 * start, if any.
 */
export function calibrationProbe(
  attempts: CalibrationAttempt[],
  anchor: number,
  prevStart: number | null,
): number {
  let probe = estimatePerformance(attempts, anchor) - CALIBRATION_PROBE_BELOW;
  if (prevStart !== null) probe = Math.min(probe, prevStart + CALIBRATION_PROBE_MAX_RISE);
  return Math.max(MIN_RATING, Math.round(probe / 25) * 25);
}

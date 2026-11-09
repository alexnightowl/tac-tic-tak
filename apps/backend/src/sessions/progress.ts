// Play v2 progression: levels that follow the rating, and experience.
//
// Level: the style rating in steps of LEVEL_STEP. It rises when a finished
// rated session ends above the next mark and solved the style's pace
// target (paceTarget, D37: the time control's character), and it is protected
// on the way down: it drops only after LEVEL_GUARD_SESSIONS rated
// sessions in a row end more than LEVEL_GUARD_GAP under it.
//
// Experience (XP): effort, never lost. Earned for minutes trained (any
// mode) and mistakes cleared from Review. XP levels grow on a curve,
// XP ranks are chess pieces.

import type { TrainingStyle } from './unlock';

export const LEVEL_STEP = 50;
export const LEVEL_GUARD_GAP = 50;
export const LEVEL_GUARD_SESSIONS = 2;

export function levelOf(rating: number): number {
  return Math.floor(rating / LEVEL_STEP) * LEVEL_STEP;
}

/**
 * Level of a progression that never finished a v2 session: the earned
 * norm when it is lower than the rating, so the first level-ups come
 * from play rather than from the old rating step's drift.
 */
export function initialLevel(currentRating: number, norm: number): number {
  return Math.min(levelOf(currentRating), levelOf(norm));
}

// ---- Pace (D37) -----------------------------------------------------------
//
// A time control is a budget of thinking time per puzzle. A session of
// `durationSec` fits durationSec / (PACE_SECONDS + PACE_TRANSITION_S)
// attempts; at PACE_ACCURACY (puzzles come at the player's rating, so a
// player due a level-up solves a bit over half) that many solves are
// expected. The target sits PACE_Z standard deviations (binomial) under
// that mean, so a player keeping the style's pace meets it in about 3 of 4
// sessions: short bullet sessions are luckier or unluckier than long ones.

export const PACE_SECONDS: Record<TrainingStyle, number> = { bullet: 5, blitz: 12, rapid: 30 };
/** Clock time between puzzles (the reply delay and the opponent's set-up move). */
export const PACE_TRANSITION_S = 1;
export const PACE_ACCURACY = 0.6;
const PACE_Z = 0.67;

export function paceTarget(style: TrainingStyle, durationSec: number): number {
  const attempts = durationSec / (PACE_SECONDS[style] + PACE_TRANSITION_S);
  const mean = attempts * PACE_ACCURACY;
  const sd = Math.sqrt(attempts * PACE_ACCURACY * (1 - PACE_ACCURACY));
  return Math.max(1, Math.round(mean - PACE_Z * sd));
}

export type PaceCheck = { solved: number; target: number; met: boolean };

export type LevelCheck = {
  before: number;
  after: number;
  up: boolean;
  down: boolean;
  // Sessions in a row that ended under the guard line, after this one.
  guardBefore: number;
  guardAfter: number;
  guardThreshold: number;
  next: number;
  // The session's pace against its target (null: not checked).
  pace: PaceCheck | null;
  // The rating cleared the next mark but the pace fell short: no level-up.
  paceHeld: boolean;
};

export function evaluateLevel(
  level: number,
  ratingAfter: number,
  guard: number,
  pace?: { solved: number; target: number },
): LevelCheck {
  const reached = levelOf(ratingAfter);
  const paceCheck = pace ? { ...pace, met: pace.solved >= pace.target } : null;
  let after = level;
  let guardAfter = 0;
  if (reached > level) {
    if (!paceCheck || paceCheck.met) after = reached;
  } else if (ratingAfter < level - LEVEL_GUARD_GAP) {
    guardAfter = guard + 1;
    if (guardAfter >= LEVEL_GUARD_SESSIONS) {
      after = reached;
      guardAfter = 0;
    }
  }
  return {
    before: level,
    after,
    up: after > level,
    down: after < level,
    guardBefore: guard,
    guardAfter,
    guardThreshold: LEVEL_GUARD_SESSIONS,
    next: after + LEVEL_STEP,
    pace: paceCheck,
    paceHeld: reached > level && after === level,
  };
}

export const XP_PER_MINUTE = 2;
export const XP_PER_REVIEW = 15;

/** XP for active training time: whole minutes only. */
export function trainingXp(activeMs: number): number {
  return Math.floor(Math.max(0, activeMs) / 60_000) * XP_PER_MINUTE;
}

// XP level L starts at 100 * L * (L - 1): 0, 200, 600, 1200, 2000, ...
export function xpForLevel(level: number): number {
  return 100 * level * (level - 1);
}

export function xpLevel(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + Math.max(0, xp) / 25)) / 2));
}

export type XpRankKey = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export const XP_RANKS: ReadonlyArray<{ key: XpRankKey; xp: number }> = [
  { key: 'pawn', xp: 0 },
  { key: 'knight', xp: 3_000 },
  { key: 'bishop', xp: 6_000 },
  { key: 'rook', xp: 12_000 },
  { key: 'queen', xp: 25_000 },
  { key: 'king', xp: 50_000 },
];

export type XpStanding = {
  xp: number;
  level: number;
  levelXp: number;
  nextLevelXp: number;
  rank: XpRankKey;
  rankXp: number;
  nextRank: XpRankKey | null;
  nextRankXp: number | null;
};

export function xpStanding(xp: number): XpStanding {
  const level = xpLevel(xp);
  let i = 0;
  while (i + 1 < XP_RANKS.length && xp >= XP_RANKS[i + 1].xp) i++;
  const next = XP_RANKS[i + 1] ?? null;
  return {
    xp,
    level,
    levelXp: xpForLevel(level),
    nextLevelXp: xpForLevel(level + 1),
    rank: XP_RANKS[i].key,
    rankXp: XP_RANKS[i].xp,
    nextRank: next ? next.key : null,
    nextRankXp: next ? next.xp : null,
  };
}

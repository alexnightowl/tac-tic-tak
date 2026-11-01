// Verbatim copy of apps/backend/src/sessions/progress.ts. Do not edit here
// without editing the backend too: test/parity.test.ts fails on drift.

// Play v2 progression: levels that follow the rating, and experience.
//
// Level: the style rating in steps of LEVEL_STEP. It rises as soon as a
// finished rated session ends above the next mark, and it is protected
// on the way down: it drops only after LEVEL_GUARD_SESSIONS rated
// sessions in a row end more than LEVEL_GUARD_GAP under it.
//
// Experience (XP): effort, never lost. Earned for minutes trained (any
// mode) and mistakes cleared from Review. XP levels grow on a curve,
// XP ranks are chess pieces.

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
};

export function evaluateLevel(level: number, ratingAfter: number, guard: number): LevelCheck {
  const reached = levelOf(ratingAfter);
  let after = level;
  let guardAfter = 0;
  if (reached > level) {
    after = reached;
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

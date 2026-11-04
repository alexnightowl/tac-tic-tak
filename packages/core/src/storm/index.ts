// Puzzle Storm and the async Race (docs/mobile/STORM.md): one run engine
// for both, the stream's difficulty ladder, the race verdict and the wire
// types of /storm and /challenges. A run is a stream of rising puzzles
// against a clock that never pauses: correct moves build a combo whose
// level buys time on every move and every solve, a mistake costs a life
// (and 10 s) and the combo, three mistakes end it.
import type { XpAward } from '../api/types';

export type StormFormat = 'time3' | 'time5' | 'survival';
export const STORM_FORMATS: readonly StormFormat[] = ['time3', 'time5', 'survival'];

export const STORM_LIVES = 3;
export const STORM_MISTAKE_MS = 10_000;
export const STORM_STREAM_LENGTH = 100;
/** Solo Storm's ladder starts here for everyone, so friends' scores compare. */
export const STORM_SOLO_BASE = 1000;
export const STORM_NOTE_MAX = 80;
/** How long a sent challenge waits for the friend. */
export const CHALLENGE_TTL_MS = 24 * 3600_000;

/** The clock of a format in ms; null for Survival (no clock). */
export function stormClockMs(format: StormFormat): number | null {
  return format === 'time3' ? 180_000 : format === 'time5' ? 300_000 : null;
}

/**
 * Combo levels (owner, 2026-11-04, "like Lichess"): the combo counts correct
 * moves in a row. From level 1 every correct move and every solve buy time;
 * the max level buys +3 s a move and +5 s a solve. A solve's last move earns
 * the solve bonus only. Level i starts at STORM_COMBO_LEVELS[i] moves.
 */
export const STORM_COMBO_LEVELS = [0, 5, 12, 20] as const;
export const STORM_COMBO_BONUS: readonly { moveMs: number; solveMs: number }[] = [
  { moveMs: 0, solveMs: 0 },
  { moveMs: 1_000, solveMs: 3_000 },
  { moveMs: 2_000, solveMs: 4_000 },
  { moveMs: 3_000, solveMs: 5_000 },
];
export const STORM_MAX_LEVEL = STORM_COMBO_LEVELS.length - 1;

/** The level a combo (correct moves in a row) has reached, 0..STORM_MAX_LEVEL. */
export function comboLevel(combo: number): number {
  let level = 0;
  for (let i = 1; i < STORM_COMBO_LEVELS.length; i++) if (combo >= STORM_COMBO_LEVELS[i]) level = i;
  return level;
}

/** Time a correct non-final move buys once the combo has reached `combo`. */
export function moveBonusMs(combo: number): number {
  return STORM_COMBO_BONUS[comboLevel(combo)].moveMs;
}

/** Time a solve buys once the combo has reached `combo`. */
export function solveBonusMs(combo: number): number {
  return STORM_COMBO_BONUS[comboLevel(combo)].solveMs;
}

/**
 * The combo bar: the level, the progress (0..1) towards the next one, the
 * combo where it starts (null at the max) and that level's bonuses.
 */
export function comboBar(combo: number): {
  level: number;
  progress: number;
  nextAt: number | null;
  next: { moveMs: number; solveMs: number } | null;
} {
  const level = comboLevel(combo);
  if (level >= STORM_MAX_LEVEL) return { level, progress: 1, nextAt: null, next: null };
  const from = STORM_COMBO_LEVELS[level];
  const to = STORM_COMBO_LEVELS[level + 1];
  return { level, progress: (combo - from) / (to - from), nextAt: to, next: STORM_COMBO_BONUS[level + 1] };
}

/** Target rating of the i-th puzzle (0-based) of a stream from `base`. */
export function stormLadder(i: number, base: number): number {
  return Math.round((base + 1600 * (1 - Math.exp(-i / 50))) / 10) * 10;
}

/** The Race's base from both players' ratings (also shown as "~avg"). */
export function raceBase(a: number, b: number): { base: number; avg: number } {
  const avg = Math.round((a + b) / 2);
  const base = Math.min(1800, Math.max(600, Math.round((avg - 600) / 10) * 10));
  return { base, avg };
}

// ─── Run engine ──────────────────────────────────────────────────────────

/** One answered puzzle: its index in the stream, solved or not, time spent. */
export type StormResult = { i: number; ok: boolean; ms: number };

export type StormEnd = 'time' | 'lives' | 'quit' | 'stream';

export type StormState = {
  format: StormFormat;
  streamLength: number;
  /** Epoch ms of the first puzzle; null before 'start'. */
  startedAt: number | null;
  /** Net time added to the clock: combo bonuses minus mistake penalties. */
  extraMs: number;
  lives: number;
  /** Correct moves in a row (a mistake resets it). */
  combo: number;
  bestCombo: number;
  score: number;
  mistakes: number;
  /** The stream index of the puzzle on the board. */
  index: number;
  /** When the current puzzle came up (epoch ms). */
  puzzleAt: number;
  results: StormResult[];
  /** Ms from the start to the last solve (the Race tie-break); 0 before one. */
  lastSolveMs: number;
  ended: StormEnd | null;
  endedAt: number | null;
};

export type StormEvent =
  | { type: 'start'; at: number }
  /** A correct move that does not finish the puzzle. */
  | { type: 'move'; at: number }
  | { type: 'solve'; at: number }
  | { type: 'miss'; at: number }
  | { type: 'quit'; at: number }
  /** A clock check (a tick, or coming back from the background). */
  | { type: 'tick'; at: number };

export function stormInit(format: StormFormat, streamLength = STORM_STREAM_LENGTH): StormState {
  return {
    format,
    streamLength,
    startedAt: null,
    extraMs: 0,
    lives: STORM_LIVES,
    combo: 0,
    bestCombo: 0,
    score: 0,
    mistakes: 0,
    index: 0,
    puzzleAt: 0,
    results: [],
    lastSolveMs: 0,
    ended: null,
    endedAt: null,
  };
}

/** Ms left on the clock at `now` (never below 0); null for Survival. */
export function stormClock(s: StormState, now: number): number | null {
  const total = stormClockMs(s.format);
  if (total == null) return null;
  if (s.startedAt == null) return total;
  const at = s.ended ? (s.endedAt ?? now) : now;
  return Math.max(0, total + s.extraMs - (at - s.startedAt));
}

/** The moment the clock runs out (epoch ms), or null (Survival / not started). */
function deadline(s: StormState): number | null {
  const total = stormClockMs(s.format);
  if (total == null || s.startedAt == null) return null;
  return s.startedAt + total + s.extraMs;
}

function end(s: StormState, reason: StormEnd, at: number): StormState {
  return { ...s, ended: reason, endedAt: at };
}

export function stormReduce(s: StormState, e: StormEvent): StormState {
  if (s.ended) return s;
  if (e.type === 'start') {
    return s.startedAt == null ? { ...s, startedAt: e.at, puzzleAt: e.at } : s;
  }
  if (s.startedAt == null) return s;
  // The clock ran out before this event: the run ended at the deadline and
  // an answer given after it does not count.
  const dl = deadline(s);
  if (dl != null && e.at >= dl) return end(s, 'time', dl);
  if (e.type === 'tick') return s;
  if (e.type === 'quit') return end(s, 'quit', e.at);
  if (e.type === 'move') {
    const combo = s.combo + 1;
    const timed = stormClockMs(s.format) != null;
    return { ...s, combo, bestCombo: Math.max(s.bestCombo, combo), extraMs: s.extraMs + (timed ? moveBonusMs(combo) : 0) };
  }

  const ms = Math.max(0, e.at - s.puzzleAt);
  const timed = stormClockMs(s.format) != null;
  const results = [...s.results, { i: s.index, ok: e.type === 'solve', ms }];
  let next: StormState;
  if (e.type === 'solve') {
    const combo = s.combo + 1;
    next = {
      ...s,
      results,
      score: s.score + 1,
      combo,
      bestCombo: Math.max(s.bestCombo, combo),
      extraMs: s.extraMs + (timed ? solveBonusMs(combo) : 0),
      lastSolveMs: e.at - s.startedAt,
    };
  } else {
    next = {
      ...s,
      results,
      mistakes: s.mistakes + 1,
      lives: s.lives - 1,
      combo: 0,
      extraMs: s.extraMs - (timed ? STORM_MISTAKE_MS : 0),
    };
  }
  next = { ...next, index: s.index + 1, puzzleAt: e.at };
  if (next.lives <= 0) return end(next, 'lives', e.at);
  const after = deadline(next);
  if (after != null && e.at >= after) return end(next, 'time', after);
  if (next.index >= next.streamLength) return end(next, 'stream', e.at);
  return next;
}

/** Ms the run lasted (start → end, or → now while running). */
export function stormDuration(s: StormState, now: number): number {
  if (s.startedAt == null) return 0;
  return Math.max(0, (s.endedAt ?? now) - s.startedAt);
}

/** Solved / answered, 0..1 (1 before any answer). */
export function stormAccuracy(score: number, mistakes: number): number {
  return score + mistakes === 0 ? 1 : score / (score + mistakes);
}

/** The highest rating among the solved puzzles, or null. */
export function hardestSolved(results: readonly StormResult[], ratings: readonly number[]): number | null {
  let best: number | null = null;
  for (const r of results) if (r.ok && ratings[r.i] != null && (best == null || ratings[r.i] > best)) best = ratings[r.i];
  return best;
}

// ─── Race verdict ────────────────────────────────────────────────────────

export type RaceVerdict = 'win' | 'loss' | 'draw';

/** More solved wins; a tie goes to the earlier last solve; else a draw. */
export function raceVerdict(
  me: { score: number; lastSolveMs: number },
  them: { score: number; lastSolveMs: number },
): { verdict: RaceVerdict; byTime: boolean } {
  if (me.score !== them.score) return { verdict: me.score > them.score ? 'win' : 'loss', byTime: false };
  if (me.score === 0 || me.lastSolveMs === them.lastSolveMs) return { verdict: 'draw', byTime: false };
  return { verdict: me.lastSolveMs < them.lastSolveMs ? 'win' : 'loss', byTime: true };
}

// ─── Wire types ──────────────────────────────────────────────────────────

export type StormPuzzle = { id: string; fen: string; moves: string[]; rating: number; themes: string[] };

/** POST /storm/streams, GET /storm/streams/:id */
export type StormStreamResponse = { streamId: string; base: number; puzzles: StormPuzzle[] };

/** POST /storm/runs */
export type StormRunBody = {
  clientId: string;
  streamId: string;
  format: StormFormat;
  challengeId?: string;
  score: number;
  mistakes: number;
  bestCombo: number;
  durationMs: number;
  lastSolveMs: number;
  results: StormResult[];
  /** Local 'YYYY-MM-DD' of the run (the streak). */
  localDay?: string;
  tzOffsetMin?: number;
};

export type StormBest = { score: number; at: string };

export type StormRunSaved = {
  runId: string;
  /** Solo runs only: the best before this run (null: the first run). */
  previousBest: StormBest | null;
  isBest: boolean;
  /** Solo runs only: 1-based place among friends this week, and how many ranked. */
  friendsRank: number | null;
  friendsCount: number;
  xp: XpAward | null;
  streak: { days: number; outcome: string } | null;
  /** Race runs: the challenge after this run. */
  challenge?: ChallengeSummary;
};

export type StormUser = { id: string; nickname: string; displayName: string | null; avatarUrl: string | null };

export type StormWeekRow = { user: StormUser; score: number; me: boolean };

/** GET /storm/summary?tzOffsetMin */
export type StormSummary = {
  best: StormBest | null;
  today: { best: number; runs: number };
  /** Me and my friends, best solo score since Monday (local), highest first; players without a run are left out. */
  week: StormWeekRow[];
};

// ─── Challenges ──────────────────────────────────────────────────────────

/** `cancelled`: withdrawn by the challenger before the friend played. */
export type ChallengeStatus = 'draft' | 'pending' | 'declined' | 'cancelled' | 'expired' | 'finished';

export type ChallengeUser = StormUser & { rating: number };

export type ChallengeRun = {
  score: number;
  mistakes: number;
  bestCombo: number;
  durationMs: number;
  lastSolveMs: number;
  hardest: number | null;
  results: StormResult[];
};

export type ChallengeSummary = {
  id: string;
  format: StormFormat;
  status: ChallengeStatus;
  /** Who I am in it. */
  role: 'challenger' | 'opponent';
  /** The other player. */
  other: ChallengeUser;
  note: string | null;
  /** Scores once played (null: not yet). */
  myScore: number | null;
  theirScore: number | null;
  /** Finished only. */
  verdict: RaceVerdict | null;
  byTime: boolean;
  createdAt: string;
  /** When a pending challenge lapses (null while a draft). */
  expiresAt: string | null;
};

/** GET /challenges */
export type ChallengeList = {
  /** Pending, waiting for my run. */
  incoming: ChallengeSummary[];
  /** Pending, sent by me. */
  outgoing: ChallengeSummary[];
  /** Finished, declined or expired, newest first (last 10). */
  finished: ChallengeSummary[];
};

/** GET /challenges/:id */
export type ChallengeDetail = ChallengeSummary & {
  streamId: string;
  avgRating: number;
  me: ChallengeUser;
  /** Ratings of the stream's puzzles, by index. */
  ratings: number[];
  myRun: ChallengeRun | null;
  theirRun: ChallengeRun | null;
};

/** POST /challenges */
export type ChallengeCreateBody = { opponentId: string; format: StormFormat; note?: string; runId?: string };
export type ChallengeCreated = { challenge: ChallengeSummary; stream: StormStreamResponse | null };

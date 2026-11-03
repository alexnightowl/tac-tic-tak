// Puzzle Storm and the async Race (docs/mobile/STORM.md): one run engine
// for both, the stream's difficulty ladder, the race verdict and the wire
// types of /storm and /challenges. A run is a stream of rising puzzles
// against a clock that never pauses: solves build a combo that buys
// time, a mistake costs a life (and 10 s), three mistakes end it.
import type { XpAward } from '../api/types';

export type StormFormat = 'time3' | 'time5' | 'survival';
export const STORM_FORMATS: readonly StormFormat[] = ['time3', 'time5', 'survival'];

export const STORM_LIVES = 3;
export const STORM_MISTAKE_MS = 10_000;
export const STORM_STREAM_LENGTH = 100;
/** Solo Storm's ladder starts here for everyone, so friends' scores compare. */
export const STORM_SOLO_BASE = 1000;
/** Steps of the combo bar; the bonuses repeat every this many solves. */
export const STORM_COMBO_STEPS = 10;
export const STORM_NOTE_MAX = 80;
/** How long a sent challenge waits for the friend. */
export const CHALLENGE_TTL_MS = 24 * 3600_000;

/** The clock of a format in ms; null for Survival (no clock). */
export function stormClockMs(format: StormFormat): number | null {
  return format === 'time3' ? 180_000 : format === 'time5' ? 300_000 : null;
}

/** Time bought by reaching this combo: +3 s at 5, 15, 25…; +5 s at 10, 20, 30…; else 0. */
export function comboBonusMs(combo: number): number {
  if (combo <= 0) return 0;
  const r = combo % STORM_COMBO_STEPS;
  return r === 0 ? 5_000 : r === 5 ? 3_000 : 0;
}

/** The combo bar: filled steps (1..10 while a combo runs) and the next bonus. */
export function comboBar(combo: number): { filled: number; nextAt: number; nextBonusMs: number } {
  const filled = combo === 0 ? 0 : ((combo - 1) % STORM_COMBO_STEPS) + 1;
  const nextAt = filled < 5 ? 5 : 10;
  return { filled, nextAt, nextBonusMs: nextAt === 5 ? 3_000 : 5_000 };
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
      extraMs: s.extraMs + (timed ? comboBonusMs(combo) : 0),
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

export type ChallengeStatus = 'draft' | 'pending' | 'declined' | 'expired' | 'finished';

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

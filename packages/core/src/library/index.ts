// Library (docs/mobile/LIBRARY.md): books of puzzles from old master
// games, solved chapter by chapter in cycles. The wire types of
// /library/*, and the pure progress, cycle and target arithmetic the
// mobile store and screens run on. Nothing here is rated.
import type { XpAward } from '../api/types';

export type Localized = { en: string; uk: string };

export type LibraryCover = 'parchment' | 'oxblood';
export type LibraryResult = 'clean' | 'hint' | 'missed';

export type LibraryChapterSummary = { id: string; title: Localized; subtitle: Localized; count: number; puzzleIds: string[] };

/** GET /library/books → { books } */
export type LibraryBookSummary = {
  id: string;
  version: number;
  title: Localized;
  authors: Localized;
  players: Localized;
  era: Localized;
  description: Localized;
  cover: LibraryCover;
  coverPiece: string;
  puzzleCount: number;
  ratingMin: number;
  ratingMax: number;
  minutesPerCycle: number;
  chapters: LibraryChapterSummary[];
};

export type LibraryGame = {
  white: string;
  black: string;
  event?: string;
  site?: string;
  year: number;
  date?: string;
  result?: string;
  source?: string;
};

export type LibraryPuzzle = {
  id: string;
  fen: string;
  /** UCI; the first is the opponent's setup move. */
  moves: string[];
  rating: number;
  themes: string[];
  goal: 'mate' | 'win';
  mateIn: number | null;
  game: LibraryGame;
  note: Localized;
};

export type LibraryChapter = LibraryChapterSummary & { puzzles: LibraryPuzzle[] };

/** GET /library/books/:id — what a download stores. */
export type LibraryBook = Omit<LibraryBookSummary, 'chapters'> & { chapters: LibraryChapter[] };

/** One result as the server keeps it (GET /library/progress). */
export type LibraryAttemptRecord = {
  bookId: string;
  puzzleId: string;
  cycle: number;
  result: LibraryResult;
  timeMs: number;
  /** ISO. */
  solvedAt: string;
};

/** A result on the phone, queued until POST /library/sync takes it. */
export type LibraryPendingAttempt = LibraryAttemptRecord & {
  clientId: string;
  /** The player's 'YYYY-MM-DD' when solved: library days count for the streak. */
  localDay?: string;
};

export type LibrarySyncBody = { tzOffsetMin: number; attempts: LibraryPendingAttempt[] };
export type LibrarySyncResponse = {
  accepted: number;
  duplicates: number;
  unknown: number;
  reviewAdded: number;
  xp: XpAward | null;
  /** The streak after the days played (null when no day was sent). */
  streak: { days: number; outcome: string } | null;
};

export const LIBRARY_SYNC_BATCH = 500;
/** Server cap on one puzzle's time. */
export const LIBRARY_MAX_TIME_MS = 30 * 60 * 1000;

export const localized = (l: Localized, lang: string) => (lang === 'uk' ? l.uk : l.en);

// ─── Results ─────────────────────────────────────────────────────────────

/**
 * Every result the player has, server and phone merged: the first result
 * for a puzzle in a cycle wins (the server keeps the same one, since a
 * second result for that cycle is dropped there too).
 */
export function mergeAttempts(server: readonly LibraryAttemptRecord[], pending: readonly LibraryAttemptRecord[]): LibraryAttemptRecord[] {
  const out = new Map<string, LibraryAttemptRecord>();
  const all = [...server, ...pending].sort((a, b) => a.solvedAt.localeCompare(b.solvedAt));
  for (const a of all) {
    const k = `${a.puzzleId}|${a.cycle}`;
    if (!out.has(k)) out.set(k, a);
  }
  return [...out.values()];
}

// ─── Progress ────────────────────────────────────────────────────────────

/** The book's shape the progress needs; a summary and a stored book both are one. */
export type BookShape = { id: string; chapters: { id: string; puzzleIds: string[] }[] };

export type CycleStats = {
  cycle: number;
  done: number;
  total: number;
  clean: number;
  /** Average seconds per puzzle, rounded; null before the first result. */
  avgSec: number | null;
  complete: boolean;
};

export type ChapterProgress = {
  id: string;
  index: number;
  total: number;
  /** Results in the current cycle. */
  done: number;
  complete: boolean;
};

export type BookProgress = {
  /** The cycle being read: the highest with a result (1 before any). */
  cycle: number;
  /** Every puzzle of the current cycle has a result. */
  cycleComplete: boolean;
  /** At least one whole cycle done. */
  finishedOnce: boolean;
  started: boolean;
  done: number;
  total: number;
  chapters: ChapterProgress[];
  /** The next puzzle in book order without a result this cycle (null when complete). */
  next: { chapterIndex: number; puzzleIndex: number; puzzleId: string } | null;
  cycles: CycleStats[];
};

const avgSecOf = (rs: readonly LibraryAttemptRecord[]) =>
  rs.length === 0 ? null : Math.round(rs.reduce((s, r) => s + r.timeMs, 0) / rs.length / 1000);

export function bookProgress(book: BookShape, attempts: readonly LibraryAttemptRecord[]): BookProgress {
  const ids = new Set(book.chapters.flatMap((c) => c.puzzleIds));
  const mine = attempts.filter((a) => a.bookId === book.id && ids.has(a.puzzleId));
  const total = ids.size;
  const maxCycle = mine.reduce((m, a) => Math.max(m, a.cycle), 0);
  const cycle = Math.max(1, maxCycle);

  const cycles: CycleStats[] = [];
  for (let n = 1; n <= cycle; n++) {
    const rs = mine.filter((a) => a.cycle === n);
    const done = new Set(rs.map((r) => r.puzzleId)).size;
    cycles.push({ cycle: n, done, total, clean: rs.filter((r) => r.result === 'clean').length, avgSec: avgSecOf(rs), complete: total > 0 && done >= total });
  }

  const current = new Set(mine.filter((a) => a.cycle === cycle).map((a) => a.puzzleId));
  let next: BookProgress['next'] = null;
  const chapters = book.chapters.map((c, index) => {
    const done = c.puzzleIds.filter((id) => current.has(id)).length;
    if (!next) {
      const puzzleIndex = c.puzzleIds.findIndex((id) => !current.has(id));
      if (puzzleIndex >= 0) next = { chapterIndex: index, puzzleIndex, puzzleId: c.puzzleIds[puzzleIndex] };
    }
    return { id: c.id, index, total: c.puzzleIds.length, done, complete: done >= c.puzzleIds.length };
  });

  const cycleComplete = total > 0 && current.size >= total;
  return {
    cycle,
    cycleComplete,
    finishedOnce: cycles.some((c) => c.complete),
    started: mine.length > 0,
    done: current.size,
    total,
    chapters,
    next,
    cycles,
  };
}

/** A chapter's numbers for one cycle (the chapter-complete comparison). */
export type ChapterCycleStats = {
  cycle: number;
  done: number;
  total: number;
  clean: number;
  missed: number;
  avgSec: number | null;
  /** Seconds per puzzle in chapter order (null: no result). */
  times: (number | null)[];
  /** When the chapter's first result of this cycle was played (ISO). */
  startedAt: string | null;
};

export function chapterCycleStats(
  bookId: string,
  puzzleIds: readonly string[],
  attempts: readonly LibraryAttemptRecord[],
  cycle: number,
): ChapterCycleStats {
  const byId = new Map<string, LibraryAttemptRecord>();
  for (const a of attempts) {
    if (a.bookId === bookId && a.cycle === cycle && !byId.has(a.puzzleId)) byId.set(a.puzzleId, a);
  }
  const rs = puzzleIds.map((id) => byId.get(id)).filter((r): r is LibraryAttemptRecord => !!r);
  const startedAt = rs.reduce<string | null>((m, r) => (m == null || r.solvedAt < m ? r.solvedAt : m), null);
  return {
    cycle,
    done: rs.length,
    total: puzzleIds.length,
    clean: rs.filter((r) => r.result === 'clean').length,
    missed: rs.filter((r) => r.result !== 'clean').length,
    avgSec: avgSecOf(rs),
    times: puzzleIds.map((id) => {
      const r = byId.get(id);
      return r ? r.timeMs / 1000 : null;
    }),
    startedAt,
  };
}

// ─── Targets ─────────────────────────────────────────────────────────────

/** The floor of a cycle target: below this the clock stops teaching. */
export const MIN_TARGET_SEC = 5;
/** Each cycle aims this much under the one before (owner, Q47: −30%). */
export const CYCLE_SPEEDUP = 0.7;

const round5 = (s: number) => Math.max(MIN_TARGET_SEC, Math.round(s / 5) * 5);

/**
 * Each cycle aims 30% under the one before. Cycle 2 takes 70% of the
 * first pass's average (rounded to 5 s); later cycles 70% of the better of
 * the previous cycle's target and its actual average. Null for cycle 1
 * (no target on a first read) and before a first-pass average exists.
 */
export function cycleTargetSec(cycles: readonly Pick<CycleStats, 'cycle' | 'avgSec'>[], cycle: number): number | null {
  if (cycle <= 1) return null;
  const first = cycles.find((c) => c.cycle === 1)?.avgSec;
  if (first == null) return null;
  let target = round5(first * CYCLE_SPEEDUP);
  for (let n = 3; n <= cycle; n++) {
    const prev = cycles.find((c) => c.cycle === n - 1)?.avgSec;
    target = Math.max(MIN_TARGET_SEC, Math.round(Math.min(target, prev ?? target) * CYCLE_SPEEDUP));
  }
  return target;
}

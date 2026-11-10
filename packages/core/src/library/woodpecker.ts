// Woodpecker cycles: one fixed set of puzzles solved again and again, each
// cycle in half the days of the one before (D41, the method as Smith &
// Tikkanen wrote it). A set is a Library "book" for the progress
// arithmetic: its results are Library attempts with bookId = the set id.
// A "book" set's first cycle draws from a pool for up to four weeks; the
// set is what that cycle got through (the server cuts it, see
// apps/backend/src/woodpecker).
import type { WoodpeckerSet } from '../api/types';
import type { BookShape, LibraryAttemptRecord } from './library';

/** Puzzles per chapter of the book shape (the progress arithmetic only). */
export const WOODPECKER_BLOCK = 25;

export const WOODPECKER_ID_PREFIX = 'wp_';
export const isWoodpeckerId = (id: string) => id.startsWith(WOODPECKER_ID_PREFIX);

/** The book's first cycle: four weeks at the player's own pace. */
export const WOODPECKER_FIRST_CYCLE_DAYS = 28;
/** The first cycle closes (by itself or by hand) with at least this many puzzles. */
export const WOODPECKER_MIN_SET = 50;
/** The method ends after the 7th cycle at the latest. */
export const WOODPECKER_MAX_CYCLES = 7;
/** The book's rest between cycles: one day to a week. */
export const WOODPECKER_REST_MAX_DAYS = 7;
/** The first cycle has no deadline; this is the day's suggested portion. */
export const WOODPECKER_FIRST_CYCLE_DAILY = 25;

/** Where the book and its rules are. */
export const WOODPECKER_BOOK_URL = 'https://www.newinchess.com/the-woodpecker-method';

/** The set as a book: chapters of WOODPECKER_BLOCK puzzles in set order. */
export function woodpeckerShape(set: { id: string; puzzles: readonly { id: string }[] }): BookShape {
  const chapters: BookShape['chapters'] = [];
  for (let i = 0; i < set.puzzles.length; i += WOODPECKER_BLOCK) {
    chapters.push({ id: `${set.id}#${chapters.length}`, puzzleIds: set.puzzles.slice(i, i + WOODPECKER_BLOCK).map((p) => p.id) });
  }
  return { id: set.id, chapters };
}

/**
 * The solving queue: the puzzles without a result this cycle, in set
 * order from `start` to the end, then the ones before it that are still
 * open.
 */
export function woodpeckerQueue(puzzleIds: readonly string[], done: ReadonlySet<string>, start = 0): string[] {
  const from = Math.max(0, Math.min(start, puzzleIds.length));
  const open = (ids: readonly string[]) => ids.filter((id) => !done.has(id));
  return [...open(puzzleIds.slice(from)), ...open(puzzleIds.slice(0, from))];
}

// ─── Days ────────────────────────────────────────────────────────────────

/** The local calendar day of an instant, 'YYYY-MM-DD'. */
export function localDayOf(at: Date | string): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days since the epoch for a 'YYYY-MM-DD' (UTC arithmetic: no DST drift). */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** 'YYYY-MM-DD' `n` days after `day`. */
export function addDays(day: string, n: number): string {
  const d = new Date((dayNumber(day) + n) * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Calendar days from `a` to `b`, both counted. */
export const spanDays = (a: string, b: string) => dayNumber(b) - dayNumber(a) + 1;

/** The book's rule: each cycle in half the days of the one before, rounded up. */
export const halfDays = (days: number) => Math.max(1, Math.ceil(days / 2));

// ─── The method ──────────────────────────────────────────────────────────

export type WoodpeckerCycle = {
  cycle: number;
  /** Different puzzles with a result. */
  done: number;
  /** Clean share, whole percent (null before a result). */
  cleanPct: number | null;
  /** Calendar days from its first result to its last (or to today while open). */
  days: number;
  /** Its target in days (null for cycle 1: no deadline). */
  target: number | null;
  complete: boolean;
  firstDay: string;
  lastDay: string;
};

export type WoodpeckerToday = {
  done: number;
  /** The day's portion (null: none). */
  goal: number | null;
  met: boolean;
};

export type WoodpeckerStatus =
  /** A "book" set's first cycle, still drawing from the pool. */
  | {
      phase: 'first';
      /** Day of the four weeks (1 before the first result). */
      day: number;
      solved: number;
      /** Close by hand now (enough puzzles). */
      canClose: boolean;
      /** Four weeks are over: the server closes it on the next fetch. */
      due: boolean;
      today: WoodpeckerToday;
    }
  /** A cycle being solved (or the first one of a D40 set). */
  | {
      phase: 'cycle';
      cycle: number;
      done: number;
      total: number;
      /** Days allowed (null: no deadline). */
      target: number | null;
      /** Its last day (null until it has a result, or without a target). */
      deadline: string | null;
      /** Days left counting today (0 or less: over the target). */
      daysLeft: number | null;
      today: WoodpeckerToday;
    }
  /** A cycle just done; the next one waits for its first result. */
  | {
      phase: 'rest';
      cycle: number;
      days: number;
      /** Within its target (null: it had none). */
      met: boolean | null;
      next: number;
      nextTarget: number;
      /** Whole days since the cycle ended (0: it ended today). */
      rested: number;
    }
  /** The whole set in one day, or the 7th cycle done. */
  | { phase: 'complete'; cycles: number; days: number };

export type WoodpeckerPlan = { status: WoodpeckerStatus; cycles: WoodpeckerCycle[] };

/**
 * The method's state from the set and the player's results: which phase,
 * the cycle's deadline and the day's portion, and every cycle's days
 * against its target. `now` decides "today" (the device's calendar).
 */
export function woodpeckerPlan(set: Pick<WoodpeckerSet, 'id' | 'method' | 'closed' | 'puzzles'>, attempts: readonly LibraryAttemptRecord[], now: Date): WoodpeckerPlan {
  const ids = set.puzzles.map((p) => p.id);
  const inSet = new Set(ids);
  const today = localDayOf(now);
  const mine = attempts.filter((a) => a.bookId === set.id && inSet.has(a.puzzleId));
  const open = set.method === 'book' && set.closed === false;
  const total = ids.length;

  const maxCycle = mine.reduce((m, a) => Math.max(m, a.cycle), 0);
  const cycles: WoodpeckerCycle[] = [];
  for (let n = 1; n <= maxCycle; n++) {
    const rs = mine.filter((a) => a.cycle === n);
    if (rs.length === 0) continue;
    const days = rs.map((r) => localDayOf(r.solvedAt)).sort();
    const done = new Set(rs.map((r) => r.puzzleId)).size;
    const complete = !open && done >= total;
    const firstDay = days[0];
    const lastDay = complete ? days[days.length - 1] : today;
    const prev = cycles.find((c) => c.cycle === n - 1);
    cycles.push({
      cycle: n,
      done,
      cleanPct: Math.round((rs.filter((r) => r.result === 'clean').length / rs.length) * 100),
      days: spanDays(firstDay, lastDay),
      target: prev?.complete ? halfDays(prev.days) : null,
      complete,
      firstDay,
      lastDay,
    });
  }

  const todayIn = (n: number) => new Set(mine.filter((a) => a.cycle === n && localDayOf(a.solvedAt) === today).map((a) => a.puzzleId)).size;
  const doneBefore = (n: number) => new Set(mine.filter((a) => a.cycle === n && localDayOf(a.solvedAt) < today).map((a) => a.puzzleId)).size;

  if (open) {
    const c1 = cycles.find((c) => c.cycle === 1);
    const solvedIds = new Set(mine.filter((a) => a.cycle === 1).map((a) => a.puzzleId));
    let solved = 0;
    while (solved < ids.length && solvedIds.has(ids[solved])) solved += 1;
    const day = c1 ? spanDays(c1.firstDay, today) : 1;
    const done = todayIn(1);
    return {
      status: {
        phase: 'first',
        day,
        solved,
        canClose: solved >= WOODPECKER_MIN_SET,
        due: day > WOODPECKER_FIRST_CYCLE_DAYS && solved >= WOODPECKER_MIN_SET,
        today: { done, goal: WOODPECKER_FIRST_CYCLE_DAILY, met: done >= WOODPECKER_FIRST_CYCLE_DAILY },
      },
      cycles,
    };
  }

  const last = cycles[cycles.length - 1];
  if (last?.complete) {
    if ((last.cycle >= 2 && last.days <= 1) || last.cycle >= WOODPECKER_MAX_CYCLES) {
      return { status: { phase: 'complete', cycles: last.cycle, days: last.days }, cycles };
    }
    return {
      status: {
        phase: 'rest',
        cycle: last.cycle,
        days: last.days,
        met: last.target != null ? last.days <= last.target : null,
        next: last.cycle + 1,
        nextTarget: halfDays(last.days),
        rested: dayNumber(today) - dayNumber(last.lastDay),
      },
      cycles,
    };
  }

  const n = last?.cycle ?? 1;
  const target = last?.target ?? null;
  const deadline = target != null && last ? addDays(last.firstDay, target - 1) : null;
  const daysLeft = deadline != null ? dayNumber(deadline) - dayNumber(today) + 1 : null;
  const before = doneBefore(n);
  const remaining = Math.max(0, total - before);
  const goal = daysLeft == null ? WOODPECKER_FIRST_CYCLE_DAILY : Math.ceil(remaining / Math.max(1, daysLeft));
  const done = todayIn(n);
  return {
    status: {
      phase: 'cycle',
      cycle: n,
      done: last?.done ?? 0,
      total,
      target,
      deadline,
      daysLeft,
      today: { done, goal, met: done >= goal },
    },
    cycles,
  };
}

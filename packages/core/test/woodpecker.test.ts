import { describe, expect, it } from 'vitest';
import {
  addDays,
  bookProgress,
  halfDays,
  localDayOf,
  spanDays,
  woodpeckerPlan,
  woodpeckerQueue,
  woodpeckerShape,
  WOODPECKER_BLOCK,
  WOODPECKER_FIRST_CYCLE_DAILY,
  type LibraryAttemptRecord,
} from '../src/library';

const set = (n: number) => ({ id: 'wp_x', puzzles: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })) });

describe('woodpeckerShape', () => {
  it('cuts the set into blocks in set order', () => {
    const shape = woodpeckerShape(set(60));
    expect(shape.chapters.map((c) => c.puzzleIds.length)).toEqual([WOODPECKER_BLOCK, WOODPECKER_BLOCK, 10]);
    expect(shape.chapters[1].puzzleIds[0]).toBe('p25');
  });
  it('runs through bookProgress like a book', () => {
    const shape = woodpeckerShape(set(50));
    const rec = (id: string) => ({ bookId: 'wp_x', puzzleId: id, cycle: 1, result: 'clean' as const, timeMs: 10_000, solvedAt: '2026-11-10T00:00:00.000Z' });
    const p = bookProgress(shape, ['p0', 'p1', 'p2'].map(rec));
    expect(p).toMatchObject({ cycle: 1, done: 3, total: 50 });
    expect(p.next).toEqual({ chapterIndex: 0, puzzleIndex: 3, puzzleId: 'p3' });
  });
});

describe('woodpeckerQueue', () => {
  it('runs from start to the end, then wraps to what is still open', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    expect(woodpeckerQueue(ids, new Set(['a', 'd']), 2)).toEqual(['c', 'e', 'b']);
    expect(woodpeckerQueue(ids, new Set(), 0)).toEqual(ids);
    expect(woodpeckerQueue(ids, new Set(ids), 0)).toEqual([]);
  });
});

describe('days', () => {
  it('counts calendar days and halves them up', () => {
    expect(spanDays('2026-11-01', '2026-11-01')).toBe(1);
    expect(spanDays('2026-10-25', '2026-11-03')).toBe(10);
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect([28, 14, 7, 4, 2, 1].map(halfDays)).toEqual([14, 7, 4, 2, 1, 1]);
    expect(localDayOf(new Date(2026, 10, 9, 23, 30))).toBe('2026-11-09');
  });
});

// Local noon of a day, so the device's time zone never moves it.
const at = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};
const rec = (id: string, cycle: number, day: string, result: LibraryAttemptRecord['result'] = 'clean'): LibraryAttemptRecord => ({
  bookId: 'wp_x',
  puzzleId: id,
  cycle,
  result,
  timeMs: 10_000,
  solvedAt: at(day),
});
const now = (day: string) => new Date(at(day));
/** Every puzzle of a set of `n` in cycle `cycle`, spread over `days` days from `from`. */
const cycleOf = (n: number, cycle: number, from: string, days: number) =>
  Array.from({ length: n }, (_, i) => rec(`p${i}`, cycle, addDays(from, Math.floor((i * days) / n))));

describe('woodpeckerPlan', () => {
  const book = (n: number, closed: boolean) => ({ ...set(n), method: 'book' as const, closed, puzzles: set(n).puzzles.map((p) => ({ ...p, fen: '', moves: '', rating: 0, themes: [] })) });

  it('first cycle: the day of four weeks, the solved run, close from 50', () => {
    const s = book(1000, false);
    const rs = [...Array.from({ length: 40 }, (_, i) => rec(`p${i}`, 1, '2026-11-01')), rec('p41', 1, '2026-11-09')];
    const p = woodpeckerPlan(s, rs, now('2026-11-09'));
    expect(p.status).toMatchObject({ phase: 'first', day: 9, solved: 40, canClose: false, due: false });
    expect(p.status.phase === 'first' && p.status.today).toEqual({ done: 1, goal: WOODPECKER_FIRST_CYCLE_DAILY, met: false });
    const more = Array.from({ length: 60 }, (_, i) => rec(`p${i}`, 1, '2026-10-01'));
    expect(woodpeckerPlan(s, more, now('2026-10-29')).status).toMatchObject({ phase: 'first', day: 29, solved: 60, canClose: true, due: true });
    expect(woodpeckerPlan(s, [], now('2026-11-09')).status).toMatchObject({ phase: 'first', day: 1, solved: 0 });
  });

  it('rest after a cycle, then the next cycle has half the days as its target', () => {
    const s = book(100, true);
    const c1 = cycleOf(100, 1, '2026-10-01', 20);
    const rest = woodpeckerPlan(s, c1, now('2026-10-20'));
    expect(rest.status).toMatchObject({ phase: 'rest', cycle: 1, days: 20, met: null, next: 2, nextTarget: 10, rested: 0 });
    expect(rest.cycles[0]).toMatchObject({ cycle: 1, target: null, complete: true, days: 20, cleanPct: 100 });

    // Cycle 2 starts on 10-22: 30 done before today, 10 today.
    const c2 = [...Array.from({ length: 30 }, (_, i) => rec(`p${i}`, 2, '2026-10-22')), ...Array.from({ length: 10 }, (_, i) => rec(`p${30 + i}`, 2, '2026-10-24'))];
    const p = woodpeckerPlan(s, [...c1, ...c2], now('2026-10-24'));
    // Deadline 10-31 (10 days from 10-22): 8 days left counting today, 70 left at the day's start.
    expect(p.status).toMatchObject({ phase: 'cycle', cycle: 2, done: 40, total: 100, target: 10, deadline: '2026-10-31', daysLeft: 8 });
    expect(p.status.phase === 'cycle' && p.status.today).toEqual({ done: 10, goal: 9, met: true });
    expect(p.cycles[1]).toMatchObject({ cycle: 2, target: 10, complete: false, days: 3 });
  });

  it('over the deadline the day asks for the rest', () => {
    const s = book(100, true);
    const c1 = cycleOf(100, 1, '2026-10-01', 4);
    const c2 = Array.from({ length: 20 }, (_, i) => rec(`p${i}`, 2, '2026-10-10'));
    const p = woodpeckerPlan(s, [...c1, ...c2], now('2026-10-14'));
    expect(p.status).toMatchObject({ phase: 'cycle', target: 2, deadline: '2026-10-11', daysLeft: -2 });
    expect(p.status.phase === 'cycle' && p.status.today.goal).toBe(80);
  });

  it('the method ends with the set in one day, or after the 7th cycle', () => {
    const s = book(60, true);
    const oneDay = [...cycleOf(60, 1, '2026-10-01', 10), ...cycleOf(60, 2, '2026-10-12', 1)];
    expect(woodpeckerPlan(s, oneDay, now('2026-10-13')).status).toEqual({ phase: 'complete', cycles: 2, days: 1 });
    const seven = Array.from({ length: 7 }, (_, k) => cycleOf(60, k + 1, addDays('2026-01-01', k * 20), 2)).flat();
    expect(woodpeckerPlan(s, seven, now('2026-06-01')).status).toMatchObject({ phase: 'complete', cycles: 7 });
  });

  it('a D40 set has no first-cycle phase and no deadline in cycle 1', () => {
    const s = { ...set(50), method: null, puzzles: set(50).puzzles.map((p) => ({ ...p, fen: '', moves: '', rating: 0, themes: [] })) };
    const p = woodpeckerPlan(s, [rec('p0', 1, '2026-11-01', 'missed')], now('2026-11-03'));
    expect(p.status).toMatchObject({ phase: 'cycle', cycle: 1, done: 1, total: 50, target: null, deadline: null, daysLeft: null });
    expect(p.cycles[0].cleanPct).toBe(0);
  });
});

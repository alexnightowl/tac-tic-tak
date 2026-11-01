import { describe, expect, it } from 'vitest';
import { bookProgress, chapterCycleStats, cycleTargetSec, mergeAttempts, type BookShape, type LibraryAttemptRecord } from '../src/library';

const book: BookShape = {
  id: 'b',
  chapters: [
    { id: 'c1', puzzleIds: ['p1', 'p2'] },
    { id: 'c2', puzzleIds: ['p3', 'p4'] },
  ],
};

let t = 0;
const rec = (puzzleId: string, cycle: number, result: LibraryAttemptRecord['result'] = 'clean', sec = 10): LibraryAttemptRecord => ({
  bookId: 'b',
  puzzleId,
  cycle,
  result,
  timeMs: sec * 1000,
  solvedAt: new Date(Date.UTC(2026, 10, 1, 0, 0, t++)).toISOString(),
});

describe('bookProgress', () => {
  it('starts at cycle 1 with the first puzzle next', () => {
    const p = bookProgress(book, []);
    expect(p).toMatchObject({ cycle: 1, started: false, done: 0, total: 4, cycleComplete: false });
    expect(p.next).toEqual({ chapterIndex: 0, puzzleIndex: 0, puzzleId: 'p1' });
  });

  it('points at the first gap in book order, even after a jump ahead', () => {
    const p = bookProgress(book, [rec('p1', 1), rec('p3', 1)]);
    expect(p.next?.puzzleId).toBe('p2');
    expect(p.chapters.map((c) => c.done)).toEqual([1, 1]);
  });

  it('completes a cycle, then reads the next one from the top', () => {
    const one = ['p1', 'p2', 'p3', 'p4'].map((id) => rec(id, 1, id === 'p2' ? 'missed' : 'clean', 40));
    const done = bookProgress(book, one);
    expect(done).toMatchObject({ cycle: 1, cycleComplete: true, finishedOnce: true, next: null });
    expect(done.cycles[0]).toMatchObject({ clean: 3, avgSec: 40, complete: true });
    const two = bookProgress(book, [...one, rec('p1', 2, 'clean', 20)]);
    expect(two).toMatchObject({ cycle: 2, cycleComplete: false, done: 1, finishedOnce: true });
    expect(two.next?.puzzleId).toBe('p2');
  });

  it('ignores other books and unknown puzzles', () => {
    const p = bookProgress(book, [{ ...rec('p1', 1), bookId: 'x' }, rec('zz', 3)]);
    expect(p.started).toBe(false);
    expect(p.cycle).toBe(1);
  });
});

describe('mergeAttempts', () => {
  it('keeps the first result per puzzle and cycle', () => {
    const a = rec('p1', 1, 'missed');
    const b = rec('p1', 1, 'clean');
    const c = rec('p1', 2, 'clean');
    expect(mergeAttempts([b], [a, c]).map((r) => [r.cycle, r.result])).toEqual([[1, 'missed'], [2, 'clean']]);
  });
});

describe('chapterCycleStats', () => {
  it('times in chapter order, misses counted', () => {
    const s = chapterCycleStats('b', ['p1', 'p2'], [rec('p2', 1, 'hint', 30), rec('p1', 1, 'clean', 10), rec('p1', 2)], 1);
    expect(s).toMatchObject({ done: 2, clean: 1, missed: 1, avgSec: 20, times: [10, 30] });
  });
});

describe('cycleTargetSec', () => {
  it('aims 30% faster each cycle (48 s → 35 → 22)', () => {
    const cycles = [{ cycle: 1, avgSec: 48 }, { cycle: 2, avgSec: 31 }];
    expect(cycleTargetSec(cycles, 1)).toBeNull();
    expect(cycleTargetSec(cycles, 2)).toBe(35);
    expect(cycleTargetSec(cycles, 3)).toBe(22);
    expect(cycleTargetSec([{ cycle: 1, avgSec: 48 }], 3)).toBe(25);
  });
  it('never goes under the floor', () => {
    expect(cycleTargetSec([{ cycle: 1, avgSec: 4 }], 5)).toBe(5);
  });
});

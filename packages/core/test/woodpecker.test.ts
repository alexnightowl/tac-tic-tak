import { describe, expect, it } from 'vitest';
import {
  bookProgress,
  mateInFromThemes,
  speedupPct,
  woodpeckerQueue,
  woodpeckerShape,
  woodpeckerWindow,
  WOODPECKER_BLOCK,
} from '../src/library';

const set = (n: number) => ({ id: 'wp_x', puzzles: Array.from({ length: n }, (_, i) => ({ id: `p${i}` })) });

describe('woodpeckerWindow', () => {
  it('centres the window below the level by difficulty', () => {
    expect(woodpeckerWindow(1600, 'easy')).toEqual({ rating: 1300, min: 1225, max: 1375 });
    expect(woodpeckerWindow(1600, 'medium')).toEqual({ rating: 1450, min: 1375, max: 1525 });
    expect(woodpeckerWindow(1600, 'hard')).toEqual({ rating: 1600, min: 1525, max: 1675 });
  });
  it('never goes under the floor', () => {
    expect(woodpeckerWindow(700, 'easy').rating).toBe(600);
  });
});

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
  it('starts at the block and wraps to the open puzzles before it', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    expect(woodpeckerQueue(ids, new Set(['a', 'd']), 2)).toEqual(['c', 'e', 'b']);
    expect(woodpeckerQueue(ids, new Set(), 0)).toEqual(ids);
    expect(woodpeckerQueue(ids, new Set(ids), 0)).toEqual([]);
  });
});

describe('helpers', () => {
  it('reads mate-in from themes', () => {
    expect(mateInFromThemes(['fork', 'mateIn2'])).toBe(2);
    expect(mateInFromThemes(['fork'])).toBeNull();
  });
  it('gives the speed-up in percent', () => {
    expect(speedupPct(40, 30)).toBe(25);
    expect(speedupPct(null, 30)).toBeNull();
  });
});

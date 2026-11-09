import { describe, expect, it } from 'vitest';

import { computeRatingStep, evaluateLevel, hasteMs, isHasty, paceTarget } from '../src/rules';

describe('pace (D37)', () => {
  it('targets for the duration presets', () => {
    expect([60, 120, 180].map((d) => paceTarget('bullet', d))).toEqual([5, 11, 16]);
    expect([300, 600, 900].map((d) => paceTarget('blitz', d))).toEqual([12, 25, 39]);
    expect([600, 1200, 1800].map((d) => paceTarget('rapid', d))).toEqual([10, 21, 32]);
  });

  it('holds a level-up when the pace falls short', () => {
    const held = evaluateLevel(1600, 1662, 0, { solved: 14, target: 16 });
    expect(held).toMatchObject({ after: 1600, up: false, paceHeld: true, pace: { met: false } });
    const up = evaluateLevel(1600, 1662, 0, { solved: 16, target: 16 });
    expect(up).toMatchObject({ after: 1650, up: true, paceHeld: false, pace: { met: true } });
  });

  it('never blocks the guard or a level-down', () => {
    const r = evaluateLevel(1600, 1520, 1, { solved: 0, target: 16 });
    expect(r).toMatchObject({ after: 1575, down: true, paceHeld: false });
  });
});

describe('level norm (D39)', () => {
  it('rises only from +50, to the 25-grid mark reached (jumps allowed)', () => {
    expect(evaluateLevel(1600, 1649, 0).after).toBe(1600);
    expect(evaluateLevel(1600, 1650, 0).after).toBe(1650);
    expect(evaluateLevel(1600, 1712, 0).after).toBe(1700);
    expect(evaluateLevel(1600, 1712, 0).next).toBe(1750);
  });

  it('drops 25 after two sessions in a row under level − 50', () => {
    const first = evaluateLevel(1600, 1540, 0);
    expect(first).toMatchObject({ after: 1600, guardAfter: 1, down: false });
    expect(evaluateLevel(1600, 1400, 1)).toMatchObject({ after: 1575, guardAfter: 0, down: true });
    expect(evaluateLevel(1600, 1560, 1)).toMatchObject({ after: 1600, guardAfter: 0 });
  });

  it('measures the speed bonus by style', () => {
    const solve = (ms: number) => ({ correct: true, responseMs: ms, puzzleRating: 1500 });
    // A 10 s solve: the full bonus in rapid, a quarter in blitz, none in bullet.
    expect(computeRatingStep(1500, solve(10_000), { style: 'rapid' })).toBe(10);
    expect(computeRatingStep(1500, solve(10_000), { style: 'blitz' })).toBe(9);
    expect(computeRatingStep(1500, solve(10_000), { style: 'bullet' })).toBe(8);
    // No style (web norm sessions, offline): the old 4–12 s window.
    expect(computeRatingStep(1500, solve(10_000))).toBe(9);
  });
});

describe('levelProgress (protected level)', () => {
  it('spans guard line → next mark under the level, with the level marked', async () => {
    const { levelProgress } = await import('../src/runner');
    expect(levelProgress(1576, 1600)).toEqual({ next: 1650, toNext: 74, ratio: 0.26, levelMark: 0.5 });
    expect(levelProgress(1625, 1600)).toEqual({ next: 1650, toNext: 25, ratio: 0.5, levelMark: null });
    expect(levelProgress(1540, 1600).ratio).toBe(0);
  });
});

describe('haste (mistake under 30% of the pace budget)', () => {
  it('thresholds per style', () => {
    expect(hasteMs('bullet')).toBe(1500);
    expect(hasteMs('blitz')).toBe(3600);
    expect(hasteMs('rapid')).toBe(9000);
    expect(isHasty('blitz', 3599)).toBe(true);
    expect(isHasty('blitz', 3600)).toBe(false);
  });
});

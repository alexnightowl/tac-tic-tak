import { describe, expect, it } from 'vitest';
import {
  BAND_EDGES, BAND_ICON_KEY, DEMOTE_PEAK_BAND, TRAINING_STYLES, UI_STYLE_ORDER,
  applyStreakOnPlay, bandFor, computeRatingStep, computeUnlockProgress,
  evaluateCalibration, evaluateDemote, evaluateUnlock, offFormRating, peakFloor, solvedTarget,
} from '../src/rules';

describe('levels', () => {
  it('bands are half-open and clamp to the top band', () => {
    expect(bandFor(999).key).toBe('novice');
    expect(bandFor(1000).key).toBe('beginner');
    expect(bandFor(2199).key).toBe('advanced');
    expect(bandFor(2200).key).toBe('expert');
    expect(bandFor(3000).key).toBe('expert');
    expect(bandFor(100).key).toBe('expert'); // below range falls through, as on the web
    expect(BAND_EDGES).toEqual([400, 1000, 1400, 1800, 2200, 3000]);
    expect(BAND_ICON_KEY.novice).toBe('tomoe-1');
  });

  it('keeps both style orders', () => {
    expect(TRAINING_STYLES).toEqual(['bullet', 'blitz', 'rapid']);
    expect(UI_STYLE_ORDER).toEqual(['rapid', 'blitz', 'bullet']);
  });

  it('peak band helpers mirror the play pages', () => {
    expect(DEMOTE_PEAK_BAND).toBe(50);
    expect(peakFloor(1500)).toBe(1450);
    expect(offFormRating(1500)).toBe(1425);
    expect(offFormRating(1510)).toBe(1425);
    expect(offFormRating(420)).toBe(400);
  });

  it('solvedTarget respects the floor', () => {
    expect(solvedTarget('bullet', 60)).toBe(7);
    expect(solvedTarget('bullet', 20)).toBe(3);
    expect(solvedTarget('blitz', 300)).toBe(21);
    expect(solvedTarget('rapid', 600)).toBe(19);
  });

  it('computeUnlockProgress: overall ratio is the weakest criterion', () => {
    const p = computeUnlockProgress('blitz', { solved: 21, accuracy: 0.35, peakRating: 1550, startRating: 1500 }, 300);
    expect(p.criteria.map((c) => c.ratio)).toEqual([1, 0.5, 0.5]);
    expect(p.ratio).toBe(0.5);
    expect(p.met).toBe(false);
  });
});

describe('unlock rules', () => {
  const check = (met: number) => evaluateUnlock(
    'blitz',
    { solved: met >= 1 ? 30 : 0, accuracy: met >= 2 ? 0.9 : 0, peakRating: 1500 + (met >= 3 ? 150 : 0) },
    300,
    1500,
  );

  it('calibration snaps to the 50 grid and floors at the entry rating', () => {
    const c = evaluateCalibration(1200, 1000, 1495, check(3), 5);
    expect(c.ceilingAfter).toBe(1550);
    expect(c.delta).toBe(350);
    expect(c.sessionsLeftAfter).toBe(4);
    expect(evaluateCalibration(1200, 1000, 1010, check(0), 1).ceilingAfter).toBe(1000);
  });

  it('demote needs two weak at-peak sessions', () => {
    const weak = check(1);
    const first = evaluateDemote(false, weak, 1450, 1500, 0);
    expect(first).toMatchObject({ atPeak: true, weak: true, streakAfter: 1, demoted: false });
    const second = evaluateDemote(false, weak, 1450, 1500, 1);
    expect(second).toMatchObject({ demoted: true, streakAfter: 0, penalty: 25 });
    // Comfort-zone sessions leave the streak alone.
    expect(evaluateDemote(false, weak, 1449, 1500, 1)).toMatchObject({ atPeak: false, streakAfter: 1 });
  });
});

describe('rating step', () => {
  it('fast correct beats slow correct, streak boosts only gains', () => {
    const fast = computeRatingStep(1500, [{ correct: true, responseMs: 1000, puzzleRating: 1500 }]);
    const slow = computeRatingStep(1500, [{ correct: true, responseMs: 20000, puzzleRating: 1500 }]);
    expect(fast).toBe(18);
    expect(slow).toBe(6);
    expect(computeRatingStep(1500, [{ correct: true, responseMs: 1000, puzzleRating: 1500 }], 20)).toBe(24);
    expect(computeRatingStep(1500, [{ correct: false, responseMs: 1000, puzzleRating: 1500 }], 20)).toBe(-6);
    expect(computeRatingStep(1500, [])).toBe(0);
  });
});

describe('streak', () => {
  const s = (lastDay: string | null, days = 5, freezes = 1, regen: string | null = null) =>
    ({ streakDays: days, streakFreezes: freezes, streakLastDay: lastDay, streakFreezeRegenAt: regen });

  it('covers the outcomes', () => {
    expect(applyStreakOnPlay(s('2026-03-10'), '2026-03-10').outcome).toBe('same-day');
    expect(applyStreakOnPlay(s(null, 0), '2026-03-10').outcome).toBe('started');
    expect(applyStreakOnPlay(s('2026-03-09'), '2026-03-10').next.streakDays).toBe(6);
    const frozen = applyStreakOnPlay(s('2026-03-08'), '2026-03-10');
    expect(frozen.outcome).toBe('frozen');
    expect(frozen.next).toMatchObject({ streakDays: 6, streakFreezes: 0, streakFreezeRegenAt: '2026-03-17' });
    expect(applyStreakOnPlay(s('2026-03-08', 5, 0), '2026-03-10').outcome).toBe('reset');
    // A freeze that regenerates today can cover today's gap.
    expect(applyStreakOnPlay(s('2026-03-08', 5, 0, '2026-03-10'), '2026-03-10').outcome).toBe('frozen');
    // Across a month boundary / DST date.
    expect(applyStreakOnPlay(s('2026-03-28'), '2026-03-29').outcome).toBe('continued');
  });
});

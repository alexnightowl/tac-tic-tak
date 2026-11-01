import { describe, expect, it } from 'vitest';
import {
  BAND_EDGES, BAND_ICON_KEY, DEMOTE_PEAK_BAND, TRAINING_STYLES, UI_STYLE_ORDER,
  applyStreakOnPlay, bandFor, computeRatingStep, computeUnlockProgress, expectedSolve,
  evaluateLevel, initialLevel, trainingXp, xpStanding,
  calibrationNorm, calibrationProbe, estimatePerformance, levelUpOdds, fitResponseTime,
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

  it('calibration moves the ceiling to the target, floored', () => {
    const c = evaluateCalibration(1200, 450, 1550, 1700, check(3), 5);
    expect(c).toMatchObject({ ceilingAfter: 1550, delta: 350, sessionsLeftAfter: 4, criteriaMet: 3 });
    expect(evaluateCalibration(1200, 450, 300, 900, check(0), 1).ceilingAfter).toBe(450);
    expect(evaluateCalibration(1200, 450, null, 1200, check(0), 5).ceilingAfter).toBe(1200);
  });

  it('calibration fits the level and places a reachable norm below it', () => {
    // 60 attempts of a ~1500 player: solves 1400s, misses 1600s.
    const attempts = Array.from({ length: 60 }, (_, i) => {
      const puzzleRating = 1350 + (i % 6) * 60;
      return { correct: puzzleRating < 1500 || i % 3 === 0, responseMs: 9000, puzzleRating };
    });
    const performance = estimatePerformance(attempts, 1500);
    expect(performance).toBeGreaterThan(1450);
    expect(performance).toBeLessThan(1700);
    const { target } = calibrationNorm('blitz', attempts, 1500, 300);
    expect(target).not.toBeNull();
    expect(target! % 25).toBe(0);
    expect(target!).toBeLessThan(performance);
    const time = fitResponseTime(attempts, performance);
    expect(levelUpOdds('blitz', performance, time, target!, 300)).toBeGreaterThanOrEqual(0.6);
    expect(levelUpOdds('blitz', performance, time, target! + 25, 300)).toBeLessThan(0.6);
    expect(calibrationNorm('blitz', [], 1500, 300).target).toBeNull();
  });

  it('calibration sessions start below the fit and rise at most 200', () => {
    expect(calibrationProbe([], 1600, null)).toBe(1525);
    const flawless = Array.from({ length: 30 }, () => ({ correct: true, responseMs: 3000, puzzleRating: 1500 }));
    expect(calibrationProbe(flawless, 1500, 1425)).toBe(1625);
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
  const at = (correct: boolean, responseMs = 8000, puzzleRating = 1500) => ({ correct, responseMs, puzzleRating });
  it('is Elo against the puzzle, a fast solve earns a little more', () => {
    expect(computeRatingStep(1500, at(true, 20000))).toBe(8);
    expect(computeRatingStep(1500, at(true, 1000))).toBe(10);
    expect(computeRatingStep(1500, at(false))).toBe(-8);
    // A miss on an easy puzzle costs more than a miss on a hard one.
    expect(computeRatingStep(1500, at(false, 8000, 1300))).toBeLessThan(computeRatingStep(1500, at(false, 8000, 1700)));
    expect(computeRatingStep(1500, at(false), { provisional: true })).toBe(-16);
  });

  it('settles where the player solves about half the puzzles at their rating', () => {
    // A 1500 player: expected gain is zero at 1500.
    const drift = (r: number) => {
      // The player solves a puzzle rated r with this chance.
      const p = expectedSolve(r, 1500);
      return p * computeRatingStep(r, at(true, 20000, r)) + (1 - p) * computeRatingStep(r, at(false, 20000, r));
    };
    expect(drift(1500)).toBeCloseTo(0, 5);
    expect(drift(1700)).toBeLessThan(0);
    expect(drift(1300)).toBeGreaterThan(0);
  });
});

describe('levels and experience', () => {
  it('levels up as soon as a session ends above the next mark', () => {
    expect(evaluateLevel(1600, 1661, 0)).toMatchObject({ after: 1650, up: true, next: 1700 });
    expect(evaluateLevel(1600, 1712, 1)).toMatchObject({ after: 1700, up: true, guardAfter: 0 });
  });

  it('drops a level only after two sessions in a row end 50+ under it', () => {
    const first = evaluateLevel(1600, 1543, 0);
    expect(first).toMatchObject({ after: 1600, down: false, guardAfter: 1 });
    expect(evaluateLevel(1600, 1531, first.guardAfter)).toMatchObject({ after: 1500, down: true, guardAfter: 0 });
    // Ending within 50 of the level clears the guard.
    expect(evaluateLevel(1600, 1560, 1)).toMatchObject({ after: 1600, guardAfter: 0 });
  });

  it('starts from the earned norm when the rating drifted above it', () => {
    expect(initialLevel(1612, 1450)).toBe(1450);
    expect(initialLevel(1180, 1450)).toBe(1150);
  });

  it('ranks and levels experience', () => {
    expect(trainingXp(10 * 60_000 + 59_000)).toBe(20);
    expect(xpStanding(4820)).toMatchObject({ level: 7, levelXp: 4200, nextLevelXp: 5600, rank: 'knight', nextRank: 'bishop', nextRankXp: 6000 });
    expect(xpStanding(0)).toMatchObject({ level: 1, rank: 'pawn' });
    expect(xpStanding(60_000)).toMatchObject({ rank: 'king', nextRank: null, nextRankXp: null });
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

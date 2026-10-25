/**
 * RULES GOLDEN TEST (pure functions, no IO).
 *
 * Freezes the outputs of the rating / unlock / demote / calibration /
 * streak rules on a fixed set of inputs: hand-picked edge cases plus a
 * seeded pseudo-random sweep. Each case is one snapshot line
 * `[inputs, output]`, so a rules change shows up as a readable diff.
 *
 * The generator and seeds are part of the recording: editing them
 * changes the inputs and therefore the snapshot. A deliberate rules
 * change (B8) updates the snapshot in its own commit, alongside the core
 * copy in packages/core/src/rules (see apps/backend/CLAUDE.md).
 */
import {
  computeRatingStep,
  deriveSessionStats,
  AttemptWindow,
} from '../../src/sessions/rating';
import {
  CALIBRATION_SESSIONS,
  CALIBRATION_STEP_BY_CRITERIA,
  DEFAULT_STYLE,
  DEMOTE_MAX_CRITERIA,
  DEMOTE_PEAK_BAND,
  DEMOTE_PENALTY,
  STYLE_FORMULAS,
  TRAINING_STYLES,
  TrainingStyle,
  UNLOCK_REWARD,
  WEAK_STREAK_THRESHOLD,
  evaluateCalibration,
  evaluateDemote,
  evaluateUnlock,
  isTrainingStyle,
  solvedTarget,
} from '../../src/sessions/unlock';
import {
  STREAK_FREEZE_MAX,
  STREAK_FREEZE_REGEN_DAYS,
  StreakState,
  applyStreakOnPlay,
  isValidDay,
} from '../../src/sessions/streak';

/** mulberry32: tiny deterministic PRNG. Do not change (it defines the recorded inputs). */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    bool: (p = 0.5) => next() < p,
    pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)],
  };
}

const line = (input: unknown, output: unknown) => JSON.stringify([input, output]);

function randomWindow(r: ReturnType<typeof rng>, current: number, len: number): AttemptWindow {
  return Array.from({ length: len }, () => ({
    correct: r.bool(0.6),
    responseMs: r.pick([0, 1500, 3999, 4000, 6000, 8000, 11999, 12000, 20000, r.int(0, 30000)]),
    puzzleRating: current + r.int(-320, 320),
  }));
}

function randomUnlockInputs(r: ReturnType<typeof rng>) {
  const style = r.pick(TRAINING_STYLES);
  const durationSec = r.pick([60, 120, 180, 300, 600, 900, 1200, 1800, 3600]);
  const startRating = r.int(8, 50) * 50 + r.pick([0, 0, 0, -5, 13]);
  const solved = r.int(0, 40);
  const accuracy = Math.round(r.next() * 100) / 100;
  const peakRating = startRating + r.int(-50, 250);
  return { style, stats: { solved, accuracy, peakRating }, durationSec, startRating };
}

describe('rules golden', () => {
  it('constants', () => {
    expect({
      TRAINING_STYLES, DEFAULT_STYLE, UNLOCK_REWARD, DEMOTE_PENALTY, DEMOTE_PEAK_BAND,
      DEMOTE_MAX_CRITERIA, WEAK_STREAK_THRESHOLD, CALIBRATION_SESSIONS, CALIBRATION_STEP_BY_CRITERIA,
      STYLE_FORMULAS, STREAK_FREEZE_MAX, STREAK_FREEZE_REGEN_DAYS,
    }).toMatchSnapshot();
  });

  it('computeRatingStep (rating step)', () => {
    const cases: string[] = [];
    const edge: Array<[number, AttemptWindow, number]> = [
      [1200, [], 0],
      [1200, [{ correct: true, responseMs: 4000, puzzleRating: 1200 }], 0],
      [1200, [{ correct: true, responseMs: 12000, puzzleRating: 1200 }], 0],
      [1200, [{ correct: false, responseMs: 4000, puzzleRating: 1200 }], 0],
      [1200, [{ correct: false, responseMs: 12000, puzzleRating: 1200 }], 0],
      [1200, [{ correct: true, responseMs: 1000, puzzleRating: 1500 }], 0],
      [1200, [{ correct: false, responseMs: 1000, puzzleRating: 900 }], 0],
      [1200, [{ correct: true, responseMs: 3000, puzzleRating: 1200 }], 2],
      [1200, [{ correct: true, responseMs: 3000, puzzleRating: 1200 }], 10],
      [1200, [{ correct: true, responseMs: 3000, puzzleRating: 1200 }], 50],
      [1200, [{ correct: false, responseMs: 3000, puzzleRating: 1200 }], 10],
    ];
    for (const [cur, w, s] of edge) cases.push(line({ cur, w, s }, computeRatingStep(cur, w, s)));
    const r = rng(0xb0);
    for (let i = 0; i < 150; i++) {
      const cur = r.int(400, 3000);
      const w = randomWindow(r, cur, r.int(1, 4));
      const s = r.int(0, 14);
      cases.push(line({ cur, w, s }, computeRatingStep(cur, w, s)));
    }
    expect(cases).toMatchSnapshot();
  });

  it('deriveSessionStats', () => {
    const cases: string[] = [line({ attempts: [], start: 1200 }, deriveSessionStats([], 1200))];
    const r = rng(0xb1);
    for (let i = 0; i < 40; i++) {
      const start = r.int(8, 40) * 50;
      const attempts = randomWindow(r, start, r.int(1, 12));
      cases.push(line({ attempts, start }, deriveSessionStats(attempts, start)));
    }
    expect(cases).toMatchSnapshot();
  });

  it('solvedTarget / isTrainingStyle', () => {
    const cases: string[] = [];
    for (const style of TRAINING_STYLES) {
      for (const d of [7, 45, 60, 90, 120, 180, 300, 600, 900, 1200, 1800, 3600]) {
        cases.push(line({ style, d }, solvedTarget(style, d)));
      }
    }
    for (const v of ['bullet', 'blitz', 'rapid', 'classical', '', null, 3, 'Blitz']) {
      cases.push(line({ v }, isTrainingStyle(v)));
    }
    expect(cases).toMatchSnapshot();
  });

  it('evaluateUnlock (unlock)', () => {
    const cases: string[] = [];
    const r = rng(0xb2);
    for (let i = 0; i < 80; i++) {
      const u = randomUnlockInputs(r);
      cases.push(line(u, evaluateUnlock(u.style as TrainingStyle, u.stats, u.durationSec, u.startRating)));
    }
    expect(cases).toMatchSnapshot();
  });

  it('evaluateDemote (demote)', () => {
    const cases: string[] = [];
    const r = rng(0xb3);
    for (let i = 0; i < 80; i++) {
      const u = randomUnlockInputs(r);
      const check = evaluateUnlock(u.style as TrainingStyle, u.stats, u.durationSec, u.startRating);
      const unlocked = r.int(8, 50) * 50;
      const startRating = unlocked + r.pick([-200, -75, -51, -50, -49, -25, 0, 0, 25, 100]);
      const unlockMet = r.bool(0.2) ? check.met : r.bool(0.15);
      const streakBefore = r.int(0, 3);
      cases.push(line(
        { criteriaMet: check.criteria.map((c) => c.met), unlockMet, startRating, unlocked, streakBefore },
        evaluateDemote(unlockMet, check, startRating, unlocked, streakBefore),
      ));
    }
    expect(cases).toMatchSnapshot();
  });

  it('evaluateCalibration (calibration)', () => {
    const cases: string[] = [];
    const r = rng(0xb4);
    for (let i = 0; i < 80; i++) {
      const u = randomUnlockInputs(r);
      const check = evaluateUnlock(u.style as TrainingStyle, u.stats, u.durationSec, u.startRating);
      const unlocked = r.int(8, 40) * 50;
      const floor = r.pick([1200, 1200, u.startRating, unlocked - 100, 800]);
      const left = r.int(0, 5);
      cases.push(line(
        { criteriaMet: check.criteria.map((c) => c.met), unlocked, floor, startRating: u.startRating, left },
        evaluateCalibration(unlocked, floor, u.startRating, check, left),
      ));
    }
    expect(cases).toMatchSnapshot();
  });

  it('applyStreakOnPlay / isValidDay (streak)', () => {
    const cases: string[] = [];
    for (const d of ['2026-10-25', '2026-02-29', '2028-02-29', '2026-02-31', '2026-13-01', '26-10-25', '2026-10-25T00:00', '', 'garbage', null, 20261025]) {
      cases.push(line({ d }, isValidDay(d)));
    }
    const edge: Array<[StreakState, string]> = [
      [{ streakDays: 0, streakFreezes: 1, streakLastDay: null, streakFreezeRegenAt: null }, '2026-10-01'],
      [{ streakDays: 3, streakFreezes: 1, streakLastDay: '2026-10-01', streakFreezeRegenAt: null }, '2026-10-01'],
      [{ streakDays: 3, streakFreezes: 1, streakLastDay: '2026-10-01', streakFreezeRegenAt: null }, '2026-10-02'],
      [{ streakDays: 3, streakFreezes: 1, streakLastDay: '2026-10-01', streakFreezeRegenAt: null }, '2026-10-03'],
      [{ streakDays: 3, streakFreezes: 0, streakLastDay: '2026-10-01', streakFreezeRegenAt: '2026-10-08' }, '2026-10-03'],
      [{ streakDays: 3, streakFreezes: 0, streakLastDay: '2026-10-06', streakFreezeRegenAt: '2026-10-08' }, '2026-10-08'],
      [{ streakDays: 3, streakFreezes: 0, streakLastDay: '2026-10-06', streakFreezeRegenAt: '2026-10-08' }, '2026-10-05'],
      [{ streakDays: 9, streakFreezes: 1, streakLastDay: '2026-10-01', streakFreezeRegenAt: null }, '2026-10-04'],
      [{ streakDays: 0, streakFreezes: 1, streakLastDay: '2026-10-01', streakFreezeRegenAt: null }, '2026-10-02'],
      [{ streakDays: 5, streakFreezes: 1, streakLastDay: '2026-02-28', streakFreezeRegenAt: null }, '2026-03-01'],
      [{ streakDays: 5, streakFreezes: 1, streakLastDay: '2026-12-31', streakFreezeRegenAt: null }, '2027-01-02'],
    ];
    for (const [s, d] of edge) cases.push(line({ s, d }, applyStreakOnPlay(s, d)));
    const r = rng(0xb5);
    const base = Date.parse('2026-01-01T00:00:00Z');
    const day = (n: number) => new Date(base + n * 86_400_000).toISOString().slice(0, 10);
    for (let i = 0; i < 100; i++) {
      const last = r.int(0, 300);
      const s: StreakState = {
        streakDays: r.pick([0, 1, 2, 5, 30]),
        streakFreezes: r.int(0, 1),
        streakLastDay: r.bool(0.1) ? null : day(last),
        streakFreezeRegenAt: r.bool(0.5) ? null : day(last + r.int(-3, 8)),
      };
      const d = day(last + r.pick([-1, 0, 1, 1, 2, 2, 3, 7, 8]));
      cases.push(line({ s, d }, applyStreakOnPlay(s, d)));
    }
    expect(cases).toMatchSnapshot();
  });
});

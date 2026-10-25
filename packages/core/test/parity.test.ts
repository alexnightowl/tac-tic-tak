// Drift guard: the core rule copies must behave exactly like the backend
// originals (and the web's levels.ts) on a large seeded input set.
import { describe, expect, it } from 'vitest';
import * as beUnlock from '../../../apps/backend/src/sessions/unlock';
import * as beRating from '../../../apps/backend/src/sessions/rating';
import * as beStreak from '../../../apps/backend/src/sessions/streak';
import * as webLevels from '../../../apps/frontend/src/lib/levels';
import * as core from '../src/rules';

const N = 12_000;

// mulberry32: tiny deterministic PRNG so failures reproduce.
function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  const bool = (p = 0.5) => next() < p;
  return { next, int, pick, bool };
}

const STYLES = ['bullet', 'blitz', 'rapid'] as const;

function genDuration(r: ReturnType<typeof prng>) {
  return r.bool(0.4)
    ? r.pick(core.STYLE_FORMULAS[r.pick(STYLES)].durationPresetsSec)
    : r.int(0, 4000);
}

function genAccuracy(r: ReturnType<typeof prng>) {
  // Hit the exact thresholds often: >= comparisons live there.
  if (r.bool(0.2)) return r.pick([0, 0.65, 0.7, 0.8, 1]);
  return r.next();
}

function genUnlockArgs(r: ReturnType<typeof prng>) {
  const style = r.pick(STYLES);
  const startRating = r.int(400, 3000);
  const stats = {
    solved: r.int(0, 60),
    accuracy: genAccuracy(r),
    peakRating: startRating + r.pick([-50, 0, 75, 100, 120, r.int(-100, 250)]),
  };
  return [style, stats, genDuration(r), startRating] as const;
}

describe('backend unlock.ts parity', () => {
  it('constants match', () => {
    for (const [k, v] of Object.entries(beUnlock)) {
      if (typeof v === 'function') continue;
      expect((core as Record<string, unknown>)[k], k).toEqual(v);
    }
  });

  it('every backend export exists in core', () => {
    for (const mod of [beUnlock, beRating, beStreak]) {
      for (const k of Object.keys(mod)) expect(core, k).toHaveProperty(k);
    }
  });

  it('solvedTarget / evaluateUnlock / isTrainingStyle', () => {
    const r = prng(1);
    for (let i = 0; i < N; i++) {
      const args = genUnlockArgs(r);
      expect(core.solvedTarget(args[0], args[2])).toBe(beUnlock.solvedTarget(args[0], args[2]));
      expect(core.evaluateUnlock(...args)).toEqual(beUnlock.evaluateUnlock(...args));
      const v = r.pick<unknown>(['bullet', 'blitz', 'rapid', 'classical', '', null, 3, undefined, 'BLITZ']);
      expect(core.isTrainingStyle(v)).toBe(beUnlock.isTrainingStyle(v));
    }
  });

  it('evaluateCalibration', () => {
    const r = prng(2);
    for (let i = 0; i < N; i++) {
      const check = beUnlock.evaluateUnlock(...genUnlockArgs(r));
      const startPuzzle = r.int(400, 1600);
      const args = [r.int(400, 3000), startPuzzle, r.int(400, 3000), check, r.int(0, 6)] as const;
      expect(core.evaluateCalibration(...args)).toEqual(beUnlock.evaluateCalibration(...args));
    }
  });

  it('evaluateDemote', () => {
    const r = prng(3);
    for (let i = 0; i < N; i++) {
      const uargs = genUnlockArgs(r);
      const check = beUnlock.evaluateUnlock(...uargs);
      const startRating = uargs[3];
      const ceiling = startRating + r.pick([-25, 0, 25, 50, 51, r.int(-200, 200)]);
      const args = [r.bool() ? check.met : r.bool(), check, startRating, ceiling, r.int(0, 3)] as const;
      expect(core.evaluateDemote(...args)).toEqual(beUnlock.evaluateDemote(...args));
    }
  });
});

describe('backend rating.ts parity', () => {
  function genWindow(r: ReturnType<typeof prng>) {
    return Array.from({ length: r.int(0, 12) }, () => ({
      correct: r.bool(0.6),
      responseMs: r.pick([0, 4000, 12000, r.int(0, 30000)]),
      puzzleRating: r.int(400, 3000),
    }));
  }

  it('computeRatingStep', () => {
    const r = prng(4);
    for (let i = 0; i < N; i++) {
      const cur = r.int(400, 3000);
      const w = genWindow(r);
      const streak = r.int(0, 15);
      expect(core.computeRatingStep(cur, w, streak)).toBe(beRating.computeRatingStep(cur, w, streak));
      expect(core.computeRatingStep(cur, w)).toBe(beRating.computeRatingStep(cur, w));
    }
  });

  it('deriveSessionStats', () => {
    const r = prng(5);
    for (let i = 0; i < N; i++) {
      const w = genWindow(r);
      const start = r.int(400, 3000);
      expect(core.deriveSessionStats(w, start)).toEqual(beRating.deriveSessionStats(w, start));
    }
  });
});

describe('backend streak.ts parity', () => {
  const BASE = Date.UTC(2026, 0, 1);
  const day = (offset: number) => new Date(BASE + offset * 86_400_000).toISOString().slice(0, 10);

  it('constants match', () => {
    expect(core.STREAK_FREEZE_MAX).toBe(beStreak.STREAK_FREEZE_MAX);
    expect(core.STREAK_FREEZE_REGEN_DAYS).toBe(beStreak.STREAK_FREEZE_REGEN_DAYS);
  });

  it('isValidDay', () => {
    const r = prng(6);
    for (let i = 0; i < N; i++) {
      const v = r.pick<unknown>([
        day(r.int(-800, 800)),
        `${r.int(1999, 2030)}-${String(r.int(0, 13)).padStart(2, '0')}-${String(r.int(0, 32)).padStart(2, '0')}`,
        '2026-02-29', '2028-02-29', '2026-1-01', '', null, 20260101, ' 2026-01-01',
      ]);
      expect(core.isValidDay(v)).toBe(beStreak.isValidDay(v));
    }
  });

  it('applyStreakOnPlay', () => {
    const r = prng(7);
    for (let i = 0; i < N; i++) {
      const todayOff = r.int(0, 60);
      const state = {
        streakDays: r.pick([0, 1, r.int(0, 120)]),
        streakFreezes: r.int(0, 1),
        streakLastDay: r.bool(0.1) ? null : day(todayOff - r.pick([0, 1, 2, 3, -1, r.int(-5, 20)])),
        streakFreezeRegenAt: r.bool(0.5) ? null : day(todayOff + r.int(-8, 8)),
      };
      const today = day(todayOff);
      expect(core.applyStreakOnPlay(state, today)).toEqual(beStreak.applyStreakOnPlay(state, today));
    }
  });
});

describe('web levels.ts parity', () => {
  it('shared constants match', () => {
    expect(core.STYLE_FORMULAS).toEqual(webLevels.STYLE_FORMULAS);
    expect(core.UNLOCK_REWARD).toBe(webLevels.UNLOCK_REWARD);
    expect(core.CALIBRATION_SESSIONS).toBe(webLevels.CALIBRATION_SESSIONS);
    expect(core.DEFAULT_STYLE).toBe(webLevels.DEFAULT_STYLE);
    expect(core.UI_STYLE_ORDER).toEqual(webLevels.TRAINING_STYLES);
    expect(core.DIFFICULTY_BANDS).toEqual(webLevels.DIFFICULTY_BANDS);
  });

  it('band icon keys name the web icon files', () => {
    for (const b of core.DIFFICULTY_BANDS) {
      expect(webLevels.BAND_ICON[b.key]).toBe(`/design/icons/${core.BAND_ICON_KEY[b.key]}.webp`);
    }
  });

  it('bandFor / solvedTarget / computeUnlockProgress', () => {
    const r = prng(8);
    for (let i = 0; i < N; i++) {
      const rating = r.pick([399, 400, 1000, 1399, 1800, 2200, 3000, 3500, r.int(0, 3600)]);
      expect(core.bandFor(rating)).toEqual(webLevels.bandFor(rating));
      const [style, stats, dur, startRating] = genUnlockArgs(r);
      expect(core.solvedTarget(style, dur)).toBe(webLevels.solvedTarget(style, dur));
      const s = { ...stats, startRating };
      expect(core.computeUnlockProgress(style, s, dur)).toEqual(webLevels.computeUnlockProgress(style, s, dur));
    }
  });

  it('computeUnlockProgress agrees with backend evaluateUnlock on met flags', () => {
    const r = prng(9);
    for (let i = 0; i < N; i++) {
      const [style, stats, dur, startRating] = genUnlockArgs(r);
      const web = core.computeUnlockProgress(style, { ...stats, startRating }, dur);
      const be = beUnlock.evaluateUnlock(style, stats, dur, startRating);
      expect(web.met).toBe(be.met);
      expect(web.criteria.map((c) => [c.id, c.met, c.current, c.target]))
        .toEqual(be.criteria.map((c) => [c.id, c.met, c.current, c.target]));
    }
  });
});

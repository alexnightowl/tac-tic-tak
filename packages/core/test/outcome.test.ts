import { describe, expect, it } from 'vitest';
import {
  eligibleForUnlock, formatCriterion, progressionPatchOf, rankChangeOf, rankLineKey, summaryOutcome,
  type FinishResponse,
} from '../src/runner';

const base: FinishResponse = { sessionId: 's', solved: 5, failed: 1, accuracy: 0.83, avgResponseMs: 4000, peakRating: 1500 };
const criteria = [
  { id: 'solved' as const, met: true, current: 7, target: 7 },
  { id: 'accuracy' as const, met: true, current: 0.9, target: 0.65 },
  { id: 'peak' as const, met: false, current: 40, target: 75 },
];
const unlockCheck = { met: false, solvedTarget: 7, criteria };
const demote = (o: Partial<NonNullable<FinishResponse['demoteCheck']>>) => ({
  atPeak: true, weak: false, criteriaMet: 2, streakAfter: 0, threshold: 2, penalty: 25, unlockedStartRating: 1500, ...o,
});

describe('rankChangeOf', () => {
  it('null for early, calibration, unknown ceiling and no move', () => {
    expect(rankChangeOf({ ...base, early: true, unlocked: true }, 1350)).toBeNull();
    expect(rankChangeOf({ ...base, unlocked: true, calibration: { active: true, sessionsLeftBefore: 2, sessionsLeftAfter: 1, ceilingBefore: 1200, ceilingAfter: 1250, delta: 50 } }, 1200)).toBeNull();
    expect(rankChangeOf({ ...base, unlocked: true }, null)).toBeNull();
    expect(rankChangeOf({ ...base, unlocked: false, demoted: false }, 1500)).toBeNull();
  });
  it('in-band unlock is an uncrossed up move', () => {
    expect(rankChangeOf({ ...base, unlocked: true }, 1500)).toEqual({
      from: 'intermediate', to: 'intermediate', before: 1500, after: 1550, crossed: false, up: true,
    });
  });
  it('a demotion the server clamped above the old norm is no rank change (Q11)', () => {
    expect(rankChangeOf({ ...base, demoted: true, demoteCheck: demote({ unlockedStartRating: 1575 }) }, 1375)).toBeNull();
  });
  it('crossing up into intermediate and down out of it', () => {
    expect(rankChangeOf({ ...base, unlocked: true }, 1350)).toMatchObject({ from: 'beginner', to: 'intermediate', crossed: true, up: true });
    expect(rankChangeOf({ ...base, demoted: true, demoteCheck: demote({ unlockedStartRating: 1375 }) }, 1400))
      .toMatchObject({ from: 'intermediate', to: 'beginner', crossed: true, up: false, after: 1375 });
  });
});

describe('summaryOutcome', () => {
  it('early exit shows only the note', () => {
    expect(summaryOutcome({ ...base, early: true, unlockCheck, demoteCheck: demote({}) }, 1500)).toMatchObject({ early: true, unlock: null, demote: null });
  });
  it('calibration: nothing until the last session, then the explainer', () => {
    const cal = (left: number) => ({ active: true, sessionsLeftBefore: left + 1, sessionsLeftAfter: left, ceilingBefore: 1200, ceilingAfter: 1350, delta: 150 });
    const mid = summaryOutcome({ ...base, unlocked: true, calibration: cal(2), unlockCheck }, 1200);
    expect(mid).toEqual({ early: false, calibrationComplete: null, comfort: null, unlock: null, demote: null });
    expect(summaryOutcome({ ...base, calibration: cal(0), unlockCheck }, 1200).calibrationComplete).toEqual({ ceiling: 1350, floor: 1300 });
  });
  it('comfort session below the peak band', () => {
    expect(summaryOutcome({ ...base, unlockCheck, demoteCheck: demote({ atPeak: false }) }, 1500).comfort).toEqual({ floor: 1450 });
  });
  it('near miss + weak warning', () => {
    const o = summaryOutcome({ ...base, unlockCheck, demoteCheck: demote({ weak: true, streakAfter: 1 }) }, 1500);
    expect(o.unlock).toEqual({ unlocked: false, criteria });
    expect(o.demote).toEqual({ kind: 'weak', remaining: 1 });
  });
  it('demote uses the real drop; a clamped no-op is a hold (fix)', () => {
    const d = summaryOutcome({ ...base, demoted: true, unlockCheck, demoteCheck: demote({ weak: true, unlockedStartRating: 1475 }) }, 1500);
    expect(d.demote).toEqual({ kind: 'demoted', penalty: 25, ceilingFrom: 1500, ceilingTo: 1475 });
    const clamped = summaryOutcome({ ...base, demoted: true, unlockCheck, demoteCheck: demote({ weak: true, unlockedStartRating: 1500 }) }, 1500);
    expect(clamped.demote).toBeNull();
  });
  it('an unlock hides the demote card', () => {
    const o = summaryOutcome({ ...base, unlocked: true, unlockCheck: { ...unlockCheck, met: true }, demoteCheck: demote({ unlockedStartRating: 1550 }) }, 1500);
    expect(o.unlock?.unlocked).toBe(true);
    expect(o.demote).toBeNull();
  });
});

describe('progressionPatchOf', () => {
  it('calibration and stable sessions patch; early / theme do not', () => {
    expect(progressionPatchOf({ ...base, early: true })).toBeNull();
    expect(progressionPatchOf({ ...base, unlocked: false })).toBeNull();
    expect(progressionPatchOf({ ...base, calibration: { active: true, sessionsLeftBefore: 1, sessionsLeftAfter: 0, ceilingBefore: 1200, ceilingAfter: 1300, delta: 100 } }))
      .toEqual({ unlockedStartRating: 1300, calibrationSessionsLeft: 0, weakSessionStreak: 0 });
    expect(progressionPatchOf({ ...base, demoteCheck: demote({ streakAfter: 1, unlockedStartRating: 1550 }) }))
      .toEqual({ unlockedStartRating: 1550, weakSessionStreak: 1 });
  });
});

describe('helpers', () => {
  it('formatCriterion', () => {
    expect(formatCriterion(criteria[1])).toEqual({ current: '90%', target: '65%' });
    expect(formatCriterion(criteria[2])).toEqual({ current: '+40', target: '+75' });
    expect(formatCriterion(criteria[0])).toEqual({ current: '7', target: '7' });
  });
  it('eligibleForUnlock', () => {
    expect(eligibleForUnlock('mixed', false, 1450, 1500)).toBe(true);
    expect(eligibleForUnlock('mixed', false, 1449, 1500)).toBe(false);
    expect(eligibleForUnlock('theme', false, 1500, 1500)).toBe(false);
    expect(eligibleForUnlock('mixed', true, 1500, 1500)).toBe(false);
  });
  it('rankLineKey', () => {
    expect(rankLineKey(true, 'expert')).toBe('rank.line_final');
    expect(rankLineKey(true, 'advanced')).toBe('rank.line_mangekyo');
    expect(rankLineKey(true, 'beginner')).toBe('rank.line_tomoe');
    expect(rankLineKey(false, 'beginner')).toBe('rank.line_down');
  });
});

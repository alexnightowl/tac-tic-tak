// Session-summary decisions, lifted out of the web SessionSummary
// (apps/frontend/src/app/(app)/play/[id]/page.tsx) so the summary screen
// only renders. Differences from the web are marked "fix:".
import {
  DEMOTE_PEAK_BAND,
  DIFFICULTY_BANDS,
  LEVEL_STEP,
  UNLOCK_REWARD,
  bandFor,
  levelOf,
  type BandKey,
  type CriterionId,
} from '../rules';
import type { FinishResponse } from './types';

/** A norm move that the summary celebrates (gate sound) or the ceremony stages. */
export type RankChange = {
  from: BandKey;
  to: BandKey;
  before: number;
  after: number;
  /** A difficulty band boundary was crossed: the full-screen RankCeremony. */
  crossed: boolean;
  up: boolean;
};

const bandIndex = (k: BandKey) => DIFFICULTY_BANDS.findIndex((b) => b.key === k);

/**
 * web rankChange: null for early exits, calibration, an unknown ceiling,
 * or no movement. `ceilingBefore` is the store's unlockedStartRating
 * captured when the finish was sent (web ceilingAtFinish).
 */
export function rankChangeOf(s: FinishResponse, ceilingBefore: number | null): RankChange | null {
  if (s.early || s.calibration?.active || ceilingBefore == null) return null;
  let after: number | null = null;
  if (s.unlocked) after = ceilingBefore + UNLOCK_REWARD;
  else if (s.demoted && s.demoteCheck) {
    after = s.demoteCheck.unlockedStartRating;
    // fix: the server clamps a demotion at startPuzzleRating, which
    // create() sets to the session's start (up to norm + 200, Q11), so a
    // "demotion" can RAISE the norm. Never celebrate that as a rank up.
    if (after >= ceilingBefore) return null;
  }
  if (after == null || after === ceilingBefore) return null;
  const from = bandFor(ceilingBefore).key;
  const to = bandFor(after).key;
  return {
    from,
    to,
    before: ceilingBefore,
    after,
    crossed: from !== to,
    up: bandIndex(to) > bandIndex(from) || (from === to && after > ceilingBefore),
  };
}

export type DemoteOutcome =
  | { kind: 'demoted'; penalty: number; ceilingFrom: number; ceilingTo: number }
  | { kind: 'weak'; remaining: number };

/** What the summary's outcome area shows (web: three branches). */
export type SummaryOutcome = {
  early: boolean;
  /** Final calibration session: LevelUpExplainer with the locked norm. */
  calibrationComplete: { ceiling: number; floor: number } | null;
  /** Stable session started under the peak band. */
  comfort: { floor: number } | null;
  unlock: { unlocked: boolean; criteria: NonNullable<FinishResponse['unlockCheck']>['criteria'] } | null;
  demote: DemoteOutcome | null;
};

export function summaryOutcome(s: FinishResponse, ceilingBefore: number | null): SummaryOutcome {
  const none: SummaryOutcome = { early: false, calibrationComplete: null, comfort: null, unlock: null, demote: null };
  if (s.early) return { ...none, early: true };
  if (s.calibration?.active) {
    // Calibration is meant to be invisible except on its last session.
    if (s.calibration.sessionsLeftAfter !== 0) return none;
    const ceiling = s.calibration.ceilingAfter;
    return { ...none, calibrationComplete: { ceiling, floor: ceiling - DEMOTE_PEAK_BAND } };
  }
  const d = s.demoteCheck;
  if (d && d.atPeak === false) return { ...none, comfort: { floor: d.unlockedStartRating - DEMOTE_PEAK_BAND } };
  const out: SummaryOutcome = { ...none };
  if (s.unlockCheck) out.unlock = { unlocked: !!s.unlocked, criteria: s.unlockCheck.criteria };
  if (d && !s.unlocked) {
    if (s.demoted) {
      // fix: the web printed the nominal penalty and counted from
      // ceiling + penalty, but the server clamps the drop at
      // startPuzzleRating (Q11), so the numbers could be wrong. Use the
      // real move when the old ceiling is known; a clamped no-op is a hold.
      const to = d.unlockedStartRating;
      const from = ceilingBefore ?? to + d.penalty;
      const penalty = from - to;
      if (penalty > 0) out.demote = { kind: 'demoted', penalty, ceilingFrom: from, ceilingTo: to };
    } else if (d.weak) {
      out.demote = { kind: 'weak', remaining: Math.max(0, d.threshold - d.streakAfter) };
    }
  }
  return out;
}

/** Where a rating sits between its level and the next mark (Play v2). */
export function levelProgress(rating: number, level: number): { next: number; toNext: number; ratio: number } {
  const next = level + LEVEL_STEP;
  return {
    next,
    toNext: Math.max(0, next - rating),
    ratio: Math.min(1, Math.max(0, (rating - level) / LEVEL_STEP)),
  };
}

/** The player's level for a progression; derived from the rating before the server sent one. */
export function levelFor(p: { level?: number; currentPuzzleRating: number }): number {
  return p.level ?? levelOf(p.currentPuzzleRating);
}

/** What a Play v2 rated finish shows: the rating move and the level outcome. */
export type LevelOutcome = {
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  level: number;
  levelBefore: number;
  next: number;
  toNext: number;
  ratio: number;
  up: boolean;
  down: boolean;
  /** First session under the guard line: the level held, one more drops it. */
  guarded: boolean;
  /** Ended early: the rating moved, the level waits for a full session. */
  early: boolean;
  /** The rating cleared the next mark but the session missed the style's pace (D37). */
  paceHeld: boolean;
  /** Solved against the style's pace target; null when the server didn't check it. */
  pace: { solved: number; target: number; met: boolean } | null;
};

export function levelOutcomeOf(s: FinishResponse): LevelOutcome | null {
  if (s.discarded || !s.rating || !s.level) return null;
  const { before, after } = s.rating;
  const lv = s.level;
  const p = levelProgress(after, lv.after);
  return {
    ratingBefore: before,
    ratingAfter: after,
    delta: after - before,
    level: lv.after,
    levelBefore: lv.before,
    next: p.next,
    toNext: p.toNext,
    ratio: p.ratio,
    up: lv.up,
    down: lv.down,
    guarded: !s.early && !lv.down && lv.guardAfter > 0,
    early: !!s.early,
    paceHeld: !!lv.paceHeld,
    pace: lv.pace ?? null,
  };
}

/**
 * The summary's line about the next mark (i18n key + vars): the guard
 * count, how far the next mark is, or — when the rating already cleared it
 * and the level stayed — why: the pace fell short (D37), or the session
 * ended early and the level waits for a full one.
 */
export function levelNextNote(o: LevelOutcome): { key: string; vars: Record<string, number> } {
  if (o.guarded) return { key: 'summary.protected', vars: { n: 1, total: 2 } };
  if (o.ratingAfter >= o.next) {
    if (o.paceHeld && o.pace) return { key: 'level.pace_short', vars: { n: Math.max(1, o.pace.target - o.pace.solved) } };
    return { key: 'level.full_session', vars: { next: levelOf(o.ratingAfter) } };
  }
  return { key: 'play.to_next', vars: { n: o.toNext, next: o.next } };
}

/** A v2 level move across a difficulty band: the RankCeremony. */
export function levelRankChangeOf(s: FinishResponse): RankChange | null {
  const o = levelOutcomeOf(s);
  if (!o || o.early || o.level === o.levelBefore) return null;
  const from = bandFor(o.levelBefore).key;
  const to = bandFor(o.level).key;
  return { from, to, before: o.levelBefore, after: o.level, crossed: from !== to, up: o.level > o.levelBefore };
}

/**
 * The progression fields a saved finish changed, derived from the
 * response (fix: the web never patched the store and relied on the full
 * page reload of its Home / Play again links). Null when nothing moved
 * (early exit, theme, an already-ended session's bare summary).
 */
export function progressionPatchOf(s: FinishResponse): {
  unlockedStartRating?: number;
  calibrationSessionsLeft?: number;
  weakSessionStreak?: number;
  level?: number;
  levelGuard?: number;
} | null {
  if (s.discarded || s.early) return null;
  if (s.level) {
    return {
      level: s.level.after,
      levelGuard: s.level.guardAfter,
      ...(s.settling ? { calibrationSessionsLeft: s.settling.sessionsLeft } : null),
    };
  }
  if (s.calibration?.active) {
    return {
      unlockedStartRating: s.calibration.ceilingAfter,
      calibrationSessionsLeft: s.calibration.sessionsLeftAfter,
      weakSessionStreak: 0,
    };
  }
  if (s.demoteCheck) {
    return { unlockedStartRating: s.demoteCheck.unlockedStartRating, weakSessionStreak: s.demoteCheck.streakAfter };
  }
  return null;
}

/** web formatCriterion: accuracy as %, peak as +N, solved as a count. */
export function formatCriterion(c: { id: CriterionId | string; current: number; target: number }): { current: string; target: string } {
  switch (c.id) {
    case 'accuracy':
      return { current: `${Math.round(c.current * 100)}%`, target: `${Math.round(c.target * 100)}%` };
    case 'peak':
      return { current: `+${c.current}`, target: `+${c.target}` };
    default:
      return { current: String(c.current), target: String(c.target) };
  }
}

/**
 * web sessionEligibleForUnlock: the in-session level-up bar shows for a
 * rated, calibrated session started inside the peak band.
 */
export function eligibleForUnlock(
  sessionMode: 'mixed' | 'theme' | 'casual',
  calibrating: boolean,
  sessionStartRating: number | null,
  unlockedStartRating: number,
): boolean {
  return (
    sessionMode === 'mixed' &&
    !calibrating &&
    sessionStartRating != null &&
    sessionStartRating >= unlockedStartRating - DEMOTE_PEAK_BAND
  );
}

/** Rank-up flavour line per target band (web RankCeremony). */
export function rankLineKey(up: boolean, to: BandKey): string {
  if (!up) return 'rank.line_down';
  return to === 'expert' ? 'rank.line_final' : to === 'advanced' ? 'rank.line_mangekyo' : 'rank.line_tomoe';
}

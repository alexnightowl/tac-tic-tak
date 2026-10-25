// Pure parts of apps/frontend/src/lib/levels.ts. The pieces the web
// duplicates from backend unlock.ts (TrainingStyle, STYLE_FORMULAS,
// solvedTarget, UNLOCK_REWARD, CALIBRATION_SESSIONS, isTrainingStyle)
// come from ./unlock so there is one copy; test/parity.test.ts checks
// the web file still agrees with them.

import {
  DEMOTE_PEAK_BAND,
  STYLE_FORMULAS,
  solvedTarget,
  type TrainingStyle,
} from './unlock';

// ---- Difficulty bands (colouring the rating slider) ---------------------

export type BandKey = 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type Band = {
  min: number;
  max: number;
  key: BandKey;
  color: string;      // hex used on the slider gradient
  glow: string;       // softer variant for badges
};

export const DIFFICULTY_BANDS: Band[] = [
  // Ember on stone: muted progression from graphite to ember red.
  { min: 400,  max: 1000, key: 'novice',       color: '#a5a0a4', glow: 'rgba(165,160,164,0.18)' },
  { min: 1000, max: 1400, key: 'beginner',     color: '#cbc5bf', glow: 'rgba(203,197,191,0.18)' },
  { min: 1400, max: 1800, key: 'intermediate', color: '#d7b777', glow: 'rgba(215,183,119,0.20)' },
  { min: 1800, max: 2200, key: 'advanced',     color: '#ba7058', glow: 'rgba(186,112,88,0.22)' },
  { min: 2200, max: 3000, key: 'expert',       color: '#a64241', glow: 'rgba(166,66,65,0.25)' },
];

export type BandIconKey = 'tomoe-1' | 'tomoe-2' | 'tomoe-3' | 'rank-4' | 'rank-5';

/** Eye marks for the difficulty bands: sharingan with 1–3 tomoe, then
 *  mangekyō and rinnegan for the two top bands. Keys match the web's
 *  /design/icons/<key>.webp file names; the app maps them to require()d
 *  assets. */
export const BAND_ICON_KEY: Record<BandKey, BandIconKey> = {
  novice: 'tomoe-1',
  beginner: 'tomoe-2',
  intermediate: 'tomoe-3',
  advanced: 'rank-4',
  expert: 'rank-5',
};

export function bandFor(rating: number): Band {
  for (const b of DIFFICULTY_BANDS) {
    if (rating >= b.min && rating < b.max) return b;
  }
  return DIFFICULTY_BANDS[DIFFICULTY_BANDS.length - 1];
}

/** Slider edges: each band gets an equal slice of the track. */
export const BAND_EDGES: number[] = [
  DIFFICULTY_BANDS[0].min,
  ...DIFFICULTY_BANDS.map((b) => b.max),
];

// ---- Training styles ----------------------------------------------------

// The web's TRAINING_STYLES is ordered slowest → fastest for every UI
// list; the backend's (re-exported as TRAINING_STYLES) is bullet-first.
// Use this one for anything the player sees.
export const UI_STYLE_ORDER: TrainingStyle[] = ['rapid', 'blitz', 'bullet'];

// ---- Peak band ----------------------------------------------------------

// The web hard-codes PEAK_BAND = 50 in play/page.tsx and play/[id]/page.tsx;
// it is the backend's DEMOTE_PEAK_BAND. Sessions started below this floor
// are comfort-zone sessions: they can't unlock and don't touch the weak
// streak.
export function peakFloor(ceiling: number): number {
  return ceiling - DEMOTE_PEAK_BAND;
}

/** Suggested start rating after a weak at-peak session (play setup's
 *  "off form" notice): one step under the peak band, on the 25 grid. */
export function offFormRating(ceiling: number): number {
  return Math.max(400, Math.floor((peakFloor(ceiling) - 25) / 25) * 25);
}

// ---- Unlock progress ----------------------------------------------------

export type UnlockStats = {
  solved: number;
  accuracy: number;      // 0..1
  peakRating: number;
  startRating: number;
};

export type CriterionId = 'solved' | 'accuracy' | 'peak';

export type CriterionProgress = {
  id: CriterionId;
  ratio: number;
  met: boolean;
  current: number;
  target: number;
};

export function computeUnlockProgress(
  style: TrainingStyle,
  stats: UnlockStats,
  durationSec: number,
): { criteria: CriterionProgress[]; ratio: number; met: boolean } {
  const f = STYLE_FORMULAS[style];
  const target = solvedTarget(style, durationSec);

  const solvedRatio = clamp01(stats.solved / target);
  const accuracyRatio = clamp01(stats.accuracy / f.accuracy);
  const peakDelta = Math.max(0, stats.peakRating - stats.startRating);
  const peakRatio = clamp01(peakDelta / f.peakDelta);

  const criteria: CriterionProgress[] = [
    { id: 'solved',   ratio: solvedRatio,   met: stats.solved >= target,       current: stats.solved,    target },
    { id: 'accuracy', ratio: accuracyRatio, met: stats.accuracy >= f.accuracy, current: stats.accuracy,  target: f.accuracy },
    { id: 'peak',     ratio: peakRatio,     met: peakDelta >= f.peakDelta,     current: peakDelta,       target: f.peakDelta },
  ];

  const overall = Math.min(...criteria.map((c) => c.ratio));
  const met = criteria.every((c) => c.met);
  return { criteria, ratio: overall, met };
}

function clamp01(v: number) {
  if (!Number.isFinite(v) || v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

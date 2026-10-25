import type { Progression } from '@tac/core/api';
import { DEFAULT_STYLE, STYLE_FORMULAS, isTrainingStyle, type TrainingStyle } from '@tac/core/rules';

import { appKV, readJSON, writeJSON } from '@/platform/storage';

// Last setup picks (web play/page.tsx), under the web localStorage key
// names in MMKV `app`. Device prefs: they survive logout, like on the web.
// MMKV is synchronous, so the first frame already has them (no web
// hydration dance).
const LAST_STYLE_KEY = 'taktic.lastStyle';
const LAST_DURATIONS_KEY = 'taktic.lastDurations';

export function readLastStyle(): TrainingStyle {
  const v = appKV.getString(LAST_STYLE_KEY);
  return v && isTrainingStyle(v) ? v : DEFAULT_STYLE;
}

export function writeLastStyle(style: TrainingStyle): void {
  appKV.set(LAST_STYLE_KEY, style);
}

type StoredDurations = Partial<Record<TrainingStyle, number>>;

export function writeLastDuration(style: TrainingStyle, sec: number): void {
  const cur = readJSON<StoredDurations>(appKV, LAST_DURATIONS_KEY, {});
  writeJSON(appKV, LAST_DURATIONS_KEY, { ...cur, [style]: sec });
}

/**
 * web resolveDurationFor, presets only (the slice has no custom field): a
 * stored preset is restored, anything else falls back to presets[1].
 */
export function resolveDuration(style: TrainingStyle): number {
  const presets = STYLE_FORMULAS[style].durationPresetsSec;
  const fallback = presets[1] ?? presets[0];
  const stored = readJSON<StoredDurations>(appKV, LAST_DURATIONS_KEY, {})[style];
  return typeof stored === 'number' && presets.includes(stored) ? stored : fallback;
}

/** Mixed sessions are capped at norm + 200 (server 400s above it). */
export const ratingCap = (p: Progression) => p.unlockedStartRating + 200;

/**
 * web initialStartRating: during calibration the server picks the rating;
 * otherwise follow the rating up but never below the last picked start.
 */
export function initialStartRating(p: Progression): number {
  if (p.calibrationSessionsLeft > 0) return p.currentPuzzleRating;
  return Math.min(Math.max(p.startPuzzleRating, p.currentPuzzleRating), ratingCap(p));
}

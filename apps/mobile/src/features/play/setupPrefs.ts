import type { Progression } from '@tac/core/api';
import { DEFAULT_STYLE, STYLE_FORMULAS, isTrainingStyle, type TrainingStyle } from '@tac/core/rules';

import { appKV, readJSON, writeJSON } from '@/platform/storage';

// Last setup picks (web play/page.tsx), under the web localStorage key
// names in MMKV `app`. Device prefs: they survive logout, like on the web.
// MMKV is synchronous, so the first frame already has them (no web
// hydration dance).
const LAST_STYLE_KEY = 'taktic.lastStyle';
const LAST_DURATIONS_KEY = 'taktic.lastDurations';
/** Mobile-only: the whole last setup, for Home's quick start and Play again. */
const LAST_SETUP_KEY = 'taktic.lastSetup';
/** Mobile-only: the theme picked for theme mode (web kept it in state, default 'fork'). */
const LAST_THEME_KEY = 'taktic.lastTheme';

export const DEFAULT_THEME = 'fork';

export function readLastStyle(): TrainingStyle {
  const v = appKV.getString(LAST_STYLE_KEY);
  return v && isTrainingStyle(v) ? v : DEFAULT_STYLE;
}

export function writeLastStyle(style: TrainingStyle): void {
  appKV.set(LAST_STYLE_KEY, style);
}

export function readLastTheme(): string {
  return appKV.getString(LAST_THEME_KEY) || DEFAULT_THEME;
}

export function writeLastTheme(slug: string): void {
  appKV.set(LAST_THEME_KEY, slug);
}

type StoredDurations = Partial<Record<TrainingStyle, number>>;

export function writeLastDuration(style: TrainingStyle, sec: number): void {
  const cur = readJSON<StoredDurations>(appKV, LAST_DURATIONS_KEY, {});
  writeJSON(appKV, LAST_DURATIONS_KEY, { ...cur, [style]: sec });
}

export type DurationInit = { duration: number; custom: boolean; customMinutes: string };

/**
 * web resolveDurationFor: a stored value outside the style's range (or
 * not finite) falls back to presets[1]; a preset selects the preset; any
 * other value selects custom with that value.
 */
export function resolveDurationFor(style: TrainingStyle): DurationInit {
  const f = STYLE_FORMULAS[style];
  const presets = f.durationPresetsSec;
  const fallback = presets[1] ?? presets[0];
  const stored = readJSON<StoredDurations>(appKV, LAST_DURATIONS_KEY, {})[style];
  const minutes = (s: number) => String(Math.round(s / 60));
  if (typeof stored !== 'number' || !Number.isFinite(stored) || stored < f.minDurationSec || stored > f.maxDurationSec) {
    return { duration: fallback, custom: false, customMinutes: minutes(fallback) };
  }
  if (presets.includes(stored)) return { duration: stored, custom: false, customMinutes: minutes(stored) };
  return { duration: fallback, custom: true, customMinutes: minutes(stored) };
}

/** The style's custom-minutes range (web minMinutes / maxMinutes). */
export function minuteRange(style: TrainingStyle): { min: number; max: number } {
  const f = STYLE_FORMULAS[style];
  return { min: Math.round(f.minDurationSec / 60), max: Math.round(f.maxDurationSec / 60) };
}

/** web customMinutesNum: clamped whole minutes ('' or junk → the minimum). */
export function clampMinutes(style: TrainingStyle, raw: string): number {
  const { min, max } = minuteRange(style);
  return Math.max(min, Math.min(max, Math.floor(Number(raw) || 0)));
}

/** Mixed sessions are capped at norm + 200 (server 400s above it); theme sessions at 3000. */
export const ratingCap = (p: Progression, mode: 'mixed' | 'theme' = 'mixed') =>
  mode === 'theme' ? 3000 : p.unlockedStartRating + 200;

/**
 * web initialStartRating: during calibration the server picks the rating;
 * otherwise follow the rating up but never below the last picked start.
 */
export function initialStartRating(p: Progression): number {
  if (p.calibrationSessionsLeft > 0) return p.currentPuzzleRating;
  return Math.min(Math.max(p.startPuzzleRating, p.currentPuzzleRating), ratingCap(p));
}

export type SessionSetup = {
  style: TrainingStyle;
  durationSec: number;
  mode: 'mixed' | 'theme';
  theme: string | null;
  startRating: number;
};

export function readLastSetup(): SessionSetup | null {
  const s = readJSON<SessionSetup | null>(appKV, LAST_SETUP_KEY, null);
  if (!s || !isTrainingStyle(s.style) || typeof s.durationSec !== 'number') return null;
  if (s.mode !== 'mixed' && s.mode !== 'theme') return null;
  return s;
}

export function writeLastSetup(s: SessionSetup): void {
  writeJSON(appKV, LAST_SETUP_KEY, s);
}

/**
 * The rating a repeat of `setup` starts at with today's progression:
 * mixed follows the setup screen's opening value (the rating may have
 * moved since), theme keeps the picked rating (unrated practice).
 */
export function repeatStartRating(setup: SessionSetup, p: Progression): number {
  if (setup.mode === 'theme') return Math.min(3000, Math.max(400, setup.startRating));
  return Math.min(initialStartRating(p), ratingCap(p));
}

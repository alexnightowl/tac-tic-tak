import type { Progression } from '@tac/core/api';
import { DEFAULT_STYLE, STYLE_FORMULAS, isTrainingStyle, type TrainingStyle } from '@tac/core/rules';
import { levelFor } from '@tac/core/runner';

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

/** Play v2: the casual / theme difficulty range (design PlayV2Casual slider). */
export const DIFFICULTY_MIN = 600;
export const DIFFICULTY_MAX = 2600;
export const DIFFICULTY_STEP = 10;

export function clampDifficulty(v: number): number {
  const stepped = Math.round(v / DIFFICULTY_STEP) * DIFFICULTY_STEP;
  return Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, stepped));
}

/** mixed = Rated (starts at the server's rating), casual and theme are unrated. */
export type SetupMode = 'mixed' | 'casual' | 'theme';

export type SessionSetup = {
  style: TrainingStyle;
  durationSec: number;
  mode: SetupMode;
  theme: string | null;
  startRating: number;
  /** Blind mode (D40): the look time in seconds; absent = not blind. */
  blindPreviewSec?: number | null;
};

export function readLastSetup(): SessionSetup | null {
  const s = readJSON<SessionSetup | null>(appKV, LAST_SETUP_KEY, null);
  if (!s || !isTrainingStyle(s.style) || typeof s.durationSec !== 'number') return null;
  if (s.mode !== 'mixed' && s.mode !== 'casual' && s.mode !== 'theme') return null;
  return s;
}

export function writeLastSetup(s: SessionSetup): void {
  writeJSON(appKV, LAST_SETUP_KEY, s);
}

/**
 * The rating a repeat of `setup` starts at with today's progression: a
 * rated session starts at the level (D39; the server decides anyway),
 * casual and theme keep the picked difficulty.
 */
export function repeatStartRating(setup: SessionSetup, p: Progression): number {
  if (setup.mode === 'mixed') return levelFor(p);
  return clampDifficulty(setup.startRating);
}

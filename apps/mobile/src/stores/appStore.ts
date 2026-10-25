import type { MeResponse, Progression, Progressions, Streak, UserSettings } from '@tac/core/api';
import type { Language } from '@tac/core/i18n';
import type { TrainingStyle } from '@tac/core/rules';
import { create } from 'zustand';

import { setFeelPrefs } from '@/feel';
import { appKV, readJSON, writeJSON } from '@/platform/storage';

// Account-scoped client state (PLAN §2.4), a port of the web useAppStore.
// Every field is read synchronously from MMKV `app` when this module loads,
// so the first frame after a cold start already has the language, settings
// and ratings; /users/me then revalidates in the background.

export const APP_KEYS = {
  /** Web key names, so the shapes stay interchangeable. */
  settings: 'taktic.settings',
  lang: 'taktic.lang',
  progressions: 'taktic.progressions',
  streak: 'taktic.streak',
} as const;

/** Web DEFAULT_SETTINGS (store.ts) plus the row's reviewAutoAdvance. */
export const DEFAULT_SETTINGS: UserSettings = {
  focusMode: false,
  accentColor: '#c72a2f',
  boardTheme: 'stone',
  pieceSet: 'classic',
  soundEnabled: true,
  soundPack: 'wood',
  language: 'en',
  fixedColor: 'auto',
  animationSpeed: 'normal',
  knightArrow: 'bent',
  showStreak: true,
  reviewAutoAdvance: false,
  mirrorView: false,
  onboardingCompleted: false,
};

const EMPTY_PROGRESSION: Progression = {
  startPuzzleRating: 1200,
  currentPuzzleRating: 1200,
  unlockedStartRating: 1200,
  calibrationSessionsLeft: 5,
  weakSessionStreak: 0,
};

export const DEFAULT_PROGRESSIONS: Progressions = {
  bullet: { ...EMPTY_PROGRESSION },
  blitz: { ...EMPTY_PROGRESSION },
  rapid: { ...EMPTY_PROGRESSION },
};

export const EMPTY_STREAK: Streak = { days: 0, freezes: 1, lastDay: null, freezeRegenAt: null };

function isLang(v: unknown): v is Language {
  return v === 'en' || v === 'uk';
}

function hydrate() {
  const lang = appKV.getString(APP_KEYS.lang);
  const settings = { ...DEFAULT_SETTINGS, ...readJSON<Partial<UserSettings>>(appKV, APP_KEYS.settings, {}) };
  // taktic.lang outlives logout (login screen language), settings do not.
  if (isLang(lang)) settings.language = lang;
  const stored = readJSON<Partial<Progressions>>(appKV, APP_KEYS.progressions, {});
  const progressions: Progressions = {
    bullet: { ...EMPTY_PROGRESSION, ...stored.bullet },
    blitz: { ...EMPTY_PROGRESSION, ...stored.blitz },
    rapid: { ...EMPTY_PROGRESSION, ...stored.rapid },
  };
  const streak = { ...EMPTY_STREAK, ...readJSON<Partial<Streak>>(appKV, APP_KEYS.streak, {}) };
  return { settings, progressions, streak };
}

type AppState = {
  settings: UserSettings;
  progressions: Progressions;
  streak: Streak;
  /** Applies a GET /users/me body (login, cold start, ['me'] refetch). */
  applyMe: (me: MeResponse) => void;
  setSettings: (patch: Partial<UserSettings>) => void;
  setProgressions: (p: Progressions) => void;
  patchStyleProgression: (style: TrainingStyle, patch: Partial<Progression>) => void;
  setStreak: (s: Streak) => void;
  /** Logout: drop account data, keep the language. */
  reset: () => void;
};

function persistSettings(next: UserSettings, prev: UserSettings | null) {
  writeJSON(appKV, APP_KEYS.settings, next);
  if (!prev || prev.language !== next.language) appKV.set(APP_KEYS.lang, next.language);
  // soundEnabled is an account setting; the feel layer reads its own copy
  // synchronously on the emit path (src/feel/prefs.ts).
  if (!prev || prev.soundEnabled !== next.soundEnabled) setFeelPrefs({ soundEnabled: next.soundEnabled });
}

const initial = hydrate();

export const useAppStore = create<AppState>((set, get) => ({
  ...initial,
  applyMe: (me) => {
    const prev = get().settings;
    const settings: UserSettings = me.settings
      ? { ...DEFAULT_SETTINGS, ...me.settings, language: isLang(me.settings.language) ? me.settings.language : 'en' }
      : prev;
    const progressions = me.progressions ?? DEFAULT_PROGRESSIONS;
    const streak = me.streak ?? EMPTY_STREAK;
    persistSettings(settings, prev);
    writeJSON(appKV, APP_KEYS.progressions, progressions);
    writeJSON(appKV, APP_KEYS.streak, streak);
    set({ settings, progressions, streak });
  },
  setSettings: (patch) => {
    const prev = get().settings;
    const settings = { ...prev, ...patch };
    persistSettings(settings, prev);
    set({ settings });
  },
  setProgressions: (progressions) => {
    writeJSON(appKV, APP_KEYS.progressions, progressions);
    set({ progressions });
  },
  patchStyleProgression: (style, patch) => {
    const cur = get().progressions;
    const progressions = { ...cur, [style]: { ...cur[style], ...patch } };
    writeJSON(appKV, APP_KEYS.progressions, progressions);
    set({ progressions });
  },
  setStreak: (streak) => {
    writeJSON(appKV, APP_KEYS.streak, streak);
    set({ streak });
  },
  reset: () => {
    const language = get().settings.language;
    appKV.remove(APP_KEYS.settings);
    appKV.remove(APP_KEYS.progressions);
    appKV.remove(APP_KEYS.streak);
    set({
      settings: { ...DEFAULT_SETTINGS, language },
      progressions: DEFAULT_PROGRESSIONS,
      streak: EMPTY_STREAK,
    });
  },
}));

/** Non-hook read for imperative code (runner, api callbacks). */
export const appStore = useAppStore;

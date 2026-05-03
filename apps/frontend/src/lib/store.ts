import { create } from 'zustand';
import type { SoundPack } from './sound';
import { TRAINING_STYLES, TrainingStyle } from './levels';

/** Picks black or white — whichever reads on the given accent hex.
 *  Uses perceived luminance (ITU-R BT.601 coefficients). Threshold
 *  tuned so mid-red (#d81f26) still gets white text. */
function accentContrast(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#fff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#fff';
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#000' : '#fff';
}

export type Language = 'en' | 'uk';
export type ColorMode = 'auto' | 'white' | 'black';
export type AnimationSpeed = 'instant' | 'fast' | 'normal' | 'slow';
export type KnightArrowMode = 'bent' | 'straight';

export const ANIMATION_MS: Record<AnimationSpeed, number> = {
  instant: 0,
  fast: 160,
  normal: 280,
  slow: 460,
};

export type UserSettings = {
  focusMode: boolean;
  accentColor: string;
  boardTheme: string;
  pieceSet: string;
  soundEnabled: boolean;
  soundPack: SoundPack;
  language: Language;
  fixedColor: ColorMode;
  animationSpeed: AnimationSpeed;
  knightArrow: KnightArrowMode;
  /** Toggle to hide the daily-streak UI for users who'd rather
   *  not see it. Server still tracks the streak; this only gates
   *  the badges on dashboard / leaderboard / profile. */
  showStreak: boolean;
};

export type Streak = {
  /** Current streak length in days. 0 = never played or just reset. */
  days: number;
  /** Freezes available to absorb a single missed day. Capped at 1. */
  freezes: number;
  /** Last counted play day in the user's local TZ ('YYYY-MM-DD'). */
  lastDay: string | null;
  /** Day a consumed freeze regenerates ('YYYY-MM-DD'); null when no
   *  freeze is regenerating. */
  freezeRegenAt: string | null;
};

const EMPTY_STREAK: Streak = {
  days: 0,
  freezes: 1,
  lastDay: null,
  freezeRegenAt: null,
};

export type AuthUser = {
  id: string;
  nickname: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  country?: string | null;
};

export type Progression = {
  startPuzzleRating: number;
  currentPuzzleRating: number;
  unlockedStartRating: number;
  /** Rated sessions left in the provisional period. While > 0 the
   *  ceiling rides peakRating freely; in-session UI hides the unlock
   *  criteria bar and shows a calibration counter instead. */
  calibrationSessionsLeft: number;
};
export type Progressions = Record<TrainingStyle, Progression>;

const EMPTY_PROGRESSION: Progression = {
  startPuzzleRating: 1200,
  currentPuzzleRating: 1200,
  unlockedStartRating: 1200,
  calibrationSessionsLeft: 5,
};

const DEFAULT_PROGRESSIONS: Progressions = TRAINING_STYLES.reduce((acc, s) => {
  acc[s] = { ...EMPTY_PROGRESSION };
  return acc;
}, {} as Progressions);

type State = {
  user: AuthUser | null;
  settings: UserSettings;
  progressions: Progressions;
  streak: Streak;
  /** Flips to true once settings have been resolved from localStorage
   *  cache or the backend, so surfaces that care about user theme (the
   *  board, piece set) can hold their first paint and never flash the
   *  defaults. */
  settingsReady: boolean;
  setUser: (u: AuthUser | null) => void;
  patchUser: (patch: Partial<AuthUser>) => void;
  setSettings: (s: Partial<UserSettings>) => void;
  setProgressions: (p: Progressions) => void;
  patchStyleProgression: (style: TrainingStyle, patch: Partial<Progression>) => void;
  setStreak: (s: Streak) => void;
  setSettingsReady: (v: boolean) => void;
};

const DEFAULT_SETTINGS: UserSettings = {
  focusMode: false,
  accentColor: '#d81f26',
  boardTheme: 'green',
  pieceSet: 'maestro',
  soundEnabled: true,
  soundPack: 'wood',
  language: 'en',
  fixedColor: 'auto',
  animationSpeed: 'normal',
  knightArrow: 'bent',
  showStreak: true,
};

export const useAppStore = create<State>((set) => ({
  user: null,
  settings: DEFAULT_SETTINGS,
  progressions: DEFAULT_PROGRESSIONS,
  streak: EMPTY_STREAK,
  settingsReady: false,
  setSettingsReady: (v) => set({ settingsReady: v }),
  setUser: (user) => set({ user }),
  patchUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
  setSettings: (patch) => set((s) => {
    const next = { ...s.settings, ...patch };
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--accent', next.accentColor);
      document.documentElement.style.setProperty('--accent-contrast', accentContrast(next.accentColor));
    }
    if (typeof window !== 'undefined') {
      // Persist the language choice so it carries across reloads and to the
      // landing page (same key it reads from).
      if ('language' in patch) {
        try { window.localStorage.setItem('taktic.lang', next.language); } catch {}
      }
      // Mirror the full settings object so authed pages can hydrate from
      // cache on reload — otherwise the board flashes with the default
      // theme while /users/me is in-flight.
      try { window.localStorage.setItem('taktic.settings', JSON.stringify(next)); } catch {}
    }
    return { settings: next };
  }),
  setProgressions: (progressions) => set({ progressions }),
  setStreak: (streak) => set({ streak }),
  patchStyleProgression: (style, patch) => set((s) => ({
    progressions: {
      ...s.progressions,
      [style]: { ...s.progressions[style], ...patch },
    },
  })),
}));

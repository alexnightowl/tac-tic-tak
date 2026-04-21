import { create } from 'zustand';
import type { SoundPack } from './sound';
import { DEFAULT_STYLE, TRAINING_STYLES, TrainingStyle } from './levels';

export type Language = 'en' | 'uk';
export type ColorMode = 'auto' | 'white' | 'black';
export type AnimationSpeed = 'instant' | 'fast' | 'normal' | 'slow';

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
  defaultStyle: TrainingStyle;
};

type AuthUser = { id: string; nickname: string };

export type Progression = { startPuzzleRating: number; currentPuzzleRating: number; unlockedStartRating: number };
export type Progressions = Record<TrainingStyle, Progression>;

const EMPTY_PROGRESSION: Progression = {
  startPuzzleRating: 1200,
  currentPuzzleRating: 1200,
  unlockedStartRating: 1200,
};

const DEFAULT_PROGRESSIONS: Progressions = TRAINING_STYLES.reduce((acc, s) => {
  acc[s] = { ...EMPTY_PROGRESSION };
  return acc;
}, {} as Progressions);

type State = {
  user: AuthUser | null;
  settings: UserSettings;
  progressions: Progressions;
  setUser: (u: AuthUser | null) => void;
  setSettings: (s: Partial<UserSettings>) => void;
  setProgressions: (p: Progressions) => void;
  patchStyleProgression: (style: TrainingStyle, patch: Partial<Progression>) => void;
};

const DEFAULT_SETTINGS: UserSettings = {
  focusMode: true,
  accentColor: '#22c55e',
  boardTheme: 'green',
  pieceSet: 'cburnett',
  soundEnabled: true,
  soundPack: 'wood',
  language: 'en',
  fixedColor: 'auto',
  animationSpeed: 'normal',
  defaultStyle: DEFAULT_STYLE,
};

export const useAppStore = create<State>((set) => ({
  user: null,
  settings: DEFAULT_SETTINGS,
  progressions: DEFAULT_PROGRESSIONS,
  setUser: (user) => set({ user }),
  setSettings: (patch) => set((s) => {
    const next = { ...s.settings, ...patch };
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--accent', next.accentColor);
    }
    return { settings: next };
  }),
  setProgressions: (progressions) => set({ progressions }),
  patchStyleProgression: (style, patch) => set((s) => ({
    progressions: {
      ...s.progressions,
      [style]: { ...s.progressions[style], ...patch },
    },
  })),
}));

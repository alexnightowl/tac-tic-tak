import { create } from 'zustand';
import type { SoundPack } from './sound';

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
};

type AuthUser = { id: string; nickname: string };

type Progression = { startPuzzleRating: number; currentPuzzleRating: number; unlockedStartRating: number } | null;

type State = {
  user: AuthUser | null;
  settings: UserSettings;
  progression: Progression;
  setUser: (u: AuthUser | null) => void;
  setSettings: (s: Partial<UserSettings>) => void;
  setProgression: (p: Progression | ((prev: Progression) => Progression)) => void;
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
};

export const useAppStore = create<State>((set) => ({
  user: null,
  settings: DEFAULT_SETTINGS,
  progression: null,
  setUser: (user) => set({ user }),
  setSettings: (patch) => set((s) => {
    const next = { ...s.settings, ...patch };
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--accent', next.accentColor);
    }
    return { settings: next };
  }),
  setProgression: (p) => set((s) => ({ progression: typeof p === 'function' ? (p as any)(s.progression) : p })),
}));

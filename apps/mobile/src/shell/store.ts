import { create } from 'zustand';

// Shell-only UI state that is not account data. In memory only.
type ShellState = {
  /** Dev/QA: show the offline banner without cutting the network (simulators can't). */
  forceOffline: boolean;
  setForceOffline: (v: boolean) => void;
};

export const useShellStore = create<ShellState>((set) => ({
  forceOffline: false,
  setForceOffline: (forceOffline) => set({ forceOffline }),
}));

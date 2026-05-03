'use client';

import { create } from 'zustand';

export type ToastTone = 'achievement' | 'info';

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Slug of an achievement, when tone === 'achievement'. The
   *  container reads it to pick the lucide-icon to draw. */
  achievementSlug?: string;
};

type ToastStore = {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => set((s) => ({
    toasts: [...s.toasts, { ...t, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }],
  })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

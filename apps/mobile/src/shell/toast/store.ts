import type { ComponentType } from 'react';
import { create } from 'zustand';

import { feel } from '@/feel';

// Port of the web toast store (apps/frontend/src/lib/toast.ts): same shape,
// same id scheme, push/dismiss/clear. Mobile adds an imperative `toast` API
// so non-React code (api callbacks, the runner) can raise one, plus an
// icon registry the achievements stream fills (web ACHIEVEMENT_ICON_MAP).

export type ToastTone = 'achievement' | 'info';

/** lucide-react-native icons satisfy this. */
export type ToastIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Slug of an achievement, when tone === 'achievement' (picks the icon). */
  achievementSlug?: string;
  /** Explicit icon; wins over the slug lookup (resolved at push). */
  icon?: ToastIcon;
  /** Overrides the 4.5 s auto-dismiss (0 = stays until swiped). */
  durationMs?: number;
};

export type ToastInput = Omit<Toast, 'id' | 'tone'> & { tone?: ToastTone };

type ToastStore = {
  toasts: Toast[];
  push: (t: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // The slug's icon resolves now, so the card renders a plain prop.
    const icon = t.icon ?? achievementIcon(t.achievementSlug);
    set((s) => ({ toasts: [...s.toasts, { tone: 'info', ...t, icon, id }] }));
    // Throttled in feel (several unlocks at once buzz once).
    if (t.tone === 'achievement') feel.emit('achievementToast');
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

let achievementIcons: Record<string, ToastIcon> = {};

/** The achievements stream registers its slug → icon map once at startup. */
export function setAchievementIcons(map: Record<string, ToastIcon>): void {
  achievementIcons = map;
}

export function achievementIcon(slug: string | undefined): ToastIcon | undefined {
  return slug ? achievementIcons[slug] : undefined;
}

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Imperative API for every stream: `toast.show({ title })`, `toast.achievements(r.achievementsUnlocked, t)`. */
export const toast = {
  show: (t: ToastInput): string => useToastStore.getState().push(t),
  dismiss: (id: string): void => useToastStore.getState().dismiss(id),
  clear: (): void => useToastStore.getState().clear(),
  /** One achievement toast per unlocked slug, as every web caller did. */
  achievements: (slugs: readonly string[] | null | undefined, t: T): void => {
    for (const slug of slugs ?? []) {
      useToastStore.getState().push({
        tone: 'achievement',
        title: t(`achv.${slug}.name`),
        description: t(`achv.${slug}.desc`),
        achievementSlug: slug,
      });
    }
  },
};

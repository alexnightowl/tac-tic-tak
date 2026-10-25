import type { UserSettings } from '@tac/core/api';

import { apiClient } from '@/platform/api';
import { appStore } from '@/stores/appStore';
import { authStore } from '@/stores/authStore';
import { translatorFor } from '@/ui/lang';
import { toast } from './toast/store';

/**
 * PATCH /users/me/settings, optimistic with rollback (PLAN §2.4; the web
 * patched the store and never rolled back). Unlocked achievements surface
 * as toasts, like the web settings page. Shared by the avatar-menu language
 * switch and the settings stream. Resolves false when the server refused
 * (the store is back to its previous values by then).
 */
export async function patchSettings(patch: Partial<UserSettings>): Promise<boolean> {
  const prev = appStore.getState().settings;
  const rollback = Object.fromEntries(
    Object.keys(patch).map((k) => [k, prev[k as keyof UserSettings]]),
  ) as Partial<UserSettings>;
  appStore.getState().setSettings(patch);
  // Signed out (login screen language): local only.
  if (authStore.getState().status === 'anon') return true;
  try {
    const r = await apiClient.patch<{ achievementsUnlocked?: string[] }>('/users/me/settings', patch);
    // Toast in the language the user just chose.
    toast.achievements(r?.achievementsUnlocked, translatorFor(appStore.getState().settings.language).t);
    return true;
  } catch {
    appStore.getState().setSettings(rollback);
    return false;
  }
}

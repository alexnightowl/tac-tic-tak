import type { UserSettings } from '@tac/core/api';

import { patchSettings } from '@/shell/settings';
import { toast } from '@/shell/toast/store';
import { appStore } from '@/stores/appStore';
import { translatorFor } from '@/ui/lang';

/**
 * The settings screens' save: the shell's optimistic PATCH with rollback,
 * plus a toast when it rolled back (the account-sheet switch rolls back
 * silently; on a settings screen the reverting control needs a reason).
 */
export async function saveSettings(patch: Partial<UserSettings>): Promise<boolean> {
  const ok = await patchSettings(patch);
  if (!ok) {
    const t = translatorFor(appStore.getState().settings.language).t;
    toast.show({ title: t('settings.save_failed') });
  }
  return ok;
}

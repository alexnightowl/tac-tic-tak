import { queryKeys } from '@tac/core/api';
import { useState } from 'react';

import { feel } from '@/feel';
import { apiClient } from '@/platform/api';
import { queryClient } from '@/platform/query';
import { toast } from '@/shell/toast/store';
import { useAuthStore } from '@/stores/authStore';
import { confirm } from '@/ui/ConfirmSheet';
import { useT } from '@/ui/lang';

export const NAME_MAX = 40;
export const BIO_MAX = 280;
const COUNTRY_RE = /^[A-Za-z]{2}$/;

export type ProfileFields = { displayName: string | null; bio: string | null; country: string | null };

/**
 * The profile editor's form (display name, bio, country): fields, limits,
 * dirty state and the explicit Save (PATCH /users/me/profile, then the
 * cached user, /users/me and the profile refresh, a toast and any unlocks).
 * Shared by the phone page sheet and the desktop dialog.
 */
export function useProfileForm(initial: ProfileFields, onSaved: () => void) {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const [displayName, setDisplayName] = useState(initial.displayName ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [country, setCountryRaw] = useState((initial.country ?? '').toUpperCase());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nameValid = displayName.length <= NAME_MAX;
  const bioValid = bio.length <= BIO_MAX;
  const countryValid = country.length === 0 || COUNTRY_RE.test(country);
  const valid = nameValid && bioValid && countryValid;
  const dirty =
    displayName !== (initial.displayName ?? '') ||
    bio !== (initial.bio ?? '') ||
    country.toLowerCase() !== (initial.country ?? '').toLowerCase();

  /** Two Latin letters, upper-cased as typed. */
  const setCountry = (v: string) => setCountryRaw(v.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase());

  const save = async () => {
    if (!valid) {
      feel.emit('formError');
      return;
    }
    setErr(null);
    setSaving(true);
    try {
      const r = await apiClient.patch<ProfileFields & { achievementsUnlocked?: string[] }>('/users/me/profile', {
        displayName,
        bio,
        country,
      });
      if (user) useAuthStore.getState().setUser({ ...user, displayName: r.displayName });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
      if (user) void queryClient.invalidateQueries({ queryKey: queryKeys.profile(user.nickname.toLowerCase()) });
      toast.show({ title: t('profile.saved') });
      toast.achievements(r.achievementsUnlocked, t);
      onSaved();
    } catch {
      feel.emit('formError');
      setErr(t('profile.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  /** Close, asking first when there are unsaved changes. */
  const requestClose = (onClose: () => void) => {
    if (!dirty) {
      onClose();
      return;
    }
    feel.emit('exitSheet');
    confirm({
      testID: 'profile-discard',
      title: t('profile.discard_title'),
      confirmLabel: t('profile.discard'),
      cancelLabel: t('profile.keep_editing'),
      onConfirm: onClose,
    });
  };

  return {
    displayName,
    setDisplayName,
    bio,
    setBio,
    country,
    setCountry,
    saving,
    err,
    nameValid,
    bioValid,
    countryValid,
    valid,
    dirty,
    save,
    requestClose,
  };
}

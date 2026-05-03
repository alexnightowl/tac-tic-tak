'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X, Loader2 } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { useToastStore } from '@/lib/toast';
import { Avatar } from '@/components/Avatar';
import { AvatarPickerButton } from '@/components/AvatarCropper';

type Props = {
  onSaved?: () => void;
};

export function ProfileEditor({ onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-3 rounded-lg text-xs bg-white/5 hover:bg-white/10 border border-[var(--border)] flex items-center gap-1.5"
      >
        <Pencil size={14} /> {t('profile.edit')}
      </button>
      {open && <EditorDialog onClose={() => { setOpen(false); onSaved?.(); }} />}
    </>
  );
}

function EditorDialog({ onClose }: { onClose: () => void }) {
  const user = useAppStore((s) => s.user);
  const patchUser = useAppStore((s) => s.patchUser);
  const pushToast = useToastStore((s) => s.push);
  const t = useT();

  const pushAchievementToasts = (slugs?: string[]) => {
    if (!slugs || slugs.length === 0) return;
    for (const slug of slugs) {
      pushToast({
        tone: 'achievement',
        title: t(`achv.${slug}.name`),
        description: t(`achv.${slug}.desc`),
        achievementSlug: slug,
      });
    }
  };

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [country, setCountry] = useState(user?.country ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const nameValid = displayName.length === 0 || (displayName.length >= 1 && displayName.length <= 40);
  const bioValid = bio.length <= 280;
  const countryValid = country.length === 0 || /^[A-Za-z]{2}$/.test(country);
  const canSave = nameValid && bioValid && countryValid;

  const save = async () => {
    setErr(null);
    setSaving(true);
    try {
      const updated = await http.patch<{
        displayName: string | null;
        bio: string | null;
        country: string | null;
        achievementsUnlocked?: string[];
      }>(
        '/users/me/profile',
        { displayName, bio, country },
      );
      patchUser({
        displayName: updated.displayName,
        bio: updated.bio,
        country: updated.country,
      });
      pushAchievementToasts(updated.achievementsUnlocked);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (dataUrl: string) => {
    const res = await http.post<{ avatarUrl: string; achievementsUnlocked?: string[] }>(
      '/users/me/avatar', { dataUrl },
    );
    patchUser({ avatarUrl: res.avatarUrl });
    pushAchievementToasts(res.achievementsUnlocked);
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
         onClick={onClose}>
      <div className="glass rounded-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-soft)]">
          <div className="text-sm font-semibold">{t('profile.edit_title')}</div>
          <button onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Avatar nickname={user?.nickname ?? ''} avatarUrl={user?.avatarUrl} size={64} />
            <AvatarPickerButton onUploaded={uploadAvatar} label={t('profile.change_avatar')} />
          </div>

          <Field
            label={t('profile.display_name')}
            hint={`${displayName.length}/40`}
            invalid={!nameValid}
          >
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              className="w-full h-10 rounded-lg bg-black/30 border border-[var(--border)] px-3 text-sm"
              placeholder={user?.nickname}
            />
          </Field>

          <Field
            label={t('profile.bio')}
            hint={`${bio.length}/280`}
            invalid={!bioValid}
          >
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              className="w-full rounded-lg bg-black/30 border border-[var(--border)] px-3 py-2 text-sm resize-none"
              placeholder={t('profile.bio_placeholder')}
            />
          </Field>

          <Field
            label={t('profile.country')}
            hint={t('profile.country_hint')}
            invalid={!countryValid}
          >
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value.slice(0, 2))}
              maxLength={2}
              className="w-full h-10 rounded-lg bg-black/30 border border-[var(--border)] px-3 text-sm uppercase"
              placeholder="UA"
            />
          </Field>

          {err && <div className="text-xs text-rose-400">{err}</div>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-[var(--border)] text-sm">
              {t('common.cancel')}
            </button>
            <button
              onClick={save}
              disabled={saving || !canSave}
              className="flex-1 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />} {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, hint, invalid, children }: {
  label: string; hint?: string; invalid?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs uppercase tracking-wider text-zinc-400">{label}</label>
        {hint && (
          <span className={`text-[10px] tabular-nums ${invalid ? 'text-rose-400' : 'text-zinc-500'}`}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User as UserIcon, Gamepad2, Smartphone, LogOut, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { http, setToken } from '@/lib/api';
import { useAppStore, ColorMode, Language, UserSettings, AnimationSpeed, KnightArrowMode } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Card, CardTitle } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { Segmented } from '@/components/ui/segmented';
import { Avatar } from '@/components/Avatar';
import { AvatarPickerButton } from '@/components/AvatarCropper';
import { useToastStore } from '@/lib/toast';
import { cn } from '@/lib/utils';

type Tab = 'profile' | 'gameplay' | 'app';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const t = useT();
  const [saving, setSaving] = useState(false);

  const pushToast = useToastStore((s) => s.push);

  async function patch(p: Partial<UserSettings>) {
    setSettings(p);
    setSaving(true);
    try {
      const r = await http.patch<{ achievementsUnlocked?: string[] }>('/users/me/settings', p);
      if (r.achievementsUnlocked && r.achievementsUnlocked.length > 0) {
        for (const slug of r.achievementsUnlocked) {
          pushToast({
            tone: 'achievement',
            title: t(`achv.${slug}.name`),
            description: t(`achv.${slug}.desc`),
            achievementSlug: slug,
          });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-[22px] text-eos-bone">
        {t('settings.title')}
        {saving && <span className="text-xs text-zinc-500 ml-2 font-normal">{t('settings.saving')}</span>}
      </h1>

      <TabBar tab={tab} onChange={setTab} t={t} />

      {tab === 'profile' && <ProfileTab />}
      {tab === 'gameplay' && <GameplayTab settings={settings} patch={patch} t={t} />}
      {tab === 'app' && <AppTab settings={settings} patch={patch} t={t} />}
    </div>
  );
}

function TabBar({ tab, onChange, t }: { tab: Tab; onChange: (t: Tab) => void; t: (k: string) => string }) {
  const tabs: Array<{ k: Tab; Icon: typeof UserIcon; label: string }> = [
    { k: 'profile',  Icon: UserIcon,   label: t('settings.tab.profile') },
    { k: 'gameplay', Icon: Gamepad2,   label: t('settings.tab.gameplay') },
    { k: 'app',      Icon: Smartphone, label: t('settings.tab.app') },
  ];
  return (
    <div role="tablist" className="flex gap-6 px-1 shadow-[inset_0_-1px_0_var(--eos-seam)]">
      {tabs.map(({ k, Icon, label }) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          aria-label={label}
          className={cn(
            'h-11 text-sm font-bold flex items-center gap-2 transition-colors',
            tab === k
              ? 'text-eos-bone shadow-[inset_0_-2px_0_var(--eos-ember)]'
              : 'text-eos-dust hover:text-eos-bone',
          )}
        >
          <Icon size={14} className="shrink-0 hidden sm:block" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
  );
}

function ProfileTab() {
  const user = useAppStore((s) => s.user);
  const patchUser = useAppStore((s) => s.patchUser);
  const setUser = useAppStore((s) => s.setUser);
  const router = useRouter();
  const t = useT();

  const logout = () => {
    setToken(null);
    setUser(null);
    router.replace('/login');
  };
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [country, setCountry] = useState(user?.country ?? '');
  const [savingField, setSavingField] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const commit = async (patch: Record<string, string>) => {
    setErr(null);
    setSavingField(true);
    try {
      const updated = await http.patch<any>('/users/me/profile', patch);
      patchUser({
        displayName: updated.displayName,
        bio: updated.bio,
        country: updated.country,
      });
    } catch (e: any) {
      setErr(e?.message ?? 'Save failed');
    } finally {
      setSavingField(false);
    }
  };

  const uploadAvatar = async (dataUrl: string) => {
    const res = await http.post<{ avatarUrl: string }>('/users/me/avatar', { dataUrl });
    patchUser({ avatarUrl: res.avatarUrl });
  };

  return (
    <Card className="space-y-5">
      <CardTitle>{t('settings.tab.profile')}</CardTitle>

      <div className="flex items-center gap-4">
        <Avatar nickname={user?.nickname ?? ''} avatarUrl={user?.avatarUrl} size={72} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{user?.displayName || user?.nickname}</div>
          <div className="text-xs text-zinc-500 truncate">@{user?.nickname}</div>
          <div className="mt-2">
            <AvatarPickerButton onUploaded={uploadAvatar} label={t('profile.change_avatar')} />
          </div>
        </div>
      </div>

      <LabeledInput
        label={t('profile.display_name')}
        value={displayName}
        onChange={setDisplayName}
        onBlur={() => { if (displayName !== (user?.displayName ?? '')) commit({ displayName }); }}
        maxLength={40}
        placeholder={user?.nickname}
      />
      <LabeledTextarea
        label={t('profile.bio')}
        value={bio}
        onChange={setBio}
        onBlur={() => { if (bio !== (user?.bio ?? '')) commit({ bio }); }}
        maxLength={280}
        placeholder={t('profile.bio_placeholder')}
      />
      <LabeledInput
        label={t('profile.country')}
        hint={t('profile.country_hint')}
        value={country}
        onChange={(v) => setCountry(v.slice(0, 2))}
        onBlur={() => { if (country !== (user?.country ?? '')) commit({ country }); }}
        maxLength={2}
        uppercase
        placeholder="UA"
      />

      {err && <div className="text-xs text-eos-rose">{err}</div>}
      {savingField && <div className="text-[11px] text-zinc-500">{t('settings.saving')}</div>}

      <div className="pt-4 border-t border-[var(--border)] space-y-4">
        <ChangePasswordSection t={t} />
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm text-eos-rose hover:text-eos-rose hover:bg-rose-400/10 transition-colors"
        >
          <LogOut size={16} /> {t('logout')}
        </button>
      </div>
    </Card>
  );
}

function ChangePasswordSection({ t }: { t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const reset = () => {
    setOpen(false);
    setCurrent('');
    setNext('');
    setRepeat('');
    setErr(null);
    setOk(false);
  };

  const valid =
    current.length > 0 &&
    next.length >= 8 &&
    /[A-Za-z]/.test(next) &&
    /[0-9]/.test(next) &&
    next === repeat &&
    next !== current;

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      await http.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setOk(true);
      setCurrent('');
      setNext('');
      setRepeat('');
      setTimeout(reset, 1800);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-slate h-10 gap-2 px-1.5 font-serif text-[13px] font-bold uppercase tracking-[0.08em]" style={{ borderWidth: '11px 12px' }}
      >
        {t('profile.change_password')}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] p-4 space-y-3">
      <div className="text-sm font-semibold">{t('profile.change_password')}</div>
      <PasswordField label={t('profile.current_password')} value={current} onChange={setCurrent} autoFocus />
      <PasswordField label={t('profile.new_password')} value={next} onChange={setNext} />
      <PasswordField label={t('profile.repeat_new_password')} value={repeat} onChange={setRepeat} />
      <div className="text-[11px] text-zinc-500">{t('auth.rule_pw_len')} · {t('auth.rule_pw_letter')} · {t('auth.rule_pw_digit')}</div>
      {err && <div className="text-xs text-eos-rose">{err}</div>}
      {ok && <div className="text-xs text-eos-sage">{t('profile.password_changed')}</div>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex-1 h-10 rounded-lg border border-[var(--border)] text-sm"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!valid || saving}
          className="flex-1 h-10 rounded-lg btn-ember font-serif font-bold uppercase tracking-[0.08em] text-sm font-semibold disabled:opacity-60"
        >
          {saving ? '…' : t('common.save')}
        </button>
      </div>
    </div>
  );
}

function PasswordField({
  label, value, onChange, autoFocus,
}: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">{label}</div>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          className="w-full h-10 rounded-lg bg-black/30 border border-[var(--border)] pl-3 pr-10 text-sm"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Icon size={16} />
        </button>
      </div>
    </div>
  );
}

function GameplayTab({ settings, patch, t }: { settings: UserSettings; patch: (p: Partial<UserSettings>) => void; t: (k: string) => string }) {
  return (
    <Card className="space-y-3">
      <CardTitle>{t('settings.gameplay')}</CardTitle>

      <ToggleRow
        title={t('settings.focus')}
        hint={t('settings.focus_hint')}
        checked={settings.focusMode}
        onChange={(v) => patch({ focusMode: v })}
      />
      <ToggleRow
        title={t('settings.sound')}
        hint={t('settings.sound_hint')}
        checked={settings.soundEnabled}
        onChange={(v) => patch({ soundEnabled: v })}
      />

      <div className="pt-2">
        <div className="text-sm mb-2">{t('settings.animation')}</div>
        <Segmented
          value={settings.animationSpeed}
          onChange={(v) => patch({ animationSpeed: v as AnimationSpeed })}
          options={[
            { value: 'instant', label: t('settings.animation.instant') },
            { value: 'fast',    label: t('settings.animation.fast') },
            { value: 'normal',  label: t('settings.animation.normal') },
            { value: 'slow',    label: t('settings.animation.slow') },
          ]}
        />
      </div>

      <div className="pt-2">
        <div className="text-sm">{t('settings.fixed_color')}</div>
        <div className="text-xs text-zinc-500 mb-2">{t('settings.fixed_color_hint')}</div>
        <Segmented
          value={settings.fixedColor}
          onChange={(v) => patch({ fixedColor: v as ColorMode })}
          options={[
            { value: 'auto',  label: t('settings.fixed_color.auto') },
            { value: 'white', label: t('settings.fixed_color.white') },
            { value: 'black', label: t('settings.fixed_color.black') },
          ]}
        />
      </div>

<div className="pt-2">
        <div className="text-sm">{t('settings.knight_arrow')}</div>
        <div className="text-xs text-zinc-500 mb-2">{t('settings.knight_arrow_hint')}</div>
        <Segmented
          value={settings.knightArrow}
          onChange={(v) => patch({ knightArrow: v as KnightArrowMode })}
          options={[
            { value: 'bent',     label: t('settings.knight_arrow.bent') },
            { value: 'straight', label: t('settings.knight_arrow.straight') },
          ]}
        />
      </div>

      <div className="pt-2 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm">{t('settings.show_streak')}</div>
          <div className="text-xs text-zinc-500">{t('settings.show_streak_hint')}</div>
        </div>
        <Toggle checked={settings.showStreak} onChange={(v) => patch({ showStreak: v })} />
      </div>

      <div className="pt-2 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm">{t('settings.review_auto_advance')}</div>
          <div className="text-xs text-zinc-500">{t('settings.review_auto_advance_hint')}</div>
        </div>
        <Toggle checked={settings.reviewAutoAdvance} onChange={(v) => patch({ reviewAutoAdvance: v })} />
      </div>

      <div className="pt-2 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm">{t('settings.mirror_view')}</div>
          <div className="text-xs text-zinc-500">{t('settings.mirror_view_hint')}</div>
        </div>
        <Toggle checked={settings.mirrorView} onChange={(v) => patch({ mirrorView: v })} />
      </div>
    </Card>
  );
}

function AppTab({ settings, patch, t }: { settings: UserSettings; patch: (p: Partial<UserSettings>) => void; t: (k: string) => string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>{t('settings.language')}</CardTitle>
        <Segmented
          value={settings.language}
          onChange={(v) => patch({ language: v as Language })}
          options={[
            { value: 'en', label: 'English' },
            { value: 'uk', label: 'Українська' },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>{t('settings.install')}</CardTitle>
        <div className="text-sm">{t('settings.install_ready')}</div>
        <div className="text-xs text-zinc-500 mt-1">{t('settings.install_hint')}</div>
      </Card>

      <Card className="flex items-center justify-between gap-3">
        <div>
          <CardTitle>{t('settings.replay_onboarding')}</CardTitle>
          <div className="text-xs text-zinc-500 mt-1">{t('settings.replay_onboarding_hint')}</div>
        </div>
        <button
          onClick={() => patch({ onboardingCompleted: false })}
          className="shrink-0 h-9 px-3 rounded-lg text-xs bg-white/5 hover:bg-white/10 border border-[var(--border)]"
        >
          {t('settings.replay_onboarding_cta')}
        </button>
      </Card>

      <ResetProgressSection t={t} />
    </div>
  );
}

function ResetProgressSection({ t }: { t: (k: string) => string }) {
  const router = useRouter();
  const setProgressions = useAppStore((s) => s.setProgressions);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = async () => {
    setErr(null);
    setBusy(true);
    try {
      await http.post('/users/me/reset-progress');
      // Pull fresh /users/me so progressions in the store reflect the
      // wiped state — otherwise the stale numbers linger until the
      // next mount.
      const me = await http.get<{ progressions: any }>('/users/me');
      if (me.progressions) setProgressions(me.progressions);
      setConfirming(false);
      router.push('/dashboard');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-[rgba(176,58,58,0.3)] bg-[rgba(176,58,58,0.05)]">
      <CardTitle>
        <span className="inline-flex items-center gap-2 text-eos-rose">
          <AlertTriangle size={16} /> {t('settings.reset_progress.title')}
        </span>
      </CardTitle>
      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
        {t('settings.reset_progress.body')}
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm text-eos-rose hover:text-white hover:bg-[rgba(176,58,58,0.15)] border border-[rgba(176,58,58,0.4)] transition-colors"
        >
          {t('settings.reset_progress.cta')}
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-[rgba(176,58,58,0.4)] bg-[rgba(176,58,58,0.1)] p-3 space-y-3">
          <p className="text-sm text-rose-100">{t('settings.reset_progress.confirm')}</p>
          {err && <p className="text-xs text-eos-rose">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setConfirming(false); setErr(null); }}
              disabled={busy}
              className="flex-1 h-10 rounded-lg border border-[var(--border)] text-sm disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="flex-1 h-10 rounded-lg bg-rose-500 text-white text-sm font-semibold disabled:opacity-60"
            >
              {busy ? '…' : t('settings.reset_progress.confirm_cta')}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function ToggleRow({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div>
        <div className="text-sm">{title}</div>
        <div className="text-xs text-zinc-500">{hint}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} aria-label={title} />
    </div>
  );
}

function LabeledInput({ label, hint, value, onChange, onBlur, maxLength, placeholder, uppercase }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  onBlur?: () => void; maxLength?: number; placeholder?: string; uppercase?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs uppercase tracking-wider text-zinc-400">{label}</label>
        {maxLength && (
          <span className="text-[10px] tabular-nums text-zinc-500">{value.length}/{maxLength}</span>
        )}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        maxLength={maxLength}
        placeholder={placeholder}
        className={cn(
          'w-full h-10 rounded-lg bg-black/30 border border-[var(--border)] px-3 text-sm',
          uppercase && 'uppercase',
        )}
      />
      {hint && <div className="text-[11px] text-zinc-500 mt-1">{hint}</div>}
    </div>
  );
}

function LabeledTextarea({ label, value, onChange, onBlur, maxLength, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  onBlur?: () => void; maxLength?: number; placeholder?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs uppercase tracking-wider text-zinc-400">{label}</label>
        {maxLength && (
          <span className="text-[10px] tabular-nums text-zinc-500">{value.length}/{maxLength}</span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        maxLength={maxLength}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-lg bg-black/30 border border-[var(--border)] px-3 py-2 text-sm resize-none"
      />
    </div>
  );
}

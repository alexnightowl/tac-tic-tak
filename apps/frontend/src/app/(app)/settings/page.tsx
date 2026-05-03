'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User as UserIcon, Gamepad2, Palette, Smartphone, LogOut, AlertTriangle } from 'lucide-react';
import { http, setToken } from '@/lib/api';
import { useAppStore, ColorMode, Language, UserSettings, AnimationSpeed, KnightArrowMode } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Card, CardTitle } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { Segmented } from '@/components/ui/segmented';
import { ColorPicker } from '@/components/ui/color-picker';
import { BOARD_THEMES, PIECE_SETS, PIECE_SET_LABELS } from '@/lib/themes';
import { SOUND_PACK_KEYS, SOUND_PACK_LABELS, SoundPack, playSound } from '@/lib/sound';
import { pieceUrl } from '@/lib/pieces';
import { Avatar } from '@/components/Avatar';
import { AvatarPickerButton } from '@/components/AvatarCropper';
import { cn } from '@/lib/utils';

type Tab = 'profile' | 'gameplay' | 'theme' | 'app';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const t = useT();
  const [saving, setSaving] = useState(false);

  async function patch(p: Partial<UserSettings>) {
    setSettings(p);
    setSaving(true);
    try {
      await http.patch('/users/me/settings', p);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t('settings.title')}
        {saving && <span className="text-xs text-zinc-500 ml-2 font-normal">{t('settings.saving')}</span>}
      </h1>

      <TabBar tab={tab} onChange={setTab} t={t} />

      {tab === 'profile' && <ProfileTab />}
      {tab === 'gameplay' && <GameplayTab settings={settings} patch={patch} t={t} />}
      {tab === 'theme' && <ThemeTab settings={settings} patch={patch} t={t} />}
      {tab === 'app' && <AppTab settings={settings} patch={patch} t={t} />}
    </div>
  );
}

function TabBar({ tab, onChange, t }: { tab: Tab; onChange: (t: Tab) => void; t: (k: string) => string }) {
  const tabs: Array<{ k: Tab; Icon: typeof UserIcon; label: string }> = [
    { k: 'profile',  Icon: UserIcon,   label: t('settings.tab.profile') },
    { k: 'gameplay', Icon: Gamepad2,   label: t('settings.tab.gameplay') },
    { k: 'theme',    Icon: Palette,    label: t('settings.tab.theme') },
    { k: 'app',      Icon: Smartphone, label: t('settings.tab.app') },
  ];
  return (
    <div className="flex gap-1 bg-black/30 rounded-xl p-1 overflow-x-auto no-scrollbar">
      {tabs.map(({ k, Icon, label }) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={cn(
            'flex-1 min-w-fit whitespace-nowrap h-10 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors px-3',
            tab === k
              ? 'bg-[var(--bg-softer)] text-white'
              : 'text-zinc-400 hover:text-white',
          )}
        >
          <Icon size={14} /> {label}
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

      {err && <div className="text-xs text-rose-400">{err}</div>}
      {savingField && <div className="text-[11px] text-zinc-500">{t('settings.saving')}</div>}

      <div className="pt-4 border-t border-[var(--border)] space-y-4">
        <ChangePasswordSection t={t} />
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 transition-colors"
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
        className="inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/5 border border-[var(--border)] transition-colors"
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
      {err && <div className="text-xs text-rose-400">{err}</div>}
      {ok && <div className="text-xs text-emerald-400">{t('profile.password_changed')}</div>}
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
          className="flex-1 h-10 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] text-sm font-semibold disabled:opacity-60"
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
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-400 mb-1">{label}</div>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full h-10 rounded-lg bg-black/30 border border-[var(--border)] px-3 text-sm"
      />
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
        <div className="text-sm mb-2">{t('settings.sound_pack')}</div>
        <div className="grid grid-cols-3 gap-2">
          {SOUND_PACK_KEYS.map((pk) => (
            <button
              key={pk}
              onClick={() => { patch({ soundPack: pk as SoundPack }); playSound(pk, 'move'); }}
              className={`py-2 rounded-lg text-xs border transition-all ${
                settings.soundPack === pk
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent font-medium'
                  : 'border-[var(--border)] text-zinc-300 hover:bg-white/5'
              }`}
            >
              {SOUND_PACK_LABELS[pk]}
            </button>
          ))}
        </div>
      </div>

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
    </Card>
  );
}

function ThemeTab({ settings, patch, t }: { settings: UserSettings; patch: (p: Partial<UserSettings>) => void; t: (k: string) => string }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>{t('settings.accent')}</CardTitle>
        <ColorPicker value={settings.accentColor} onChange={(c) => patch({ accentColor: c })} />
      </Card>

      <Card>
        <CardTitle>{t('settings.board_theme')}</CardTitle>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
          {Object.entries(BOARD_THEMES).map(([name, th]) => (
            <button
              key={name}
              onClick={() => patch({ boardTheme: name })}
              className={`p-1 rounded-xl border-2 transition-all ${
                settings.boardTheme === name ? 'border-[var(--accent)]' : 'border-transparent'
              }`}
            >
              <div className="grid grid-cols-4 grid-rows-4 overflow-hidden rounded-md aspect-square">
                {Array.from({ length: 16 }).map((_, i) => {
                  const row = Math.floor(i / 4);
                  const col = i % 4;
                  const light = (row + col) % 2 === 0;
                  return <div key={i} style={{ background: light ? th.light : th.dark }} />;
                })}
              </div>
              <div className="text-[10px] text-zinc-400 text-center mt-1 truncate">{th.label}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{t('settings.piece_set')}</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
          {PIECE_SETS.map((set) => (
            <button
              key={set}
              onClick={() => patch({ pieceSet: set })}
              className={`rounded-xl p-2 border-2 transition-all ${
                settings.pieceSet === set ? 'border-[var(--accent)]' : 'border-transparent'
              } bg-white/5 hover:bg-white/10`}
            >
              <div className="flex items-center justify-center gap-0.5" style={{ background: '#ebecd0', borderRadius: 6, padding: 4 }}>
                <img src={pieceUrl(set, 'w', 'k')} alt="" className="h-10 w-10" />
                <img src={pieceUrl(set, 'b', 'q')} alt="" className="h-10 w-10" />
              </div>
              <div className="text-[10px] text-zinc-400 text-center mt-1 capitalize">{PIECE_SET_LABELS[set]}</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
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
    <Card className="border-rose-500/30 bg-rose-500/5">
      <CardTitle>
        <span className="inline-flex items-center gap-2 text-rose-200">
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
          className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm text-rose-300 hover:text-white hover:bg-rose-500/15 border border-rose-500/40 transition-colors"
        >
          {t('settings.reset_progress.cta')}
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 space-y-3">
          <p className="text-sm text-rose-100">{t('settings.reset_progress.confirm')}</p>
          {err && <p className="text-xs text-rose-300">{err}</p>}
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

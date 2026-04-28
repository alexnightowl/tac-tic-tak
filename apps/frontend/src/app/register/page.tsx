'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { http, setToken } from '@/lib/api';
import { useAppStore, type Progressions } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

const NICK_RE = /^[A-Za-z0-9_-]+$/;
const NICK_NO_DOUBLES_RE = /^(?!.*[-_]{2}).+$/;

type Me = {
  id: string;
  nickname: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  country?: string | null;
  settings: any;
  progressions: Progressions;
};

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setProgressions = useAppStore((s) => s.setProgressions);
  const language = useAppStore((s) => s.settings.language);
  const t = useT();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<{ n?: boolean; p?: boolean; r?: boolean }>({});

  const nickRules = useMemo(() => [
    { met: nickname.length >= 3 && nickname.length <= 20, label: t('auth.rule_nick_len') },
    { met: nickname.length === 0 || NICK_RE.test(nickname),                label: t('auth.rule_nick_chars') },
    { met: nickname.length === 0 || NICK_NO_DOUBLES_RE.test(nickname),     label: t('auth.rule_nick_doubles') },
  ], [nickname, t]);

  const pwRules = useMemo(() => [
    { met: password.length >= 8,             label: t('auth.rule_pw_len') },
    { met: /[A-Za-z]/.test(password),        label: t('auth.rule_pw_letter') },
    { met: /[0-9]/.test(password),           label: t('auth.rule_pw_digit') },
  ], [password, t]);

  const nickValid = nickRules.every((r) => r.met) && nickname.length > 0;
  const pwValid = pwRules.every((r) => r.met);
  const repeatValid = repeat === password && repeat.length > 0;
  const formValid = nickValid && pwValid && repeatValid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setTouched({ n: true, p: true, r: true });
    if (!formValid) return;
    setLoading(true);
    try {
      const r = await http.post<{ token: string; user: { id: string; nickname: string } }>(
        '/auth/register',
        { nickname, password, repeatPassword: repeat, language },
      );
      setToken(r.token);
      setUser(r.user);
      // Providers' /users/me effect only fires on mount — without
      // pulling the profile here, progressions/settings from a
      // previously-signed-in account leak into the fresh registration
      // (same React app instance, no full reload in PWA). Mirror what
      // /login does so the new user lands with their OWN defaults
      // (e.g. calibrationSessionsLeft: 5, ratings at 1200).
      try {
        const me = await http.get<Me>('/users/me');
        setUser({
          id: me.id,
          nickname: me.nickname,
          displayName: me.displayName,
          avatarUrl: me.avatarUrl,
          bio: me.bio,
          country: me.country,
        });
        if (me.settings) setSettings(me.settings);
        if (me.progressions) setProgressions(me.progressions);
      } catch {
        // Non-fatal — Providers will reconcile on next mount.
      }
      router.replace('/dashboard');
    } catch (e: any) {
      setErr(e.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 glass rounded-3xl p-7">
        <div className="flex flex-col items-center gap-2">
          <Logo size={44} />
          <h1 className="text-2xl font-semibold mt-1">{t('auth.create_account')}</h1>
        </div>

        <div>
          <Input
            placeholder={t('auth.nickname')}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, n: true }))}
            autoComplete="username"
            maxLength={20}
          />
          {(touched.n || nickname.length > 0) && <RuleList rules={nickRules} />}
        </div>

        <div>
          <Input
            type="password"
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, p: true }))}
            autoComplete="new-password"
          />
          {(touched.p || password.length > 0) && <RuleList rules={pwRules} />}
        </div>

        <div>
          <Input
            type="password"
            placeholder={t('auth.repeat')}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, r: true }))}
            autoComplete="new-password"
          />
          {touched.r && repeat.length > 0 && !repeatValid && (
            <p className="text-xs text-rose-400 mt-1">{t('auth.rule_pw_match')}</p>
          )}
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={loading || !formValid}>
          {loading ? t('auth.creating') : t('auth.register')}
        </Button>
        <p className="text-sm text-center text-zinc-400">
          {t('auth.have_account')} <Link href="/login" className="text-[var(--accent)]">{t('auth.login')}</Link>
        </p>
      </form>
    </main>
  );
}

function RuleList({ rules }: { rules: Array<{ met: boolean; label: string }> }) {
  return (
    <ul className="mt-1.5 space-y-0.5">
      {rules.map((r, i) => (
        <li
          key={i}
          className={cn(
            'flex items-center gap-1.5 text-[11px]',
            r.met ? 'text-emerald-400' : 'text-zinc-500',
          )}
        >
          {r.met ? <Check size={11} /> : <X size={11} />}
          <span>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}

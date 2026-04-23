'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { http, setToken } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import type { Progressions } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/brand/Logo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Me = { id: string; nickname: string; displayName?: string | null; avatarUrl?: string | null; bio?: string | null; country?: string | null; settings?: any; progressions?: Progressions };

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const setSettings = useAppStore((s) => s.setSettings);
  const setProgressions = useAppStore((s) => s.setProgressions);
  const t = useT();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await http.post<{ token: string; user: { id: string; nickname: string } }>(
        '/auth/login',
        { nickname, password },
      );
      setToken(r.token);
      setUser(r.user);
      // Providers' /users/me effect only fires on mount — it won't re-run
      // when token flips here. Pull the full profile + settings now so
      // the dashboard lands with the user's real theme/avatar instead
      // of defaulting for a split second.
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
        // Non-fatal — dashboard will fall back to cached / default settings.
      }
      router.replace('/dashboard');
    } catch (e: any) {
      setErr(e.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 glass rounded-3xl p-7">
        <div className="flex flex-col items-center gap-2">
          <Logo size={44} />
          <h1 className="text-2xl font-semibold mt-1">{t('auth.login')}</h1>
        </div>
        <Input
          placeholder={t('auth.nickname')}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          autoComplete="username"
        />
        <Input
          type="password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? t('auth.logging_in') : t('auth.login')}
        </Button>
        <p className="text-sm text-center text-zinc-400">
          {t('auth.no_account')} <Link href="/register" className="text-[var(--accent)]">{t('auth.create_account')}</Link>
        </p>
      </form>
    </main>
  );
}

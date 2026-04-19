'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { http, setToken } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/brand/Logo';

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password !== repeat) { setErr('Passwords do not match'); return; }
    setLoading(true);
    try {
      const r = await http.post<{ token: string; user: { id: string; nickname: string } }>('/auth/register', { nickname, password, repeatPassword: repeat });
      setToken(r.token);
      setUser(r.user);
      router.replace('/dashboard');
    } catch (e: any) {
      setErr(e.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 glass rounded-3xl p-7">
        <div className="flex flex-col items-center gap-2">
          <Logo size={44} />
          <h1 className="text-2xl font-semibold mt-1">Create account</h1>
        </div>
        <Input placeholder="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="username" />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <Input type="password" placeholder="Repeat password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? 'Creating…' : 'Sign up'}</Button>
        <p className="text-sm text-center text-zinc-400">
          Already have one? <Link href="/login" className="text-[var(--accent)]">Log in</Link>
        </p>
      </form>
    </main>
  );
}

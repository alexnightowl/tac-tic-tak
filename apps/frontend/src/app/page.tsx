'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center"><Logo size={72} /></div>
        <div className="space-y-2">
          <h1 className="text-5xl font-semibold tracking-tight">
            tac<span className="text-[var(--accent)]">·</span>tic<span className="text-[var(--accent)]">·</span>tak
          </h1>
          <p className="text-zinc-400">Train chess tactics adaptively. Focus, play, improve.</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link href="/login" className="flex-1 max-w-[160px]"><Button variant="outline" size="lg" className="w-full">Log in</Button></Link>
          <Link href="/register" className="flex-1 max-w-[160px]"><Button size="lg" className="w-full">Sign up</Button></Link>
        </div>
      </div>
    </main>
  );
}

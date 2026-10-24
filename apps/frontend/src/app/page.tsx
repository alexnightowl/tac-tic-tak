'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';
import { LandingLangProvider } from '@/lib/landingI18n';
import { Hero } from '@/components/landing/Hero';
import { Motifs } from '@/components/landing/Motifs';
import { Paces } from '@/components/landing/Paces';
import { Ranks } from '@/components/landing/Ranks';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { CTA } from '@/components/landing/CTA';

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Logged-in visitors skip the landing; otherwise we render it in full.
  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
    else setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <LandingLangProvider>
      <main className="relative overflow-x-hidden bg-eos-ink text-eos-bone">
        <Hero />
        <Motifs />
        <Paces />
        <Ranks />
        <Features />
        <HowItWorks />
        <CTA />
      </main>
    </LandingLangProvider>
  );
}

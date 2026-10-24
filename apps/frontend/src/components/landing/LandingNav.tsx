'use client';

import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { LangToggle } from './LangToggle';
import { useLandingT } from '@/lib/landingI18n';

export function LandingNav() {
  const { t } = useLandingT();
  return (
    <header className="relative z-20 mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:h-[84px] md:px-6 xl:px-0">
      <Logo size={36} glow withWordmark />
      <nav className="hidden items-center gap-8 text-sm font-bold text-eos-ash lg:flex">
        <a href="#paces" className="transition-colors hover:text-eos-bone">{t('nav.paces')}</a>
        <a href="#ranks" className="transition-colors hover:text-eos-bone">{t('nav.ranks')}</a>
        <a href="#features" className="transition-colors hover:text-eos-bone">{t('nav.features')}</a>
        <a href="#how" className="transition-colors hover:text-eos-bone">{t('nav.how')}</a>
      </nav>
      <div className="flex items-center gap-3.5">
        <LangToggle />
        <Link href="/login" className="hidden text-sm font-bold text-eos-bone hover:text-white md:inline">
          {t('nav.login')}
        </Link>
        <Link
          href="/register"
          className="btn-ember hidden h-11 items-center justify-center px-3 font-serif text-[13px] font-bold uppercase tracking-[0.1em] text-[#ece3d6] md:inline-flex"
          style={{ borderWidth: '12px 13px' }}
        >
          {t('nav.get_started')}
        </Link>
      </div>
    </header>
  );
}

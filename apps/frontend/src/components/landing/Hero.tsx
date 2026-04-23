'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Reveal } from './Reveal';
import { LangToggle } from './LangToggle';
import { useLandingT } from '@/lib/landingI18n';

export function Hero() {
  const { t } = useLandingT();

  return (
    <section
      className="relative overflow-hidden text-[#121212]"
      style={{ background: 'var(--paper)' }}
    >
      {/* Desktop: banner goes full-bleed; nav + text overlay the empty
          cream areas baked into the composition. */}
      <div className="relative hidden md:block">
        <Image
          src="/brand/hero-desktop.png"
          alt=""
          width={1693}
          height={929}
          priority
          className="w-full h-auto select-none pointer-events-none block"
          draggable={false}
          aria-hidden
        />

        {/* Nav overlaid at the top of the image. */}
        <nav className="absolute top-0 inset-x-0 z-20">
          <div className="max-w-[1600px] mx-auto px-8 pt-6 flex items-center justify-between gap-3">
            <Logo size={36} tone="light" withWordmark />

            <div className="flex items-center gap-6 text-[14px] font-display font-semibold uppercase tracking-[0.18em] text-[#3a3a3a]">
              <a href="#features" className="hover:text-black transition-colors">{t('nav.features')}</a>
              <a href="#how" className="hover:text-black transition-colors">{t('nav.training')}</a>
              <a href="#value" className="hover:text-black transition-colors">{t('nav.statistics')}</a>
              <a href="#cta" className="hover:text-black transition-colors">{t('nav.about')}</a>
            </div>

            <div className="flex items-center gap-2">
              <LangToggle tone="light" />
              <Link
                href="/register"
                className="h-10 px-4 rounded-full bg-[#121212] text-white text-[11px] font-display font-semibold uppercase tracking-[0.18em] hover:bg-black transition-colors flex items-center"
              >
                {t('hero.cta_primary_short')}
              </Link>
            </div>
          </div>
        </nav>

        {/* Text column — absolute, left side, vertically centred. */}
        <div className="absolute inset-0 flex items-center z-10">
          <div className="max-w-[1600px] w-full mx-auto px-8">
            <div className="w-[46%] max-w-[620px]">
              <Reveal>
                <h1 className="font-display font-bold uppercase tracking-[-0.01em] leading-[0.92] text-[clamp(40px,5.4vw,88px)]">
                  {t('hero.title_1')}<br />
                  <span>{t('hero.title_2')}</span>
                </h1>
              </Reveal>

              <Reveal delay={1}>
                <div className="mt-5 h-[3px] w-14 bg-[var(--accent)] stat-underline origin-left" />
              </Reveal>

              <Reveal delay={2}>
                <p className="mt-5 text-[clamp(14px,1vw,17px)] text-[#3a3a3a] leading-relaxed max-w-md">
                  {t('hero.subtitle')}
                </p>
              </Reveal>

              <Reveal delay={3}>
                <HeroCtas t={t} />
              </Reveal>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: banner spans the full section, text overlays the cream
          space at the top, CTAs overlay the chess-floor at the bottom. */}
      <div className="md:hidden">
        <nav className="relative z-20 flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <Logo size={32} tone="light" withWordmark />
          <div className="flex items-center gap-2">
            <LangToggle tone="light" />
            <Link
              href="/register"
              className="h-9 px-3 rounded-full bg-[#121212] text-white text-[10px] font-display font-semibold uppercase tracking-[0.18em] hover:bg-black transition-colors flex items-center"
            >
              {t('hero.cta_primary_short')}
            </Link>
          </div>
        </nav>

        <div className="relative">
          <Image
            src="/brand/hero-mobile.png"
            alt=""
            width={864}
            height={1821}
            priority
            className="w-full h-auto select-none pointer-events-none"
            draggable={false}
            aria-hidden
          />

          <div className="absolute inset-x-0 top-0 px-5 pt-2">
            <Reveal>
              <h1 className="font-display font-bold uppercase tracking-[-0.01em] leading-[0.92] text-[40px]">
                {t('hero.title_1')}<br />
                <span>{t('hero.title_2')}</span>
              </h1>
            </Reveal>

            <Reveal delay={1}>
              <div className="mt-3 h-[3px] w-12 bg-[var(--accent)] stat-underline origin-left" />
            </Reveal>

            <Reveal delay={2}>
              <p className="mt-3 text-[13px] text-[#3a3a3a] leading-snug max-w-[78%]">
                {t('hero.subtitle')}
              </p>
            </Reveal>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-5 pb-8">
            <Reveal delay={3}>
              <HeroCtas t={t} />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroCtas({ t }: { t: (k: string) => string }) {
  return (
    <div className="mt-6 md:mt-8 flex flex-wrap items-center gap-3">
      <Link
        href="/register"
        className="group inline-flex items-center gap-3 h-12 pl-6 pr-4 rounded-full bg-[#121212] text-white text-[12px] font-display font-semibold uppercase tracking-[0.22em] hover:bg-black transition-colors"
      >
        {t('hero.cta_primary')}
        <span className="h-8 w-8 rounded-full bg-[var(--accent)] flex items-center justify-center transition-transform group-hover:translate-x-0.5">
          <ArrowRight size={14} className="text-white" />
        </span>
      </Link>
      <Link
        href="/login"
        className="h-12 px-5 text-[12px] font-display font-semibold uppercase tracking-[0.22em] text-[#3a3a3a] hover:text-black transition-colors flex items-center"
      >
        {t('hero.cta_secondary')}
      </Link>
    </div>
  );
}

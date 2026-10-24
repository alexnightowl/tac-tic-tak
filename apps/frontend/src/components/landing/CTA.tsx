'use client';

import Link from 'next/link';
import { Reveal } from './Reveal';
import { Logo } from '@/components/brand/Logo';
import { useLandingT } from '@/lib/landingI18n';

export function CTA() {
  const { t } = useLandingT();
  return (
    <>
      <section id="cta" className="px-4 pb-14 pt-[72px] md:px-6 md:pb-24 md:pt-20">
        <Reveal>
          <div className="tx-slate relative mx-auto max-w-[1200px] overflow-hidden rounded-[18px] px-5 py-12 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_30px_60px_rgba(0,0,0,0.55)] md:px-12 md:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[-260px] h-[620px] w-[720px] -translate-x-1/2 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(176,58,58,0.34) 0%, rgba(140,40,42,0.12) 38%, rgba(20,19,23,0) 68%)' }}
            />
            <div className="relative flex justify-center">
              <Logo size={104} glow />
            </div>
            <h2 className="relative mx-auto mt-7 max-w-[760px] font-serif text-[32px] font-bold leading-[1.12] text-eos-bone md:text-[52px]">
              {t('cta.title_1')} <span className="text-eos-ember">{t('cta.title_2')}</span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-[520px] text-[15px] leading-relaxed text-eos-ash md:text-lg">{t('cta.subtitle')}</p>
            <div className="relative mt-7 flex flex-col gap-2.5 md:mt-9 md:flex-row md:justify-center md:gap-3.5">
              <Link
                href="/register"
                className="btn-ember inline-flex h-14 items-center justify-center px-6 font-serif text-[15px] font-bold uppercase tracking-[0.1em] text-[#ece3d6]"
                style={{ borderWidth: '15px 16px' }}
              >
                {t('cta.primary')}
              </Link>
              <Link
                href="/login"
                className="btn-slate inline-flex h-12 items-center justify-center px-6 font-serif text-[13px] font-bold uppercase tracking-[0.1em] text-eos-bone md:h-14 md:text-sm"
                style={{ borderWidth: '13px 14px' }}
              >
                {t('cta.secondary')}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="px-4 pb-10 pt-7 shadow-[inset_0_1px_0_#2c2a31] md:px-6 md:pb-12 md:pt-8">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 text-[13px] font-semibold text-eos-dust md:flex-row">
          <span className="inline-flex items-center gap-2.5">
            <Logo size={24} withWordmark />
            <span>© {new Date().getFullYear()}</span>
          </span>
          <span className="flex gap-[22px]">
            <Link href="/login" className="text-eos-ash hover:text-eos-bone">{t('footer.login')}</Link>
            <Link href="/register" className="text-eos-ash hover:text-eos-bone">{t('footer.signup')}</Link>
            <a href="https://database.lichess.org/" target="_blank" rel="noreferrer" className="text-eos-ash hover:text-eos-bone">
              {t('footer.puzzles')}
            </a>
          </span>
          <a href="https://game-icons.net" target="_blank" rel="noreferrer" className="text-xs hover:text-eos-ash">
            {t('footer.credits')}
          </a>
        </div>
      </footer>
    </>
  );
}

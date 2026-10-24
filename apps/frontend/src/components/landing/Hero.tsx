'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';
import { LandingNav } from './LandingNav';
import { LandingBoard } from './LandingBoard';
import { Reveal } from './Reveal';
import { StyleIcon } from '@/components/StyleIcon';
import { themeIcon } from '@/lib/theme-icons';
import { BAND_ICON, DIFFICULTY_BANDS } from '@/lib/levels';
import { useLandingT } from '@/lib/landingI18n';

const FloatCard = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div
    className={`absolute rounded-xl bg-[rgba(34,32,37,0.92)] shadow-[inset_0_0_0_1px_rgba(255,255,254,0.06),0_16px_32px_rgba(17,15,17,0.55)] backdrop-blur-sm ${className ?? ''}`}
  >
    {children}
  </div>
);

export function Hero() {
  const { t } = useLandingT();
  const Fork = themeIcon('fork');
  const Pin = themeIcon('pin');
  const Skewer = themeIcon('skewer');

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[380px] h-[640px] w-[640px] -translate-x-1/2 rounded-full md:left-auto md:right-[-60px] md:top-10 md:h-[900px] md:w-[900px] md:translate-x-0"
        style={{ background: 'radial-gradient(circle, rgba(166,66,65,0.30) 0%, rgba(133,48,49,0.13) 32%, rgba(29,27,32,0) 66%)' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/design/knight-logo.webp"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-[-160px] top-[140px] hidden h-[620px] w-[620px] opacity-[0.045] grayscale lg:block"
      />

      <LandingNav />

      <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-14 pt-7 md:px-6 lg:grid-cols-[1fr_520px] lg:gap-[72px] lg:pb-[120px] lg:pt-14 xl:px-0">
        <div>
          <Reveal>
            <span className="inline-flex h-7 items-center rounded-full bg-[rgba(166,66,65,0.14)] px-3 text-[11px] font-extrabold tracking-[0.12em] text-[#d8847c] md:h-[30px] md:px-3.5 md:text-xs">
              {t('hero.eyebrow')}
            </span>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="mt-[18px] font-serif text-[44px] font-bold leading-[1.05] text-eos-bone md:mt-6 md:text-[78px] md:leading-[1.02]">
              {t('hero.title_1')}<br className="hidden md:block" />{' '}
              <span className="text-eos-ember">{t('hero.title_2')}</span>
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-3.5 max-w-[520px] text-base leading-relaxed text-eos-ash md:mt-[22px] md:text-[19px]">
              {t('hero.subtitle')}
            </p>
          </Reveal>
          <Reveal delay={3}>
            <div className="mt-6 flex flex-col gap-2.5 md:mt-9 md:flex-row md:gap-3.5">
              <Link
                href="/register"
                className="btn-ember inline-flex h-14 items-center justify-center gap-2.5 px-5 font-serif text-[15px] font-bold uppercase tracking-[0.1em] text-[#eee5d8]"
                style={{ borderWidth: '15px 16px' }}
              >
                <Play size={16} strokeWidth={2.2} className="shrink-0 fill-current" aria-hidden />
                <span>{t('hero.cta_primary')}</span>
              </Link>
              <Link
                href="/login"
                className="btn-slate inline-flex h-12 items-center justify-center px-5 font-serif text-[13px] font-bold uppercase tracking-[0.1em] text-eos-bone md:h-14 md:text-sm"
                style={{ borderWidth: '13px 14px' }}
              >
                {t('hero.cta_secondary')}
              </Link>
            </div>
          </Reveal>
          <Reveal delay={4}>
            <div className="mt-11 hidden gap-9 md:flex">
              <div>
                <div className="flex gap-1.5 text-eos-bone">
                  <StyleIcon style="rapid" size={20} /><StyleIcon style="blitz" size={20} /><StyleIcon style="bullet" size={20} />
                </div>
                <div className="mt-2 text-[13px] font-bold text-eos-ash">{t('hero.stat_paces')}</div>
              </div>
              <div className="w-px bg-eos-seam" />
              <div>
                <div className="flex gap-1">
                  {DIFFICULTY_BANDS.map((b) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={b.key} src={BAND_ICON[b.key]} alt="" width={20} height={20} className="h-5 w-5" />
                  ))}
                </div>
                <div className="mt-2 text-[13px] font-bold text-eos-ash">{t('hero.stat_ranks')}</div>
              </div>
              <div className="w-px bg-eos-seam" />
              <div>
                <div className="flex gap-1.5 text-eos-bone"><Fork size={17} /><Pin size={17} /><Skewer size={17} /></div>
                <div className="mt-2 text-[13px] font-bold text-eos-ash">{t('hero.stat_motifs')}</div>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={2}>
          <div className="relative mx-auto mt-4 w-full max-w-[350px] md:max-w-[520px] lg:mt-0">
            <div className="tx-slate rounded-xl p-3 shadow-[inset_0_0_0_1px_rgba(255,255,254,0.07),0_30px_60px_rgba(17,15,17,0.6),0_0_0_1px_rgba(17,15,17,0.6)]">
              <div className="overflow-hidden rounded shadow-[0_0_0_1px_rgba(17,15,17,0.6)]">
                <LandingBoard />
              </div>
            </div>

            <FloatCard className="-left-1.5 -top-7 flex items-center gap-3 px-3.5 py-2.5 lg:-left-16 lg:top-11 lg:px-4 lg:py-3">
              <span className="h-3.5 w-3.5 rounded-[3px] bg-eos-bone shadow-[inset_0_0_0_1px_rgba(17,15,17,0.4)]" />
              <span>
                <span className="block font-serif text-[15px] font-bold text-eos-bone lg:text-[17px]">{t('hero.float_turn')}</span>
                <span className="block text-[11px] text-eos-ash lg:text-xs">{t('hero.float_find')}</span>
              </span>
            </FloatCard>

            <FloatCard className="-bottom-8 -right-1.5 flex items-center gap-3 px-3.5 py-2.5 lg:-right-11 lg:bottom-14 lg:px-4 lg:py-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-eos-rise text-eos-bone">
                <StyleIcon style="blitz" size={20} />
              </span>
              <span>
                <span className="block text-[11px] font-extrabold tracking-[0.1em] text-eos-ash">{t('hero.float_rating')}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[19px] font-extrabold tabular-nums text-eos-bone lg:text-[22px]">1612</span>
                  <span className="inline-flex h-[22px] items-center rounded-full bg-[rgba(148,165,142,0.16)] px-2 text-xs font-extrabold text-[#afc0a9]">+32</span>
                </span>
              </span>
            </FloatCard>

            <div className="absolute -top-[22px] right-9 hidden items-center gap-2.5 rounded-full bg-[rgba(34,32,37,0.92)] px-3.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,254,0.06),0_16px_32px_rgba(17,15,17,0.55)] lg:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BAND_ICON.advanced} alt="" width={26} height={26} className="h-[26px] w-[26px]" />
              <span className="text-xs font-extrabold tracking-[0.12em] text-eos-bone">{t('rank.advanced').toUpperCase()}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

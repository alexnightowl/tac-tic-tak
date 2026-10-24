'use client';

import { Check } from 'lucide-react';
import { Reveal } from './Reveal';
import { Eyebrow, SectionTitle } from './Section';
import { BAND_ICON, DIFFICULTY_BANDS } from '@/lib/levels';
import { useLandingT } from '@/lib/landingI18n';
import { cn } from '@/lib/utils';

const ACTIVE = 'advanced';
const GATE: Array<{ key: string; value: string }> = [
  { key: 'solved', value: '9 / 8' },
  { key: 'accuracy', value: '84% / 80%' },
  { key: 'speed', value: '11.4s / 12s' },
  { key: 'peak', value: '1664 / 1650' },
];

export function Ranks() {
  const { t } = useLandingT();
  return (
    <section id="ranks" className="scroll-mt-6 bg-[linear-gradient(#141317,#19181d_30%,#141317)] px-4 py-[72px] md:px-6 md:py-[104px]">
      <div className="mx-auto grid max-w-[1200px] items-center gap-9 lg:grid-cols-[1fr_560px] lg:gap-[88px]">
        <Reveal>
          <Eyebrow>{t('ranks.eyebrow')}</Eyebrow>
          <SectionTitle>{t('ranks.title')}</SectionTitle>
          <p className="mt-4 max-w-[500px] text-base leading-relaxed text-eos-ash md:text-lg">{t('ranks.subtitle')}</p>
          <ul className="mt-6 grid gap-3">
            {['ranks.point_1', 'ranks.point_2', 'ranks.point_3'].map((k) => (
              <li key={k} className="flex items-start gap-3 text-[15px] leading-normal text-eos-ash">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(176,58,58,0.16)] text-[#e07d76]">
                  <Check size={12} strokeWidth={2.6} />
                </span>
                {t(k)}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={2}>
          <div className="tx-slate rounded-2xl p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_20px_40px_rgba(0,0,0,0.5)] md:p-8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold tracking-[0.12em] text-eos-ash">{t('ranks.panel_rating')}</span>
              <span className="inline-flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BAND_ICON[ACTIVE]} alt="" width={20} height={20} className="h-5 w-5" />
                <span className="text-[11px] font-extrabold tracking-[0.12em] text-eos-ash">{t(`rank.${ACTIVE}`).toUpperCase()}</span>
                <span className="text-2xl font-extrabold tabular-nums text-eos-bone">2000</span>
              </span>
            </div>

            <div className="relative mt-[18px] h-7">
              <div className="absolute inset-x-0 top-[11px] h-1.5 rounded-full bg-eos-well shadow-[inset_0_1px_2px_rgba(0,0,0,0.7)]" />
              <div className="absolute left-0 top-[11px] h-1.5 w-[70%] rounded-full bg-[linear-gradient(90deg,#7a2a2c,#b03a3a)]" />
              <div
                className="absolute left-[calc(70%-12px)] top-0.5 h-6 w-6 rounded-full shadow-[0_0_0_4px_rgba(176,58,58,0.25),0_2px_6px_rgba(0,0,0,0.6)]"
                style={{ background: 'radial-gradient(circle at 40% 32%, #f3ece4, #c8c2bd 60%, #8f8a8e)' }}
              />
            </div>

            <div className="mt-3.5 grid grid-cols-5">
              {DIFFICULTY_BANDS.map((b) => {
                const active = b.key === ACTIVE;
                return (
                  <div key={b.key} className="flex flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={BAND_ICON[b.key]}
                      alt=""
                      width={40}
                      height={40}
                      className={cn('h-[30px] w-[30px] md:h-10 md:w-10', active ? 'scale-[1.18]' : 'opacity-[0.55]')}
                    />
                    <span className={cn('text-[8px] font-extrabold uppercase md:text-[11px] md:tracking-[0.1em]', active ? 'text-eos-bone' : 'text-eos-dust')}>
                      {t(`rank.${b.key}`)}
                    </span>
                    <span className="text-[10px] font-bold tabular-nums text-eos-dust md:text-[11px]">
                      {b.key === 'expert' ? `${b.min}+` : b.min}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-[26px] border-t border-white/[0.07] pt-[22px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold tracking-[0.12em] text-eos-ash">{t('ranks.gate')}</span>
                <span className="inline-flex h-6 items-center rounded-full bg-[rgba(142,163,138,0.16)] px-2.5 text-xs font-extrabold text-[#a9bea5]">
                  {t('ranks.gate_badge')}
                </span>
              </div>
              <div className="mt-4 grid gap-3.5">
                {GATE.map((g) => (
                  <div key={g.key}>
                    <div className="flex justify-between text-[13px] font-bold">
                      <span className="text-eos-ash">{t(`ranks.gate_${g.key}`)}</span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums text-eos-bone">
                        {g.value}
                        <Check size={14} strokeWidth={2.4} className="text-[#a9bea5]" />
                      </span>
                    </div>
                    <div className="mt-[7px] h-1.5 rounded-full bg-eos-well shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
                      <div className="h-1.5 w-full rounded-full bg-[linear-gradient(90deg,#5d7359,#8ea38a)]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

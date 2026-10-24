'use client';

import { Reveal } from './Reveal';
import { Eyebrow, SectionTitle } from './Section';
import { StyleIcon, STYLE_ORDER } from '@/components/StyleIcon';
import { useLandingT } from '@/lib/landingI18n';

const SAMPLE: Record<string, string> = { rapid: '1640', blitz: '1612', bullet: '1448' };

export function Paces() {
  const { t } = useLandingT();
  return (
    <section id="paces" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 py-[72px] md:px-6 md:py-[104px] xl:px-0">
      <Reveal>
        <div className="md:text-center">
          <Eyebrow>{t('paces.eyebrow')}</Eyebrow>
          <SectionTitle>{t('paces.title')}</SectionTitle>
          <p className="mt-4 max-w-[640px] text-base leading-relaxed text-eos-ash md:mx-auto md:text-lg">{t('paces.subtitle')}</p>
        </div>
      </Reveal>
      <div className="mt-9 grid gap-3.5 md:mt-14 md:grid-cols-3 md:gap-6">
        {STYLE_ORDER.map((s, i) => (
          <Reveal key={s} delay={(i + 1) as 1 | 2 | 3}>
            <div className="tx-slate h-full rounded-[14px] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,254,0.06),0_14px_30px_rgba(17,15,17,0.45)] md:p-[30px]">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[rgba(26,24,28,0.6)] text-eos-bone shadow-[inset_0_2px_4px_rgba(17,15,17,0.5)]">
                  <StyleIcon style={s} size={30} />
                </span>
                <span className="inline-flex h-[26px] items-center rounded-full bg-eos-rise px-2.5 text-xs font-extrabold text-eos-ash">
                  {t(`paces.${s}.time`)}
                </span>
              </div>
              <div className="mt-[22px] font-serif text-[28px] font-bold text-eos-bone">{t(`paces.${s}.name`)}</div>
              <p className="mt-2 text-[15px] leading-relaxed text-eos-ash">{t(`paces.${s}.body`)}</p>
              <div className="mt-[22px] flex items-baseline justify-between border-t border-white/[0.07] pt-4">
                <span className="text-[11px] font-extrabold tracking-[0.1em] text-eos-dust">{t('paces.rating_label')}</span>
                <span className="text-[22px] font-extrabold tabular-nums text-eos-bone">{SAMPLE[s]}</span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

'use client';

import { BarChart3, Grid3x3, Maximize, Trophy } from 'lucide-react';
import { Reveal } from './Reveal';
import { Eyebrow, SectionTitle } from './Section';
import { ReviewIcon } from '@/components/NavIcons';
import { themeIcon } from '@/lib/theme-icons';
import { useLandingT } from '@/lib/landingI18n';

export function Features() {
  const { t } = useLandingT();
  const Fork = themeIcon('fork');
  const items = [
    { key: 'review', icon: <ReviewIcon /> },
    { key: 'focus', icon: <Maximize size={22} strokeWidth={1.8} /> },
    { key: 'motif', icon: <Fork size={19} /> },
    { key: 'stats', icon: <BarChart3 size={22} strokeWidth={1.8} /> },
    { key: 'social', icon: <Trophy size={22} strokeWidth={1.8} /> },
    { key: 'board', icon: <Grid3x3 size={22} strokeWidth={1.8} /> },
  ];
  return (
    <section id="features" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 py-[72px] md:px-6 md:py-[104px] xl:px-0">
      <Reveal>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end md:gap-12">
          <div>
            <Eyebrow>{t('features.eyebrow')}</Eyebrow>
            <SectionTitle className="max-w-[700px]">{t('features.title')}</SectionTitle>
          </div>
          <p className="max-w-[380px] text-base leading-relaxed text-eos-ash md:text-[17px]">{t('features.subtitle')}</p>
        </div>
      </Reveal>
      <div className="mt-8 grid gap-3 md:mt-14 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
        {items.map((f, i) => (
          <Reveal key={f.key} delay={((i % 3) + 1) as 1 | 2 | 3}>
            <div className="h-full rounded-[14px] bg-eos-slate p-[22px] shadow-[inset_0_1px_0_rgba(255,255,254,0.04),inset_0_0_0_1px_rgba(255,255,254,0.03)] md:p-7">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-eos-rise text-eos-bone shadow-[inset_0_1px_0_rgba(255,255,254,0.05)]">
                {f.icon}
              </span>
              <div className="mt-[18px] text-lg font-extrabold text-eos-bone">{t(`features.${f.key}.title`)}</div>
              <p className="mt-2 text-sm leading-relaxed text-eos-ash">{t(`features.${f.key}.body`)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

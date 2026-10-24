'use client';

import { Reveal } from './Reveal';
import { Eyebrow, SectionTitle } from './Section';
import { useLandingT } from '@/lib/landingI18n';

const STEPS = [
  { n: 'I', key: 'step_1' },
  { n: 'II', key: 'step_2' },
  { n: 'III', key: 'step_3' },
];

export function HowItWorks() {
  const { t } = useLandingT();
  return (
    <section id="how" className="mx-auto max-w-[1200px] scroll-mt-6 px-4 py-[72px] md:px-6 md:py-[104px] xl:px-0">
      <Reveal>
        <Eyebrow>{t('how.eyebrow')}</Eyebrow>
        <SectionTitle>{t('how.title')}</SectionTitle>
      </Reveal>
      <ol className="mt-9 grid gap-10 md:mt-16 md:grid-cols-3 md:gap-12">
        {STEPS.map((s, i) => (
          <Reveal key={s.key} as="li" delay={(i + 1) as 1 | 2 | 3}>
            <div className="relative border-t border-eos-seam pt-7">
              <span aria-hidden className="absolute -top-px left-0 h-0.5 w-14 bg-eos-ember" />
              <div className="font-serif text-[44px] font-bold leading-none text-eos-ember md:text-[56px]">{s.n}</div>
              <div className="mt-[18px] font-serif text-[22px] font-bold text-eos-bone">{t(`how.${s.key}.title`)}</div>
              <p className="mt-2.5 text-[15px] leading-relaxed text-eos-ash">{t(`how.${s.key}.body`)}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

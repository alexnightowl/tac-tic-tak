'use client';

import { Target, Gauge, Trophy } from 'lucide-react';
import { Reveal } from './Reveal';
import { useLandingT } from '@/lib/landingI18n';

export function ValueProps() {
  const { t } = useLandingT();
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal>
          <div className="text-center mb-14 md:mb-16">
            <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent)] font-medium">
              {t('value.eyebrow')}
            </span>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
              {t('value.title')}
            </h2>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto">
              {t('value.subtitle')}
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          <Reveal delay={1}>
            <ValueCard
              icon={<Target size={20} />}
              title={t('value.adaptive.title')}
              body={t('value.adaptive.body')}
            />
          </Reveal>
          <Reveal delay={2}>
            <ValueCard
              icon={<Gauge size={20} />}
              title={t('value.per_style.title')}
              body={t('value.per_style.body')}
            />
          </Reveal>
          <Reveal delay={3}>
            <ValueCard
              icon={<Trophy size={20} />}
              title={t('value.gate.title')}
              body={t('value.gate.body')}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function ValueCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="relative glass rounded-2xl p-6 h-full">
      <div className="h-11 w-11 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{body}</p>
    </div>
  );
}

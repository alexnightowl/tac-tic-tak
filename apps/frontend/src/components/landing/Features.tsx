'use client';

import {
  Zap, Maximize, BarChart3, Users2, Palette, RotateCcw, Sparkles,
} from 'lucide-react';
import { Reveal } from './Reveal';
import { useLandingT } from '@/lib/landingI18n';

type Feature = {
  icon: React.ReactNode;
  titleKey: string;
  bodyKey: string;
  accentTone?: 'accent' | 'violet' | 'amber' | 'rose' | 'cyan' | 'emerald';
};

const TONES: Record<NonNullable<Feature['accentTone']>, { bg: string; text: string }> = {
  accent:   { bg: 'bg-[var(--accent)]/15', text: 'text-[var(--accent)]' },
  violet:   { bg: 'bg-violet-500/15',      text: 'text-violet-300' },
  amber:    { bg: 'bg-amber-500/15',       text: 'text-amber-300' },
  rose:     { bg: 'bg-rose-500/15',        text: 'text-rose-300' },
  cyan:     { bg: 'bg-cyan-500/15',        text: 'text-cyan-300' },
  emerald:  { bg: 'bg-emerald-500/15',     text: 'text-emerald-300' },
};

const FEATURES: Feature[] = [
  { icon: <Zap size={18} />,       titleKey: 'features.styles.title',   bodyKey: 'features.styles.body',   accentTone: 'accent'  },
  { icon: <Maximize size={18} />,  titleKey: 'features.focus.title',    bodyKey: 'features.focus.body',    accentTone: 'violet'  },
  { icon: <BarChart3 size={18} />, titleKey: 'features.progress.title', bodyKey: 'features.progress.body', accentTone: 'amber'   },
  { icon: <Users2 size={18} />,    titleKey: 'features.social.title',   bodyKey: 'features.social.body',   accentTone: 'emerald' },
  { icon: <RotateCcw size={18} />, titleKey: 'features.review.title',   bodyKey: 'features.review.body',   accentTone: 'rose'    },
  { icon: <Palette size={18} />,   titleKey: 'features.custom.title',   bodyKey: 'features.custom.body',   accentTone: 'cyan'    },
];

export function Features() {
  const { t } = useLandingT();
  return (
    <section id="features" className="relative py-20 md:py-28 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent)] font-medium">
                {t('features.eyebrow')}
              </span>
              <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
                {t('features.title')}
              </h2>
            </div>
            <p className="text-zinc-400 max-w-md md:text-right">
              {t('features.subtitle')}
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.titleKey} delay={(i % 3 + 1) as any}>
              <FeatureTile
                icon={f.icon}
                title={t(f.titleKey)}
                body={t(f.bodyKey)}
                accentTone={f.accentTone}
              />
            </Reveal>
          ))}
        </div>

        <Reveal delay={4}>
          <div className="mt-8 glass rounded-2xl p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0 flex-1 text-sm text-zinc-300">
              {t('features.banner')}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FeatureTile({ icon, title, body, accentTone = 'accent' }: {
  icon: React.ReactNode; title: string; body: string; accentTone?: Feature['accentTone'];
}) {
  const tone = TONES[accentTone ?? 'accent'];
  return (
    <div className="glass rounded-2xl p-5 h-full">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${tone.bg} ${tone.text}`}>
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-[13px] text-zinc-400 leading-relaxed">{body}</p>
    </div>
  );
}

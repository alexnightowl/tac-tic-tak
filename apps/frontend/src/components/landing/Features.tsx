'use client';

import {
  Zap, Timer, Hourglass, Maximize, BarChart3, Users2, Palette, RotateCcw, Sparkles,
} from 'lucide-react';
import { Reveal } from './Reveal';

type Feature = {
  icon: React.ReactNode;
  title: string;
  body: string;
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
  {
    icon: <Zap size={18} />,
    title: 'Three training styles',
    body: 'Bullet (1–3 min), Blitz (5–15 min), Rapid (10–30 min) — each with its own rating, pace and unlock formula.',
    accentTone: 'accent',
  },
  {
    icon: <Maximize size={18} />,
    title: 'Focus mode',
    body: 'Fullscreen, stats hidden, zero distractions. Nothing to look at but the position in front of you.',
    accentTone: 'violet',
  },
  {
    icon: <BarChart3 size={18} />,
    title: 'Live level-up progress',
    body: 'Every move ticks a progress bar toward the next unlock. You always know how close you are.',
    accentTone: 'amber',
  },
  {
    icon: <Users2 size={18} />,
    title: 'Friends & leaderboards',
    body: 'Add people by nickname, climb the style-specific boards, see friends-only standings when it\'s personal.',
    accentTone: 'emerald',
  },
  {
    icon: <RotateCcw size={18} />,
    title: 'Review what you missed',
    body: 'Failed puzzles queue into a timerless Review mode. Work them out without pressure until they stick.',
    accentTone: 'rose',
  },
  {
    icon: <Palette size={18} />,
    title: 'Make it yours',
    body: 'Pick your board theme, piece set, accent colour, sound pack. The app should feel like your setup, not ours.',
    accentTone: 'cyan',
  },
];

export function Features() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent)] font-medium">
                Everything you need
              </span>
              <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
                The full toolkit, out of the box
              </h2>
            </div>
            <p className="text-zinc-400 max-w-md md:text-right">
              No pay-wall for the things that matter. The whole trainer — styles, review,
              social — is in the product from day one.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3 + 1) as any}>
              <FeatureTile {...f} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={4}>
          <div className="mt-8 glass rounded-2xl p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0 flex-1 text-sm text-zinc-300">
              Over 4 million Lichess puzzles, curated by rating and theme. Every session
              pulls fresh positions calibrated to where you are right now.
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FeatureTile({ icon, title, body, accentTone = 'accent' }: Feature) {
  const tone = TONES[accentTone];
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

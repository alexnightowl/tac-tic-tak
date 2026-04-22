'use client';

import { Target, Gauge, Trophy } from 'lucide-react';
import { Reveal } from './Reveal';

export function ValueProps() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        <Reveal>
          <div className="text-center mb-14 md:mb-16">
            <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent)] font-medium">
              Why it works
            </span>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
              Built around how you actually improve
            </h2>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto">
              Grinding random puzzles doesn't build skill — calibrated pressure does.
              Each piece of the app is designed around a specific training principle.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          <Reveal delay={1}>
            <ValueCard
              icon={<Target size={20} />}
              title="Adaptive difficulty"
              body="Puzzle rating drifts toward yours after every attempt. Too easy? Next one climbs. Stuck? It eases off. You always train at the edge of your ability."
            />
          </Reveal>
          <Reveal delay={2}>
            <ValueCard
              icon={<Gauge size={20} />}
              title="Per-style training"
              body="Bullet sharpens pattern recognition. Rapid builds deep calculation. We track them separately so your bullet rating can't smuggle weak rapid habits."
            />
          </Reveal>
          <Reveal delay={3}>
            <ValueCard
              icon={<Trophy size={20} />}
              title="Real level-up gate"
              body="Rating ceilings only rise when you meet four targets in a single session — count, accuracy, speed, peak. No shortcuts, no grinding for numbers."
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

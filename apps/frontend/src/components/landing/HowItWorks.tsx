'use client';

import { Reveal } from './Reveal';

const STEPS = [
  {
    n: '01',
    title: 'Pick your style',
    body: 'Bullet, Blitz or Rapid. Choose a duration preset and the difficulty you want to push against — the slider shows where your cap is.',
  },
  {
    n: '02',
    title: 'Solve under pressure',
    body: 'The board fills the screen, the timer runs, puzzles adapt to you after every attempt. Missed moves are automatically queued for later review.',
  },
  {
    n: '03',
    title: 'Hit all four to level up',
    body: 'Finish the session with enough solved, high enough accuracy, fast enough, with enough peak rating. Nail all four and your ceiling goes up.',
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="absolute inset-0 pointer-events-none opacity-60" aria-hidden>
        <div className="absolute top-20 -left-20 w-72 h-72 rounded-full"
             style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--accent) 14%, transparent), transparent)' }} />
        <div className="absolute bottom-10 right-0 w-96 h-96 rounded-full"
             style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, #6366f1 16%, transparent), transparent)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 md:px-8">
        <Reveal>
          <div className="mb-12 max-w-2xl">
            <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent)] font-medium">
              How it works
            </span>
            <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight">
              Three steps. Real progress.
            </h2>
            <p className="mt-4 text-zinc-400">
              You're not accumulating a vanity number. Each level-up is a specific,
              earned moment — and the bar shows you exactly how close you are to it.
            </p>
          </div>
        </Reveal>

        <ol className="grid md:grid-cols-3 gap-4 md:gap-6">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} as="li" delay={(i + 1) as any}>
              <div className="glass rounded-2xl p-6 h-full relative overflow-hidden">
                <div className="absolute -top-2 -right-2 text-[88px] font-black leading-none tracking-tighter text-white/[0.04] select-none">
                  {s.n}
                </div>
                <div className="relative">
                  <div className="text-xs font-mono tracking-wider text-[var(--accent)]">{s.n}</div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

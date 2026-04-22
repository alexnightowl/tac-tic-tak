'use client';

import Link from 'next/link';
import { ArrowRight, Swords, Crown, Timer, TrendingUp } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { HeroBoard } from './HeroBoard';
import { Reveal } from './Reveal';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="hero-gradient absolute inset-0 pointer-events-none" aria-hidden />
      <div className="noise absolute inset-0 pointer-events-none" aria-hidden />

      <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-14 md:pt-20 pb-20 md:pb-28">
        {/* Top bar */}
        <nav className="flex items-center justify-between mb-16 md:mb-24">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-semibold tracking-tight text-[15px]">
              tac<span className="text-[var(--accent)]">·</span>tic<span className="text-[var(--accent)]">·</span>tak
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="h-9 px-3 rounded-lg text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="h-9 px-3 rounded-lg text-sm bg-[var(--accent)] text-black font-semibold hover:brightness-110 transition-all"
            >
              Sign up
            </Link>
          </div>
        </nav>

        <div className="grid md:grid-cols-[1.05fr_1fr] gap-10 md:gap-14 items-center">
          {/* Copy */}
          <div className="relative z-10">
            <Reveal>
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--accent)] font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] ring-pulse" />
                Chess tactics, done right
              </span>
            </Reveal>

            <Reveal delay={1}>
              <h1 className="mt-5 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
                Train smarter.<br />
                <span className="text-[var(--accent)]">Level up faster.</span>
              </h1>
            </Reveal>

            <Reveal delay={2}>
              <p className="mt-5 text-zinc-400 text-base md:text-lg max-w-lg leading-relaxed">
                Adaptive puzzles that scale with you. Separate ratings for bullet, blitz and
                rapid. Real progression — not just a number that drifts up.
              </p>
            </Reveal>

            <Reveal delay={3}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 transition-all"
                >
                  <Swords size={16} /> Start training
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center h-12 px-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
                >
                  I have an account
                </Link>
              </div>
            </Reveal>

            <Reveal delay={4}>
              <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
                <HeroStat icon={<Timer size={14} />} label="Styles" value="3" />
                <HeroStat icon={<TrendingUp size={14} />} label="Adaptive" value="∞" />
                <HeroStat icon={<Crown size={14} />} label="Tiers" value="5" />
              </div>
            </Reveal>
          </div>

          {/* Board */}
          <div className="relative">
            <Reveal delay={2} className="relative">
              {/* Accent glow behind the board. */}
              <div
                className="absolute -inset-8 rounded-[3rem] blur-2xl opacity-60 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 70%)',
                }}
                aria-hidden
              />
              <div className="relative max-w-[520px] mx-auto">
                <HeroBoard />

                {/* Floating meta card: "Your turn" */}
                <div className="absolute -left-4 md:-left-10 top-8 md:top-12 glass rounded-2xl px-3 py-2.5 flex items-center gap-2.5 shadow-xl float-slow">
                  <div className="h-9 w-9 rounded-xl bg-white text-zinc-900 flex items-center justify-center shadow-inner">
                    <Crown size={18} />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold leading-none">Your turn</div>
                    <div className="text-[10px] text-zinc-400 leading-none mt-1">Find the best move</div>
                  </div>
                </div>

                {/* Floating meta card: unlock progress */}
                <div className="absolute -right-3 md:-right-8 bottom-10 md:bottom-14 glass rounded-2xl px-3 py-2.5 shadow-xl float-slow" style={{ animationDelay: '1.2s' }}>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">Level-up</span>
                    <span className="tabular-nums text-[11px] font-semibold text-[var(--accent)]">78%</span>
                  </div>
                  <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: '78%' }} />
                  </div>
                </div>

                {/* Floating meta card: timer */}
                <div className="absolute -top-4 right-4 md:right-10 glass rounded-full px-4 py-1.5 font-mono text-sm tabular-nums shadow-xl">
                  04:12
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-400">
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1 leading-none">{value}</div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { ArrowRight, Swords } from 'lucide-react';
import { Reveal } from './Reveal';
import { useLandingT } from '@/lib/landingI18n';

export function CTA() {
  const { t } = useLandingT();
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-5 md:px-8">
        <Reveal>
          <div
            className="relative glass rounded-3xl overflow-hidden px-6 py-12 md:px-12 md:py-16 text-center"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--accent) 10%, rgba(255,255,255,0.04)), rgba(255,255,255,0.015))',
            }}
          >
            <div
              className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] blur-3xl opacity-50 pointer-events-none"
              style={{
                background:
                  'radial-gradient(closest-side, color-mix(in srgb, var(--accent) 40%, transparent), transparent 70%)',
              }}
              aria-hidden
            />
            <h2 className="relative text-3xl md:text-5xl font-semibold tracking-tight">
              {t('cta.title_1')} <br className="hidden md:block" />
              <span className="text-[var(--accent)]">{t('cta.title_2')}</span>
            </h2>
            <p className="relative mt-5 text-zinc-400 max-w-xl mx-auto">
              {t('cta.subtitle')}
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 transition-all"
              >
                <Swords size={16} /> {t('cta.primary')}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center h-12 px-6 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors"
              >
                {t('cta.secondary')}
              </Link>
            </div>
          </div>
        </Reveal>
      </div>

      <footer className="mt-10 border-t border-white/5 pt-8 pb-10">
        <div className="max-w-6xl mx-auto px-5 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>© {new Date().getFullYear()} tac·tic·tak</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-zinc-300 transition-colors">{t('footer.login')}</Link>
            <Link href="/register" className="hover:text-zinc-300 transition-colors">{t('footer.signup')}</Link>
            <a
              href="https://database.lichess.org/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              {t('footer.puzzles')}
            </a>
          </div>
        </div>
      </footer>
    </section>
  );
}

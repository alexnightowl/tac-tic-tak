'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BAND_ICON, type Band } from '@/lib/levels';
import { sfx, stopLongClip } from '@/lib/sound';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = {
  direction: 'up' | 'down';
  from: Band['key'];
  to: Band['key'];
  normFrom: number;
  normTo: number;
  styleLabel: string;
  onClose: () => void;
};

/**
 * Full-screen rank change moment (design: Sound & motion lab → Ceremony).
 * Up: current eye spins up, white flash, the next eye pops in, rank-up clip.
 * Down: eye spins down and cools to grey, rank-down clip, no flash.
 */
export function RankCeremony({ direction, from, to, normFrom, normTo, styleLabel, onClose }: Props) {
  const t = useT();
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [norm, setNorm] = useState(normFrom);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const up = direction === 'up';
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    if (up) sfx(to === 'expert' ? 'rankFinal' : to === 'advanced' ? 'rankMangekyo' : 'rankTomoe');
    else sfx('rankDown');
    later(40, () => setStage(1));
    later(reduce ? 200 : up ? 950 : 750, () => {
      setStage(2);
      const steps = 14;
      for (let i = 1; i <= steps; i++) {
        later((i * 600) / steps, () => setNorm(Math.round(normFrom + ((normTo - normFrom) * i) / steps)));
      }
    });
    const ts = timers.current;
    return () => { ts.forEach(clearTimeout); };
  }, [up, to, normFrom, normTo]);

  function close() {
    stopLongClip(500);
    onClose();
  }

  const glow = !up ? (stage === 2 ? 0.04 : 0.14) : stage === 0 ? 0.08 : stage === 1 ? 0.22 : 0.34;
  const finalGlow = to === 'expert' ? 'rgba(150,90,220,0.6)' : 'rgba(214,72,60,0.55)';

  if (!mounted) return null;
  // Portal to <body>: the app shell has transformed ancestors, which would
  // turn `fixed` into "relative to that box" instead of the viewport.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rank-ceremony-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-eos-ink px-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-[background] duration-500"
        style={{ background: `radial-gradient(circle at 50% 38%, rgba(176,58,58,${glow}) 0%, rgba(120,30,34,0.12) 35%, rgba(20,19,23,0) 65%)` }}
      />
      {up && stage === 2 && <div aria-hidden className="rank-flash pointer-events-none absolute inset-0 bg-white" />}

      <div className="relative h-[200px] w-[200px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BAND_ICON[from]}
          alt=""
          className={cn('absolute inset-0 h-full w-full transition-opacity duration-200', stage === 1 ? 'rank-spin opacity-100' : 'opacity-0')}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BAND_ICON[to]}
          alt=""
          className={cn('absolute inset-0 h-full w-full', stage === 2 ? 'rank-pop opacity-100' : 'opacity-0')}
          style={{ filter: up ? `drop-shadow(0 0 26px ${finalGlow})` : 'grayscale(0.85) brightness(0.75)' }}
        />
      </div>

      <div
        className={cn('relative mt-10 text-center transition-all duration-500 delay-150', stage === 2 ? 'translate-y-0 opacity-100' : 'translate-y-3.5 opacity-0')}
      >
        <div className={cn('text-xs font-extrabold tracking-[0.25em]', up ? 'text-[#e07d76]' : 'text-eos-ash')}>
          {up ? t('rank.up') : t('rank.down')}
        </div>
        <h2 id="rank-ceremony-title" className="mt-2.5 font-serif text-4xl font-bold text-eos-bone">
          {t(`levels.${to}`)}
        </h2>
        <div className="mt-2 text-sm text-eos-ash">
          {t('rank.norm').replace('{style}', styleLabel)}{' '}
          <b className="tabular-nums text-eos-bone">{normFrom} → {norm}</b>
        </div>
        <div className="mt-1.5 text-[13px] text-eos-dust">
          {up ? t(to === 'expert' ? 'rank.line_final' : to === 'advanced' ? 'rank.line_mangekyo' : 'rank.line_tomoe') : t('rank.line_down')}
        </div>
      </div>

      <div className={cn('relative mt-10 w-full max-w-xs transition-opacity duration-500 delay-500', stage === 2 ? 'opacity-100' : 'opacity-0')}>
        <button
          type="button"
          onClick={close}
          className="btn-ember h-[52px] w-full px-1.5 font-serif text-[15px] font-bold uppercase tracking-[0.1em]"
          style={{ borderWidth: '14px 15px' }}
          autoFocus
        >
          {t('rank.continue')}
        </button>
      </div>
    </div>,
    document.body,
  );
}

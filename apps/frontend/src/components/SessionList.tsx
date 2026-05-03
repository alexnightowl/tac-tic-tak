'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Trash2, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StyleIcon } from '@/components/StyleIcon';
import { isTrainingStyle } from '@/lib/levels';

export type SessionRow = {
  id: string;
  startedAt: string;
  durationSec: number;
  solved: number;
  failed: number;
  accuracy: number;
  avgResponseMs: number;
  peakRating: number;
  startRating: number;
  mode: string;
  /** bullet | blitz | rapid — drives the time-control icon on each
   *  row. Optional for tolerance with older endpoints that don't
   *  return it yet. */
  style?: string;
  theme: string | null;
};

type Props = {
  sessions: SessionRow[];
  onDelete?: (id: string) => void;
  language: string;
  emptyLabel: string;
};

export function SessionList({ sessions, onDelete, language, emptyLabel }: Props) {
  const groups = useGrouped(sessions, language);
  if (sessions.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-5">
      {groups.map(([label, rows]) => (
        <div key={label}>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-2 pl-1">{label}</h3>
          <div className="flex flex-col gap-2">
            {rows.map((s) => <SessionRowCard key={s.id} s={s} onDelete={onDelete} language={language} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function useGrouped(sessions: SessionRow[], language: string) {
  const locale = language === 'uk' ? 'uk-UA' : 'en-US';
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const buckets = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const d = startOfDay(new Date(s.startedAt));
    let label: string;
    if (d.getTime() === today.getTime()) label = language === 'uk' ? 'Сьогодні' : 'Today';
    else if (d.getTime() === yesterday.getTime()) label = language === 'uk' ? 'Вчора' : 'Yesterday';
    else if (now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000) {
      label = d.toLocaleDateString(locale, { weekday: 'long' });
    } else {
      label = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    }
    label = label.charAt(0).toUpperCase() + label.slice(1);
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(s);
  }
  return Array.from(buckets.entries());
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function SessionRowCard({ s, onDelete, language }: { s: SessionRow; onDelete?: (id: string) => void; language: string }) {
  const canDelete = !!onDelete;
  const [dx, setDx] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [animating, setAnimating] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<'h' | 'v' | null>(null);
  const REVEAL = 88;
  const R = 16; // matches Tailwind rounded-2xl

  // Force 24h so the time fits on one line at any locale (en-US would
  // otherwise render "04:45 PM" which overflows the left column).
  const time = new Date(s.startedAt).toLocaleTimeString(language === 'uk' ? 'uk-UA' : 'en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const delta = s.peakRating - s.startRating;
  const mode = s.theme ?? s.mode;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canDelete) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axis.current = null;
    setAnimating(false);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!canDelete) return;
    const ddx = e.clientX - startX.current;
    const ddy = e.clientY - startY.current;
    if (axis.current === null) {
      if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return;
      axis.current = Math.abs(ddx) > Math.abs(ddy) ? 'h' : 'v';
    }
    if (axis.current !== 'h') return;
    const next = Math.max(-REVEAL, Math.min(0, ddx));
    setDx(next);
  };
  const onPointerUp = () => {
    if (!canDelete) return;
    if (axis.current === 'h') {
      setAnimating(true);
      setDx(dx < -REVEAL / 2 ? -REVEAL : 0);
    }
    axis.current = null;
  };

  const reset = () => { setAnimating(true); setDx(0); };

  // Animate border-radius in sync with the swipe so the card's right edge
  // locks cleanly against the delete button once fully revealed.
  const progress = Math.min(1, Math.abs(dx) / REVEAL);
  const innerRadius = R * (1 - progress);
  // Fade the delete button in with the swipe — at rest it's invisible, so
  // no red ever bleeds through the card's frosted glass.
  const buttonOpacity = Math.min(1, Math.abs(dx) / 28);
  const cardTransition = animating ? 'transform 200ms ease, border-radius 200ms ease' : 'none';
  const buttonTransition = animating ? 'opacity 200ms ease, border-radius 200ms ease' : 'opacity 120ms linear';

  return (
    <div className="relative">
      {/* Delete action — hidden at rest, fades in as the swipe progresses. */}
      {canDelete && (
        <button
          className="absolute inset-y-0 right-0 w-[88px] bg-red-500/90 text-white text-xs flex flex-col items-center justify-center gap-1"
          onClick={() => setConfirming(true)}
          aria-label={language === 'uk' ? 'Видалити' : 'Delete'}
          style={{
            opacity: buttonOpacity,
            pointerEvents: buttonOpacity > 0.5 ? 'auto' : 'none',
            borderTopLeftRadius: innerRadius,
            borderBottomLeftRadius: innerRadius,
            borderTopRightRadius: R,
            borderBottomRightRadius: R,
            transition: buttonTransition,
          }}
        >
          <Trash2 size={18} />
          <span>{language === 'uk' ? 'Видалити' : 'Delete'}</span>
        </button>
      )}

      <Link
        href={`/sessions/${s.id}`}
        className="relative block glass"
        style={{
          transform: `translateX(${dx}px)`,
          willChange: 'transform',
          borderTopLeftRadius: R,
          borderBottomLeftRadius: R,
          borderTopRightRadius: innerRadius,
          borderBottomRightRadius: innerRadius,
          transition: cardTransition,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => { if (dx !== 0) { e.preventDefault(); reset(); } }}
      >
        <div className="p-3 flex items-center gap-3">
          <div className="flex flex-col items-center justify-center w-14 shrink-0">
            <div className="text-[11px] text-zinc-500 leading-none">{time}</div>
            <div className="text-lg font-semibold tabular-nums leading-tight mt-1">{s.solved}</div>
            <div className="text-[10px] text-zinc-500 leading-none">solved</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="tabular-nums text-zinc-300">{s.startRating}</span>
              <ChevronRight size={12} className="text-zinc-600" />
              <span className={cn(
                'tabular-nums font-semibold',
                delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-rose-300' : 'text-white',
              )}>{s.peakRating}</span>
              <span className={cn(
                'text-xs flex items-center',
                delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-zinc-500',
              )}>
                {delta > 0 ? <ArrowUpRight size={12} /> : delta < 0 ? <ArrowDownRight size={12} /> : null}
                {delta !== 0 && <span className="ml-0.5 tabular-nums">{delta > 0 ? '+' : ''}{delta}</span>}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5 min-w-0">
              {s.style && isTrainingStyle(s.style) && (
                <StyleIcon style={s.style} size={11} className="shrink-0" />
              )}
              <span className="truncate">
                {mode} · {Math.round(s.accuracy * 100)}% · {Math.round(s.avgResponseMs)}ms · {Math.round(s.durationSec / 60)}m
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-zinc-500 shrink-0" />
        </div>
      </Link>

      {confirming && onDelete && (
        <ConfirmDelete
          language={language}
          onConfirm={() => { setConfirming(false); onDelete(s.id); }}
          onCancel={() => { setConfirming(false); reset(); }}
        />
      )}
    </div>
  );
}

function ConfirmDelete({ onConfirm, onCancel, language }: { onConfirm: () => void; onCancel: () => void; language: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-4" onClick={onCancel}>
      <div className="glass rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-base font-medium">
          {language === 'uk' ? 'Видалити цю сесію?' : 'Delete this session?'}
        </div>
        <div className="text-xs text-zinc-400 mt-1">
          {language === 'uk' ? 'Статистика буде перерахована. Дію не можна скасувати.' : 'Stats will be recomputed. This cannot be undone.'}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 h-11 rounded-xl border border-[var(--border)] text-sm">
            {language === 'uk' ? 'Скасувати' : 'Cancel'}
          </button>
          <button onClick={onConfirm} className="flex-1 h-11 rounded-xl bg-red-500/90 text-white text-sm font-medium">
            {language === 'uk' ? 'Видалити' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

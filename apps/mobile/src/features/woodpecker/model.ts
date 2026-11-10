import type { WoodpeckerSet, WoodpeckerSetSummary } from '@tac/core/api';
import { localeFor } from '@tac/core/format';
import { woodpeckerPlan, WOODPECKER_FIRST_CYCLE_DAYS, type WoodpeckerPlan, type WoodpeckerStatus, type WoodpeckerToday } from '@tac/core/library';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';

import { useAttempts } from '@/features/library/store';
import { plural } from '@/features/offline/format';
import type { TFn, TnFn } from '@/ui/lang';
import { useWoodpeckerSet, useWoodpeckerSets } from './api';

// The Woodpecker page's numbers (phone SetScreen, desktop DxWoodpecker,
// the Play cards, the solve chips): the method's phase from core's
// woodpeckerPlan over the device's results, and the lines that say it.

type Tn = TnFn;

export type SetView = WoodpeckerPlan & {
  set: WoodpeckerSet;
  /** A "book" set whose first cycle still draws from its pool. */
  open: boolean;
};

export function useSetView(set: WoodpeckerSet | null | undefined): SetView | null {
  const attempts = useAttempts();
  return useMemo(
    () => (set ? { set, open: set.method === 'book' && set.closed === false, ...woodpeckerPlan(set, attempts, new Date()) } : null),
    [set, attempts],
  );
}

/**
 * The set the page shows: `id` when it is active, else the newest one.
 * `summary` is null when the player has no set.
 */
export function useActiveSet(id?: string | null) {
  const list = useWoodpeckerSets();
  // An unknown or archived `id` falls back to the newest set.
  const summary: WoodpeckerSetSummary | null = list.data ? (list.data.find((s) => s.id === id) ?? list.data[0] ?? null) : null;
  const wantId = list.data ? (summary?.id ?? null) : (id ?? null);
  const full = useWoodpeckerSet(wantId);
  // The query keeps the previous key's data (keepPreviousData): only the set asked for counts.
  const view = useSetView(wantId && full.data?.id === wantId ? full.data : null);
  return {
    list,
    summary,
    view,
    /** Still waiting for the list or the set. */
    loading: list.isPending || (!!wantId && full.isPending),
    error: list.isError || (!!wantId && full.isError),
    retry: () => {
      void list.refetch();
      if (wantId) void full.refetch();
    },
  };
}

/** The cycle Continue opens (null: the method is complete). */
export function cycleToSolve(s: WoodpeckerStatus): number | null {
  if (s.phase === 'first') return 1;
  if (s.phase === 'cycle') return s.cycle;
  if (s.phase === 'rest') return s.next;
  return null;
}

export function solveHref(setId: string, cycle: number): Href {
  return `/woodpecker/solve?set=${setId}&cycle=${cycle}` as Href;
}

export function openSolve(setId: string, cycle: number) {
  router.push(solveHref(setId, cycle));
}

export const daysText = (tn: Tn, n: number) => plural(tn, 'woodpecker.days', n);

/** The main button's label for the phase. */
export function ctaLabel(v: SetView, t: TFn): string {
  const s = v.status;
  if (s.phase === 'first') return v.cycles.length === 0 ? t('woodpecker.cta.start') : t('woodpecker.cta.continue');
  if (s.phase === 'cycle') return s.done === 0 && s.cycle === 1 ? t('woodpecker.cta.start') : t('woodpecker.cta.continue');
  // Rest day: the same label on a slate plate (the advice says to wait).
  if (s.phase === 'rest') return t('woodpecker.cta.next', { n: s.next });
  return t('woodpecker.cta.new');
}

const todayText = (today: WoodpeckerToday, t: TFn) =>
  today.met ? t('woodpecker.entry.today_met') : t('woodpecker.entry.today', { done: today.done, goal: today.goal ?? 0 });

/** The Play cards' one line: "Cycle 2 · 34/100 · today 12/40". */
export function stateLine(v: SetView, t: TFn): string {
  const s = v.status;
  if (s.phase === 'first') return `${t('woodpecker.entry.first', { day: Math.min(s.day, WOODPECKER_FIRST_CYCLE_DAYS), of: WOODPECKER_FIRST_CYCLE_DAYS, solved: s.solved })}`;
  if (s.phase === 'cycle') return `${t('woodpecker.entry.cycle', { n: s.cycle, done: s.done, total: s.total })} · ${todayText(s.today, t)}`;
  if (s.phase === 'rest') return t('woodpecker.entry.rest', { n: s.cycle, next: s.next });
  return t('woodpecker.entry.complete');
}

/** Progress for the Play cards' bar (null: no bar). */
export function stateProgress(v: SetView): number | null {
  const s = v.status;
  if (s.phase === 'first') return Math.min(1, s.day / WOODPECKER_FIRST_CYCLE_DAYS);
  if (s.phase === 'cycle' && s.done > 0) return s.done / Math.max(1, s.total);
  return null;
}

/** "Target 7 days · by 24 Nov", or how far over it the cycle is. */
export function deadlineLine(s: Extract<WoodpeckerStatus, { phase: 'cycle' }>, t: TFn, tn: Tn, lang: string): string {
  if (s.target == null) return t('woodpecker.cycle.no_target');
  if (s.daysLeft != null && s.daysLeft <= 0) return t('woodpecker.cycle.over', { days: daysText(tn, 1 - s.daysLeft) });
  const date = s.deadline ? shortDate(s.deadline, lang) : '';
  const head = t('woodpecker.cycle.deadline', { days: daysText(tn, s.target), date });
  return s.daysLeft != null && s.deadline ? `${head} · ${plural(tn, 'woodpecker.left', s.daysLeft)}` : head;
}

/** The rest phase's advice line. */
export function restLine(s: Extract<WoodpeckerStatus, { phase: 'rest' }>, t: TFn, tn: Tn): string {
  const days = daysText(tn, s.nextTarget);
  if (s.rested === 0) return t('woodpecker.rest.today', { n: s.next, days });
  const rested = daysText(tn, s.rested);
  return s.rested > 7 ? t('woodpecker.rest.long', { n: s.next, days, rested }) : t('woodpecker.rest.ready', { n: s.next, days, rested });
}

/** "Within the target of 7 days" / "2 days over the target" / "74% clean". */
export function restResult(v: SetView, s: Extract<WoodpeckerStatus, { phase: 'rest' }>, t: TFn, tn: Tn): { text: string; good: boolean } {
  const c = v.cycles.find((x) => x.cycle === s.cycle);
  if (s.met == null || c?.target == null) return { text: t('woodpecker.rest.clean', { pct: c?.cleanPct ?? 0 }), good: true };
  return s.met
    ? { text: t('woodpecker.rest.met', { days: daysText(tn, c.target) }), good: true }
    : { text: t('woodpecker.rest.missed', { days: daysText(tn, s.days - c.target) }), good: false };
}

/** "174 puzzles · Blitz · level 1200", or the pool while the first cycle is open. */
export function setLine(v: SetView, t: TFn, tn: Tn): string {
  const vars = { puzzles: plural(tn, 'library.puzzles', v.set.size), style: t(`style.${v.set.style}.name`), level: v.set.rating };
  return v.open ? t('woodpecker.pool_line', vars) : t('woodpecker.set_line', vars);
}

/** "24 Nov" in the app's language. */
export function shortDate(day: string, lang: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short' });
}

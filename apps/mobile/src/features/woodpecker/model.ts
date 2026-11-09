import type { WoodpeckerSet, WoodpeckerSetSummary } from '@tac/core/api';
import {
  bookProgress,
  cycleTargetSec,
  speedupPct,
  woodpeckerShape,
  WOODPECKER_BLOCK,
  type BookProgress,
  type CycleStats,
} from '@tac/core/library';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';

import { useAttempts } from '@/features/library/store';
import type { TFn } from '@/ui/lang';
import { useWoodpeckerSet, useWoodpeckerSets } from './api';

// The Woodpecker set page's numbers (phone SetScreen, desktop
// DxWoodpecker, the Play cards): the Library's bookProgress over the set's
// blocks, plus the per-cycle history the method is about.

/** "1:12" (a puzzle's seconds). */
export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`;

export type CycleBar = {
  cycle: number;
  avgSec: number | null;
  /** That cycle's own target (null for cycle 1). */
  target: number | null;
  cleanPct: number | null;
  complete: boolean;
  /** Against the cycle before (positive = faster). */
  speedup: number | null;
};

export type BlockRow = { index: number; from: number; to: number; done: number; total: number; complete: boolean; current: boolean; start: number };

export type SetView = {
  set: WoodpeckerSet;
  progress: BookProgress;
  /** The cycle being solved (or just finished). */
  cycle: number;
  complete: boolean;
  done: number;
  total: number;
  current: CycleStats | undefined;
  cleanPct: number | null;
  /** This cycle's target, or, once it is complete, the next one's. */
  target: number | null;
  nextTarget: number | null;
  history: CycleBar[];
  blocks: BlockRow[];
  /** Where Continue goes. */
  next: { cycle: number; start: number };
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

export function setView(set: WoodpeckerSet, progress: BookProgress): SetView {
  const cycle = progress.cycle;
  const current = progress.cycles.find((c) => c.cycle === cycle);
  const history: CycleBar[] = progress.cycles.map((c, i) => ({
    cycle: c.cycle,
    avgSec: c.avgSec,
    target: cycleTargetSec(progress.cycles, c.cycle),
    cleanPct: pct(c.clean, c.done),
    complete: c.complete,
    speedup: i > 0 ? speedupPct(progress.cycles[i - 1].avgSec, c.avgSec) : null,
  }));
  const blocks: BlockRow[] = progress.chapters.map((c) => {
    const from = c.index * WOODPECKER_BLOCK;
    return {
      index: c.index,
      from: from + 1,
      to: from + c.total,
      done: c.done,
      total: c.total,
      complete: c.complete,
      current: !progress.cycleComplete && progress.next?.chapterIndex === c.index,
      start: from,
    };
  });
  const nextIndex = progress.next ? progress.next.chapterIndex * WOODPECKER_BLOCK + progress.next.puzzleIndex : 0;
  return {
    set,
    progress,
    cycle,
    complete: progress.cycleComplete,
    done: progress.done,
    total: progress.total,
    current,
    cleanPct: current ? pct(current.clean, current.done) : null,
    target: cycleTargetSec(progress.cycles, cycle),
    nextTarget: cycleTargetSec(progress.cycles, cycle + 1),
    history,
    blocks,
    next: progress.cycleComplete ? { cycle: cycle + 1, start: 0 } : { cycle, start: nextIndex },
  };
}

export function useSetView(set: WoodpeckerSet | null | undefined): SetView | null {
  const attempts = useAttempts();
  return useMemo(() => (set ? setView(set, bookProgress(woodpeckerShape(set), attempts)) : null), [set, attempts]);
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

export function solveHref(setId: string, to: { cycle: number; start: number }): Href {
  return `/woodpecker/solve?set=${setId}&cycle=${to.cycle}&start=${to.start}` as Href;
}

export function openSolve(setId: string, to: { cycle: number; start: number }) {
  router.push(solveHref(setId, to));
}

/** The Continue label for the set's state. */
export function ctaLabel(v: SetView, t: TFn, short = false): string {
  if (v.complete) return t('woodpecker.cta_new_cycle', { n: v.cycle + 1 });
  if (v.done === 0 && v.cycle === 1) return t('woodpecker.cta_start');
  return short ? t('woodpecker.cta_continue_short') : t('woodpecker.cta_continue', { n: v.next.start + 1 });
}

/** The Play cards' one-line state: "Cycle 2 · 34/100 · target 1:12 a puzzle". */
export function stateLine(v: SetView, t: TFn): string {
  if (v.complete) return t('woodpecker.entry.complete', { n: v.cycle, next: v.cycle + 1 });
  const head = t('woodpecker.entry.state', { n: v.cycle, done: v.done, total: v.total });
  return v.target != null ? `${head} · ${t('woodpecker.entry.target', { time: clock(v.target) })}` : head;
}

export const difficultyLabel = (d: WoodpeckerSetSummary['difficulty'], t: TFn) => t(`woodpecker.diff.${d}`);

import { queryKeys, type PlanToday } from '@tac/core/api';
import type { TrainingStyle } from '@tac/core/rules';
import type { NextResponse } from '@tac/core/runner';
import { queryOptions } from '@tanstack/react-query';

import { syncBeforeOnlineSession } from '@/features/offline/sync';
import { stashFirstPuzzle } from '@/features/play/pendingPuzzle';
import { api } from '@/platform/api';
import { appKV, readJSON, writeJSON } from '@/platform/storage';

// The daily plan (D40): GET /plan/today for the Play setup's style, the
// plan session's start, and a device record of the running plan session
// (its themes and per-theme results) that the runner label, the summary
// and "Play again" read. The record is one entry: the latest plan session.

/** The player's local midnight, as the server's `since`. */
export function localMidnightISO(now: Date = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export const planQuery = (style: TrainingStyle, since: string) =>
  queryOptions({
    queryKey: queryKeys.planToday(style, since),
    queryFn: () => api.plan.today(style, since),
    staleTime: 60_000,
  });

/** Per plan theme: puzzles that carried it, and how many of those were solved. */
export type PlanResults = Record<string, { solved: number; total: number }>;

export type PlanRecord = {
  sessionId: string;
  style: TrainingStyle;
  durationSec: number;
  themes: string[];
  results: PlanResults;
  /** Attempts already counted into `results` (a restored runner skips what it missed). */
  seen: number;
};

const PLAN_KEY = 'taktic.planSession';

export function readPlanRecord(sessionId: string): PlanRecord | null {
  const r = readJSON<PlanRecord | null>(appKV, PLAN_KEY, null);
  return r && r.sessionId === sessionId && Array.isArray(r.themes) ? r : null;
}

export function writePlanRecord(r: PlanRecord): void {
  writeJSON(appKV, PLAN_KEY, r);
}

/** Counts one resolved puzzle under each plan theme it carries. */
export function addPlanResult(r: PlanRecord, puzzleThemes: readonly string[], solved: boolean): PlanRecord {
  const results = { ...r.results };
  for (const slug of r.themes) {
    if (!puzzleThemes.includes(slug)) continue;
    const cur = results[slug] ?? { solved: 0, total: 0 };
    results[slug] = { solved: cur.solved + (solved ? 1 : 0), total: cur.total + 1 };
  }
  return { ...r, results, seen: r.seen + 1 };
}

/**
 * POST /sessions for today's plan: theme mode over the plan's themes; the
 * server sets the start difficulty (level − 50). The setup prefs stay as
 * they were (Quick start keeps repeating the player's own setup).
 */
export async function startPlanSession(plan: { style: TrainingStyle; themes: string[]; durationSec: number; startRating: number }): Promise<string> {
  await syncBeforeOnlineSession();
  const r = await api.sessions.create({
    mode: 'theme',
    variant: 'plan',
    themes: plan.themes,
    style: plan.style,
    durationSec: plan.durationSec,
    startRating: plan.startRating,
    ruleset: 'v2',
  });
  writePlanRecord({ sessionId: r.sessionId, style: plan.style, durationSec: plan.durationSec, themes: plan.themes, results: {}, seen: 0 });
  if (r.firstPuzzle) stashFirstPuzzle(r.sessionId, r.firstPuzzle as unknown as NextResponse);
  return r.sessionId;
}

export type { PlanToday };

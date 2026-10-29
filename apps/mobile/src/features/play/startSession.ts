import type { NextResponse } from '@tac/core/runner';
import { create } from 'zustand';

import { syncBeforeOnlineSession } from '@/features/offline/sync';
import { api } from '@/platform/api';
import { stashFirstPuzzle } from './pendingPuzzle';
import { readLastTheme, writeLastDuration, writeLastSetup, writeLastTheme, type SessionSetup } from './setupPrefs';

/**
 * POST /sessions for a setup (Play tab Start, Home quick start, summary
 * Play again). Stashes the first puzzle for the runner and remembers the
 * setup. Resolves the new session id; throws the ApiError.
 */
export async function startSession(setup: SessionSetup): Promise<string> {
  // Offline results first: a session that ticks today's streak can't
  // backfill an earlier offline day (OFFLINE.md). Bounded, never throws.
  await syncBeforeOnlineSession();
  const r = await api.sessions.create({
    startRating: setup.startRating,
    durationSec: setup.durationSec,
    mode: setup.mode,
    style: setup.style,
    ...(setup.mode === 'theme' && setup.theme ? { theme: setup.theme } : null),
  });
  writeLastDuration(setup.style, setup.durationSec);
  writeLastSetup(setup);
  if (r.firstPuzzle) stashFirstPuzzle(r.sessionId, r.firstPuzzle as unknown as NextResponse);
  return r.sessionId;
}

/**
 * The theme-mode pick, shared by the setup screen and the theme-picker
 * sheet route (a separate screen, so it can't be a prop). MMKV-backed so
 * the pick survives restarts.
 */
type ThemePick = { theme: string; setTheme: (slug: string) => void };

export const useThemePick = create<ThemePick>((set) => ({
  theme: readLastTheme(),
  setTheme: (theme) => {
    writeLastTheme(theme);
    set({ theme });
  },
}));

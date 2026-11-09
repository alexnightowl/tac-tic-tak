import { create } from 'zustand';

import { appKV, readJSON, writeJSON } from '@/platform/storage';

// Blind mode (D40): the setup pick (on/off, look time) and, per session
// started blind, its look time and peek count. The runner and the summary
// read the session entry (the server only learns `variant: 'blind'`), so a
// reload or "play again" keeps the session blind on this device.

export const BLIND_PREVIEWS = [3, 5, 10] as const;
export type BlindPreview = (typeof BLIND_PREVIEWS)[number];
export const DEFAULT_PREVIEW: BlindPreview = 5;

const PICK_KEY = 'taktic.blindPick';
const SESSIONS_KEY = 'taktic.blindSessions';
/** Old entries drop off: only the latest sessions matter (runner, summary, history). */
const KEEP_SESSIONS = 30;

type Pick = { on: boolean; previewSec: BlindPreview };

const isPreview = (n: unknown): n is BlindPreview => BLIND_PREVIEWS.includes(n as BlindPreview);

function readPick(): Pick {
  const p = readJSON<Partial<Pick> | null>(appKV, PICK_KEY, null);
  return { on: p?.on === true, previewSec: isPreview(p?.previewSec) ? p.previewSec : DEFAULT_PREVIEW };
}

type BlindPick = Pick & {
  setOn: (on: boolean) => void;
  setPreview: (sec: BlindPreview) => void;
};

/** The Play setup's blind switch and look time (Free / Themes), remembered on the device. */
export const useBlindPick = create<BlindPick>((set, get) => ({
  ...readPick(),
  setOn: (on) => {
    set({ on });
    writeJSON(appKV, PICK_KEY, { on, previewSec: get().previewSec });
  },
  setPreview: (previewSec) => {
    set({ previewSec });
    writeJSON(appKV, PICK_KEY, { on: get().on, previewSec });
  },
}));

/** The look time a new session starts blind with, or null (rated sessions are never blind). */
export function blindPreviewFor(mode: 'mixed' | 'casual' | 'theme'): BlindPreview | null {
  if (mode === 'mixed') return null;
  const p = useBlindPick.getState();
  return p.on ? p.previewSec : null;
}

export type BlindSession = { previewSec: number; peeks: number };
type Sessions = Record<string, BlindSession & { at: number }>;

/** POST /sessions went out with variant 'blind': remember it for the runner. */
export function markBlindSession(sessionId: string, previewSec: number): void {
  const all = readJSON<Sessions>(appKV, SESSIONS_KEY, {});
  all[sessionId] = { previewSec, peeks: 0, at: Date.now() };
  const ids = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
  for (const id of ids.slice(KEEP_SESSIONS)) delete all[id];
  writeJSON(appKV, SESSIONS_KEY, all);
}

export function blindSessionOf(sessionId: string): BlindSession | null {
  const e = readJSON<Sessions>(appKV, SESSIONS_KEY, {})[sessionId];
  return e && typeof e.previewSec === 'number' ? { previewSec: e.previewSec, peeks: e.peeks ?? 0 } : null;
}

export function writeBlindPeeks(sessionId: string, peeks: number): void {
  const all = readJSON<Sessions>(appKV, SESSIONS_KEY, {});
  if (!all[sessionId]) return;
  all[sessionId] = { ...all[sessionId], peeks };
  writeJSON(appKV, SESSIONS_KEY, all);
}

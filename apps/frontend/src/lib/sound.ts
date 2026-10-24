'use client';

import { create } from 'zustand';
import { synth, setSynthVolume } from './sound/engine';
import { DEFAULT_SOUND_PICKS, SOUND_CATALOG, type SoundEvent, type SoundVariant } from './sound/catalog';
import { useAppStore } from './store';

export type { SoundEvent } from './sound/catalog';

/* ── Per-device preferences (volume + picked variant per event) ───────── */

const PREFS_KEY = 'taktic.soundPrefs';

type SoundPrefs = {
  volume: number; // 0..1
  picks: Record<SoundEvent, string>;
};

function loadPrefs(): SoundPrefs {
  const fallback: SoundPrefs = { volume: 0.7, picks: { ...DEFAULT_SOUND_PICKS } };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = JSON.parse(window.localStorage.getItem(PREFS_KEY) || 'null');
    if (!raw) return fallback;
    return {
      volume: typeof raw.volume === 'number' ? raw.volume : fallback.volume,
      picks: { ...DEFAULT_SOUND_PICKS, ...(raw.picks || {}) },
    };
  } catch {
    return fallback;
  }
}

type PrefsState = SoundPrefs & {
  setVolume: (v: number) => void;
  pick: (e: SoundEvent, id: string) => void;
};

export const useSoundPrefs = create<PrefsState>((set, get) => ({
  ...loadPrefs(),
  setVolume: (v) => {
    set({ volume: v });
    setSynthVolume(v);
    persist(get());
  },
  pick: (e, id) => {
    set({ picks: { ...get().picks, [e]: id } });
    persist(get());
  },
}));

function persist(s: SoundPrefs) {
  try { window.localStorage.setItem(PREFS_KEY, JSON.stringify({ volume: s.volume, picks: s.picks })); } catch {}
}

/* ── Playback ─────────────────────────────────────────────────────────── */

const audioCache = new Map<string, HTMLAudioElement>();
let longClip: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

function variantFor(e: SoundEvent, id?: string): SoundVariant | undefined {
  const list = SOUND_CATALOG[e];
  const want = id ?? useSoundPrefs.getState().picks[e];
  return list.find((v) => v.id === want) ?? list.find((v) => v.id === DEFAULT_SOUND_PICKS[e]) ?? list[0];
}

function playFile(v: SoundVariant, volume: number) {
  if (typeof window === 'undefined' || !v.file) return;
  if (v.long) {
    stopLongClip(0);
    const a = new Audio(v.file);
    a.volume = volume;
    longClip = a;
    a.play().catch(() => {});
    return;
  }
  // Short clips: clone a cached element so rapid repeats overlap cleanly.
  let base = audioCache.get(v.file);
  if (!base) {
    base = new Audio(v.file);
    base.preload = 'auto';
    audioCache.set(v.file, base);
  }
  const a = base.cloneNode(true) as HTMLAudioElement;
  a.volume = volume;
  a.play().catch(() => {});
}

/**
 * Play the sound for an event. Respects the global Sound toggle unless
 * `force` is set (Settings previews). `variant` overrides the pick.
 */
export function sfx(e: SoundEvent, opts: { variant?: string; force?: boolean; delay?: number } = {}) {
  if (!opts.force && !useAppStore.getState().settings.soundEnabled) return;
  const { volume } = useSoundPrefs.getState();
  if (volume <= 0) return;
  const v = variantFor(e, opts.variant);
  if (!v) return;
  if (v.file) {
    if (opts.delay) setTimeout(() => playFile(v, volume), opts.delay * 1000);
    else playFile(v, volume);
  } else {
    setSynthVolume(volume);
    synth(`${e}_${v.id}`, opts.delay ?? 0);
  }
}

/** Fade out (or cut) whatever long clip is playing — rank-down music etc. */
export function stopLongClip(fadeMs = 600) {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  const a = longClip;
  if (!a) return;
  longClip = null;
  if (fadeMs <= 0) { a.pause(); return; }
  const start = a.volume;
  const steps = 12;
  let i = 0;
  fadeTimer = setInterval(() => {
    i++;
    a.volume = Math.max(0, start * (1 - i / steps));
    if (i >= steps) { a.pause(); if (fadeTimer) clearInterval(fadeTimer); fadeTimer = null; }
  }, fadeMs / steps);
}

/* ── Back-compat for older call sites ─────────────────────────────────── */

export type SoundPack = string;
export type SoundKind = 'move' | 'capture' | 'correct' | 'fail';

export function playSound(pack: SoundPack | undefined, kind: SoundKind) {
  if (pack === 'mute') return;
  sfx(kind === 'fail' ? 'mistake' : kind);
}

/** Pick the right board sound for a chess.js move. */
export function moveSoundEvent(m: { san?: string; flags?: string; captured?: unknown; promotion?: unknown } | null | undefined): SoundEvent {
  if (!m) return 'move';
  const flags = m.flags ?? '';
  if (m.promotion || flags.includes('p')) return 'promote';
  if (flags.includes('k') || flags.includes('q')) return 'castle';
  if (m.san && /[+#]/.test(m.san)) return 'check';
  if (m.captured) return 'capture';
  return 'move';
}

'use client';

import { create } from 'zustand';
import { synth, setSynthVolume, audioOut } from './sound/engine';
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

let longClip: HTMLAudioElement | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;

function variantFor(e: SoundEvent, id?: string): SoundVariant | undefined {
  const list = SOUND_CATALOG[e];
  const want = id ?? useSoundPrefs.getState().picks[e];
  return list.find((v) => v.id === want) ?? list.find((v) => v.id === DEFAULT_SOUND_PICKS[e]) ?? list[0];
}

/* Short clips are decoded once and played through the synth's Web Audio
   graph: sample-accurate start (an <audio> element adds tens of ms of
   jitter), and the volume slider also works on iOS, where
   HTMLMediaElement.volume is read-only.

   The source files carry up to ~290ms of leading silence, which made a
   move's sound land after the opponent's reply. Each clip is scanned on
   decode and played from its first audible sample. Board / feedback
   clips are also levelled to one loudness — the "correct" sting was
   mastered ~19dB hotter than the move clicks. Rank ceremony clips keep
   their own mastering. */

type Clip = { buffer: AudioBuffer; offset: number; gain: number };

const clipCache = new Map<string, Promise<Clip | null>>();
const LEVELLED = new Set<SoundEvent>(['move', 'capture', 'check', 'castle', 'promote', 'correct']);
const ONSET_THRESHOLD = 0.01;          // -40 dBFS
const PREROLL_S = 0.003;               // keep the attack transient intact
const LEVEL_WINDOW_S = 0.1;            // loudness measured over the first 100ms of sound
const TARGET_RMS = 10 ** (-29 / 20);   // where the move / capture / check clicks already sit
const MAX_BOOST = 2;

function analyse(buffer: AudioBuffer, level: boolean): Clip {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  let first = buffer.length;
  for (const d of channels) {
    for (let i = 0; i < first; i++) {
      if (Math.abs(d[i]) > ONSET_THRESHOLD) { first = i; break; }
    }
  }
  if (first === buffer.length) first = 0;
  let gain = 1;
  if (level) {
    const end = Math.min(buffer.length, first + Math.round(LEVEL_WINDOW_S * buffer.sampleRate));
    let sum = 0;
    for (const d of channels) for (let i = first; i < end; i++) sum += d[i] * d[i];
    const rms = Math.sqrt(sum / Math.max(1, (end - first) * channels.length));
    if (rms > 0) gain = Math.min(MAX_BOOST, TARGET_RMS / rms);
  }
  return { buffer, offset: Math.max(0, first / buffer.sampleRate - PREROLL_S), gain };
}

function loadClip(file: string, level: boolean): Promise<Clip | null> {
  let p = clipCache.get(file);
  if (!p) {
    const g = audioOut();
    if (!g) return Promise.resolve(null);
    p = fetch(file)
      .then((r) => r.arrayBuffer())
      .then((b) => g.ctx.decodeAudioData(b))
      .then((buf) => analyse(buf, level))
      .catch(() => null);
    clipCache.set(file, p);
  }
  return p;
}

/** Decode every short clip up front so the first move doesn't wait on a fetch. */
function preloadClips() {
  for (const e of Object.keys(SOUND_CATALOG) as SoundEvent[]) {
    const v = variantFor(e);
    if (v?.file && !v.long) void loadClip(v.file, LEVELLED.has(e));
  }
}

// The AudioContext can only start inside a user gesture; the first
// pointerdown (e.g. picking up a piece) is early enough to have the
// clips decoded by the time the move lands.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', preloadClips, { once: true, capture: true });
}

function playFile(e: SoundEvent, v: SoundVariant, volume: number, delay: number) {
  if (typeof window === 'undefined' || !v.file) return;
  if (v.long) {
    stopLongClip(0);
    const a = new Audio(v.file);
    a.volume = volume;
    longClip = a;
    if (delay) setTimeout(() => { a.play().catch(() => {}); }, delay * 1000);
    else a.play().catch(() => {});
    return;
  }
  const g = audioOut();
  if (!g) return;
  setSynthVolume(volume);
  const when = g.ctx.currentTime + 0.01 + delay;
  void loadClip(v.file, LEVELLED.has(e)).then((clip) => {
    if (!clip) return;
    const src = g.ctx.createBufferSource();
    src.buffer = clip.buffer;
    const amp = g.ctx.createGain();
    amp.gain.value = clip.gain;
    src.connect(amp);
    amp.connect(g.out);
    src.start(Math.max(when, g.ctx.currentTime), clip.offset);
  });
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
    playFile(e, v, volume, opts.delay ?? 0);
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

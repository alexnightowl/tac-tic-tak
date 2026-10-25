import {
  MASTER_GAIN_SCALE,
  SOUND_CATALOG,
  SOUND_EVENT_ORDER,
  clipKey,
  variantFor,
  type SoundEvent,
} from '@tac/core/feel';
import { AppState, type AppStateStatus } from 'react-native';
import {
  AudioContext,
  AudioManager,
  type AudioBuffer,
  type AudioBufferSourceNode,
  type GainNode,
} from 'react-native-audio-api';

import { CLIP_ASSETS, PREMASTERED } from './clips';
import { feelStats, markPlayed, markRequested, recordError, recordLatency } from './latency';
import { getFeelPrefs, subscribeFeelPrefs } from './prefs';

// Sound engine (PLAN §2.8) on react-native-audio-api: ONE AudioContext,
// every short clip decoded once into an AudioBuffer, each play a fresh
// AudioBufferSourceNode into a master gain. Sources are cheap and the native
// graph frees finished ones that JS no longer holds, so plays overlap freely.
// Port of the web's lib/sound.ts facade: sfx / stopLongClip / preloadSounds.

export type SfxOptions = {
  /** Variant id override (Settings previews). */
  variant?: string;
  /** Play even with sound off (Settings previews). */
  force?: boolean;
  /** Seconds from now, on the audio clock. */
  delay?: number;
};

type Engine = {
  ctx: AudioContext;
  /** volume × 0.9: the web's master stage, for every bundled clip. */
  master: GainNode;
  /** volume: the synth renders already have the 0.9 baked in. */
  plain: GainNode;
};

let engine: Engine | null = null;
let engineFailed = false;
const buffers = new Map<string, AudioBuffer>();
const loading = new Map<string, Promise<AudioBuffer | null>>();
let longClip: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
// Bumped by stopLongClip and by every long-clip request: a long clip still
// decoding when its screen closed (or the app went to the background), or
// superseded by a newer request, must not start once its decode lands.
let longGen = 0;
let preloadPromise: Promise<void> | null = null;

function applyVolume(): void {
  if (!engine) return;
  const v = getFeelPrefs().volume;
  engine.master.gain.value = v * MASTER_GAIN_SCALE;
  engine.plain.gain.value = v;
}

function onAppState(state: AppStateStatus): void {
  const e = engine;
  if (!e) return;
  if (state === 'background') {
    // Long music never outlives the screen; a suspended context costs no CPU.
    stopLongClip(0);
    e.ctx.suspend().then(
      () => void (feelStats.suspends += 1),
      (err) => recordError('suspend', err),
    );
  } else if (state === 'active') {
    e.ctx.resume().then(
      () => void (feelStats.resumes += 1),
      (err) => recordError('resume', err),
    );
  }
}

// Fast Refresh re-runs this module; keep one native context across reloads
// (dev only) instead of leaking a new one per edit.
const hot = globalThis as { __tacFeelEngine?: Engine; __tacFeelAppState?: { remove(): void } };

function getEngine(): Engine | null {
  if (engine || engineFailed) return engine;
  if (hot.__tacFeelEngine) {
    engine = hot.__tacFeelEngine;
    hot.__tacFeelAppState?.remove();
    hot.__tacFeelAppState = AppState.addEventListener('change', onAppState);
    subscribeFeelPrefs(applyVolume);
    return engine;
  }
  try {
    // Before the context exists: the library's default session category is
    // Playback, which ignores the silent switch and stops the user's music.
    AudioManager.setAudioSessionOptions({
      iosCategory: 'ambient',
      iosMode: 'default',
      iosOptions: ['mixWithOthers'],
    });
    const t0 = performance.now();
    const ctx = new AudioContext();
    const master = ctx.createGain();
    const plain = ctx.createGain();
    master.connect(ctx.destination);
    plain.connect(ctx.destination);
    engine = { ctx, master, plain };
    hot.__tacFeelEngine = engine;
    feelStats.contextMs = performance.now() - t0;
    applyVolume();
    subscribeFeelPrefs(applyVolume);
    hot.__tacFeelAppState = AppState.addEventListener('change', onAppState);
    // The output driver starts lazily on the first start() and that blocked
    // the JS thread ~190 ms (sim, Debug): start it now, i.e. at preload, so
    // the first move click doesn't pay for it.
    const t1 = performance.now();
    ctx.resume().then(
      () => {
        feelStats.driverMs = performance.now() - t1;
        console.log(`[feel] AudioContext ${ctx.sampleRate} Hz ${ctx.state}; driver up in ${feelStats.driverMs.toFixed(0)} ms`);
      },
      (err) => recordError('driver', err),
    );
  } catch (err) {
    engineFailed = true;
    recordError('context', err);
  }
  return engine;
}

function loadClip(key: string): Promise<AudioBuffer | null> {
  const ready = buffers.get(key);
  if (ready) return Promise.resolve(ready);
  let p = loading.get(key);
  if (p) return p;
  const e = getEngine();
  const asset = CLIP_ASSETS[key];
  if (!e || asset == null) {
    if (asset == null) recordError('clip', `no asset for ${key}`);
    return Promise.resolve(null);
  }
  p = e.ctx
    .decodeAudioData(asset)
    .then((buf) => {
      buffers.set(key, buf);
      feelStats.decoded = buffers.size;
      return buf;
    })
    .catch((err) => {
      // Like the web: a failed decode stays failed for the session (silent).
      recordError(`decode ${key}`, err);
      return null;
    });
  loading.set(key, p);
  return p;
}

/**
 * Decode every short clip (all variants, not just current picks: pickers
 * preview instantly). Long music is decoded on first play. Idempotent; call
 * it from the splash gate.
 */
export function preloadSounds(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const t0 = performance.now();
  const keys: string[] = [];
  for (const ev of SOUND_EVENT_ORDER) {
    for (const v of SOUND_CATALOG[ev]) if (!v.long) keys.push(clipKey(ev, v));
  }
  preloadPromise = Promise.all(keys.map(loadClip)).then(() => {
    feelStats.preloadMs = performance.now() - t0;
    console.log(`[feel] preloaded ${buffers.size}/${keys.length} clips in ${feelStats.preloadMs.toFixed(0)} ms`);
  });
  return preloadPromise;
}

function start(e: Engine, key: string, buf: AudioBuffer, long: boolean, delay: number): void {
  const { ctx } = e;
  // After an interruption iOS may leave the context suspended; start() would
  // then queue silently, so nudge it (no-op when running).
  if (ctx.state === 'suspended' && AppState.currentState === 'active') {
    ctx.resume().catch((err) => recordError('resume', err));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const out = PREMASTERED.has(key) ? e.plain : e.master;
  if (long) {
    fadeLongClip(0); // one long clip at a time (web rule)
    const gain = ctx.createGain();
    src.connect(gain);
    gain.connect(out);
    const clip = { src, gain };
    longClip = clip;
    src.onEnded = () => {
      if (longClip === clip) longClip = null;
    };
  } else {
    src.connect(out);
  }
  // 0 = the next render quantum; the web's +10 ms lookahead only added lag.
  src.start(delay > 0 ? ctx.currentTime + delay : 0);
}

/**
 * Play a catalogue sound. `t0` (performance.now() of the trigger) feeds the
 * scheduling-latency log; feel.emit passes its own entry time.
 */
export function sfx(e: SoundEvent, opts: SfxOptions = {}, t0: number = performance.now()): void {
  const prefs = getFeelPrefs();
  if (!opts.force && !prefs.soundEnabled) return;
  if (prefs.volume <= 0) return;
  markRequested();
  const v = variantFor(e, prefs.picks, opts.variant);
  if (!v) return;
  const key = clipKey(e, v);
  const eng = getEngine();
  if (!eng) return;
  const delay = Math.max(0, opts.delay ?? 0);
  const gen = v.long ? ++longGen : longGen;
  const buf = buffers.get(key);
  try {
    if (buf) {
      start(eng, key, buf, !!v.long, delay);
      recordLatency(e, t0);
      return;
    }
  } catch (err) {
    recordError(`play ${key}`, err);
    return;
  }
  // Not decoded yet (cold start before the preload finished, or long music):
  // start late rather than skip, as the web did.
  if (!v.long) void preloadSounds();
  loadClip(key).then((b) => {
    if (!b || (v.long && gen !== longGen)) return;
    try {
      start(eng, key, b, !!v.long, delay);
      feelStats.lateStarts += 1;
      markPlayed(e);
    } catch (err) {
      recordError(`play ${key}`, err);
    }
  });
}

/** Fade out and stop the current long clip (sample-accurate ramp, no JS timers). */
export function stopLongClip(fadeMs = 600): void {
  longGen += 1;
  fadeLongClip(fadeMs);
}

function fadeLongClip(fadeMs: number): void {
  const clip = longClip;
  const e = engine;
  longClip = null;
  if (!clip || !e) return;
  try {
    const now = e.ctx.currentTime;
    if (fadeMs <= 0) {
      clip.src.stop(0);
      return;
    }
    const end = now + fadeMs / 1000;
    const g = clip.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, end);
    clip.src.stop(end);
  } catch (err) {
    recordError('stopLongClip', err);
  }
}

/** Dev readouts. */
export function audioState(): { state: string; sampleRate: number; time: number } {
  const e = engine;
  if (!e) return { state: engineFailed ? 'failed' : 'none', sampleRate: 0, time: 0 };
  return { state: e.ctx.state, sampleRate: e.ctx.sampleRate, time: e.ctx.currentTime };
}

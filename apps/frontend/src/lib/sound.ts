'use client';

/**
 * Sound playback. The 'native' pack synthesises minimalist tactile
 * tones via WebAudio so the trainer doesn't sound like Lichess. The
 * remaining packs proxy to Lichess's CDN and are kept for users who
 * prefer the familiar set.
 */

export type SoundPack = 'native' | 'wood' | 'metal' | 'piano' | 'nes' | 'robot' | 'futuristic' | 'mute';
export type SoundKind = 'move' | 'capture' | 'correct' | 'fail';

/** Lichess theme names — used by every pack except 'native'/'mute'. */
const THEMES: Record<Exclude<SoundPack, 'mute' | 'native'>, string> = {
  wood: 'standard',
  metal: 'sfx',
  piano: 'piano',
  nes: 'nes',
  robot: 'robot',
  futuristic: 'futuristic',
};

const FILE_BY_KIND: Record<SoundKind, string> = {
  move: 'Move',
  capture: 'Capture',
  correct: 'GenericNotify',
  fail: 'Error',
};

function url(pack: Exclude<SoundPack, 'mute' | 'native'>, kind: SoundKind) {
  return `https://lichess1.org/assets/sound/${THEMES[pack]}/${FILE_BY_KIND[kind]}.mp3`;
}

const cache = new Map<string, HTMLAudioElement>();

function getAudio(pack: SoundPack, kind: SoundKind): HTMLAudioElement | null {
  if (pack === 'mute' || pack === 'native' || typeof window === 'undefined') return null;
  const u = url(pack, kind);
  let a = cache.get(u);
  if (!a) {
    a = new Audio(u);
    a.preload = 'auto';
    a.volume = 0.6;
    cache.set(u, a);
  }
  return a;
}

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const C = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!C) return null;
    audioCtx = new C();
  }
  // Browsers suspend the context until a user gesture; resume() is a
  // no-op when already running and silently rejects when the user
  // hasn't interacted yet — we just don't make sound in that case.
  if (audioCtx.state === 'suspended') void audioCtx.resume().catch(() => {});
  return audioCtx;
}

/** One enveloped tone — sine for melodic, square for percussive. */
function tone(
  ac: AudioContext,
  startAt: number,
  freq: number,
  durationMs: number,
  type: OscillatorType,
  peakGain: number,
) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, startAt);
  const dur = durationMs / 1000;
  // Fast attack, exponential decay — keeps each tone tactile rather
  // than bell-like.
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(peakGain, startAt + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  o.connect(g).connect(ac.destination);
  o.start(startAt);
  o.stop(startAt + dur + 0.02);
}

function playNative(kind: SoundKind) {
  const ac = ctx();
  if (!ac) return;
  const t0 = ac.currentTime;
  switch (kind) {
    case 'correct':
      // Two-note ascending — E5 → A5, sine, soft and bright.
      tone(ac, t0,        659.25, 110, 'sine', 0.22);
      tone(ac, t0 + 0.07, 880.00, 160, 'sine', 0.22);
      break;
    case 'fail':
      // Damped low tap — A3 square through fast decay reads as "no".
      tone(ac, t0, 220.00, 220, 'square', 0.16);
      tone(ac, t0, 110.00, 240, 'sine',   0.10);
      break;
    case 'move':
      tone(ac, t0, 880, 35, 'square', 0.10);
      break;
    case 'capture':
      tone(ac, t0,        1100, 30, 'square', 0.12);
      tone(ac, t0 + 0.04,  700, 45, 'square', 0.10);
      break;
  }
}

export function playSound(pack: SoundPack, kind: SoundKind) {
  if (pack === 'mute') return;
  if (pack === 'native') return playNative(kind);
  const a = getAudio(pack, kind);
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

export const SOUND_PACK_KEYS: SoundPack[] = ['native', 'wood', 'metal', 'piano', 'nes', 'robot', 'futuristic', 'mute'];

export const SOUND_PACK_LABELS: Record<SoundPack, string> = {
  native: 'Native',
  wood: 'Wood',
  metal: 'Metal',
  piano: 'Piano',
  nes: 'Retro',
  robot: 'Robot',
  futuristic: 'Futuristic',
  mute: 'Mute',
};

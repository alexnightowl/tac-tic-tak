'use client';

/**
 * Sound playback using real audio assets from Lichess's public CDN.
 *
 * Packs map to Lichess's built-in themes. Files are preloaded on first
 * interaction and cached in-memory for instant replay.
 */

export type SoundPack = 'wood' | 'metal' | 'piano' | 'nes' | 'robot' | 'futuristic' | 'mute';
export type SoundKind = 'move' | 'capture' | 'correct' | 'fail';

/** Lichess theme names. */
const THEMES: Record<Exclude<SoundPack, 'mute'>, string> = {
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

function url(pack: Exclude<SoundPack, 'mute'>, kind: SoundKind) {
  return `https://lichess1.org/assets/sound/${THEMES[pack]}/${FILE_BY_KIND[kind]}.mp3`;
}

const cache = new Map<string, HTMLAudioElement>();

function getAudio(pack: SoundPack, kind: SoundKind): HTMLAudioElement | null {
  if (pack === 'mute' || typeof window === 'undefined') return null;
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

export function playSound(pack: SoundPack, kind: SoundKind) {
  const a = getAudio(pack, kind);
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

export const SOUND_PACK_KEYS: SoundPack[] = ['wood', 'metal', 'piano', 'nes', 'robot', 'futuristic', 'mute'];

export const SOUND_PACK_LABELS: Record<SoundPack, string> = {
  wood: 'Wood',
  metal: 'Metal',
  piano: 'Piano',
  nes: 'Retro',
  robot: 'Robot',
  futuristic: 'Futuristic',
  mute: 'Mute',
};

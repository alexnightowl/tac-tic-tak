'use client';

/**
 * Single sound set, no user-facing variants. Move + capture use the
 * Lichess wood (standard) pack — physical, tactile clicks. Correct +
 * fail use the Lichess piano pack — softer melodic notes for puzzle
 * feedback, so the solve/fail layer doesn't read as another piece
 * click. Files come from Lichess's CDN and are cached after first
 * play. `pack` is kept on the signature for backwards-compat with
 * existing call sites — it's ignored at runtime.
 */

export type SoundPack = 'default' | 'mute';
export type SoundKind = 'move' | 'capture' | 'correct' | 'fail';

const URL_BY_KIND: Record<SoundKind, string> = {
  move:    'https://lichess1.org/assets/sound/standard/Move.mp3',
  capture: 'https://lichess1.org/assets/sound/standard/Capture.mp3',
  correct: 'https://lichess1.org/assets/sound/piano/GenericNotify.mp3',
  fail:    'https://lichess1.org/assets/sound/piano/Error.mp3',
};

const cache = new Map<string, HTMLAudioElement>();
function getAudio(url: string): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  let a = cache.get(url);
  if (!a) {
    a = new Audio(url);
    a.preload = 'auto';
    a.volume = 0.6;
    cache.set(url, a);
  }
  return a;
}

export function playSound(pack: SoundPack | string | undefined, kind: SoundKind) {
  if (pack === 'mute') return;
  const a = getAudio(URL_BY_KIND[kind]);
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

'use client';

/**
 * One fixed sound set, no user choice. Move + capture use Lichess's
 * wood (standard) pack for the physical click. Correct + fail use
 * our own short stings shipped under /public/sounds — distinct
 * enough from anything Lichess uses that the trainer has its own
 * audio identity. `pack` is kept on the signature for back-compat
 * with existing call sites — only `'mute'` short-circuits.
 */

export type SoundPack = string;
export type SoundKind = 'move' | 'capture' | 'correct' | 'fail';

const URL_BY_KIND: Record<SoundKind, string> = {
  move:    'https://lichess1.org/assets/sound/standard/Move.mp3',
  capture: 'https://lichess1.org/assets/sound/standard/Capture.mp3',
  correct: '/sounds/correct.mp3',
  fail:    '/sounds/fail.mp3',
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

export function playSound(pack: SoundPack | undefined, kind: SoundKind) {
  if (pack === 'mute') return;
  const a = getAudio(URL_BY_KIND[kind]);
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

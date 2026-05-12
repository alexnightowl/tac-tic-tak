'use client';

/**
 * Move + capture are pinned to Lichess's wood (standard) pack — the
 * physical click feel that the player liked, so it's not user-pickable.
 * Correct + fail are independently selectable from the timbre list
 * below; the picker in Settings previews each option before committing.
 * Choices live in localStorage — backend doesn't track them because
 * they're cosmetic and rarely worth syncing across devices.
 */

export type SoundPack = string;
export type SoundKind = 'move' | 'capture' | 'correct' | 'fail';
export type SoundSlot = 'correct' | 'fail';

const MOVE_THEME = 'standard';

const FILE_BY_KIND: Record<SoundKind, string> = {
  move:    'Move',
  capture: 'Capture',
  correct: 'GenericNotify',
  fail:    'Error',
};

/** Lichess CDN themes available for the correct/fail picker. */
export const SOUND_THEMES: Array<{ id: string; label: string }> = [
  { id: 'standard',   label: 'Wood' },
  { id: 'sfx',        label: 'Metal' },
  { id: 'piano',      label: 'Piano' },
  { id: 'nes',        label: 'Retro' },
  { id: 'robot',      label: 'Robot' },
  { id: 'futuristic', label: 'Futuristic' },
];

const DEFAULTS: Record<SoundSlot, string> = {
  correct: 'piano',
  fail:    'piano',
};

const LS_KEY: Record<SoundSlot, string> = {
  correct: 'taktic.sound.correct',
  fail:    'taktic.sound.fail',
};

export function getSoundChoice(slot: SoundSlot): string {
  if (typeof window === 'undefined') return DEFAULTS[slot];
  try {
    const stored = window.localStorage.getItem(LS_KEY[slot]);
    if (stored && SOUND_THEMES.some((t) => t.id === stored)) return stored;
  } catch {}
  return DEFAULTS[slot];
}

export function setSoundChoice(slot: SoundSlot, themeId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY[slot], themeId);
  } catch {}
}

function urlFor(kind: SoundKind, themeId: string) {
  return `https://lichess1.org/assets/sound/${themeId}/${FILE_BY_KIND[kind]}.mp3`;
}

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

function themeForKind(kind: SoundKind): string {
  if (kind === 'move' || kind === 'capture') return MOVE_THEME;
  return getSoundChoice(kind);
}

export function playSound(pack: SoundPack | undefined, kind: SoundKind) {
  if (pack === 'mute') return;
  const a = getAudio(urlFor(kind, themeForKind(kind)));
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

/** Preview a sound without persisting the choice — used by the picker. */
export function previewSound(kind: SoundKind, themeId: string) {
  const a = getAudio(urlFor(kind, themeId));
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}

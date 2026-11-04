'use client';

import {
  FEEL_TABLE,
  moveSoundEvent,
  rankUpSound,
  type FeelEvent,
  type FeelSound,
  type SoundEvent,
} from '@tac/core/feel';

import { sfx } from '@/lib/sound';

// Core's feel events on the web (apps/mobile/src/feel/index.ts without the
// haptics): FEEL_TABLE picks the sound, the web's own engine (lib/sound.ts)
// plays it with the player's Sound toggle, volume and picked variants.

export type { FeelEvent };

/** Extra context some events need to resolve their sound (see FEEL_TABLE). */
export type FeelContext = {
  /** chess.js move for `byMove` sounds (drop / capture / check / castle / promote). */
  move?: { san?: string; flags?: string; captured?: unknown; promotion?: unknown } | null;
  /** Rank band for `byRank` (rankUp). */
  band?: string;
  /** Streak length (haptic only on the app; accepted for the same call shape). */
  streak?: number;
  /** Sound variant override and sound-off bypass, for Settings previews. */
  variant?: string;
  force?: boolean;
};

function resolveSound(sound: FeelSound, ctx?: FeelContext): SoundEvent {
  if (sound === 'byMove') return moveSoundEvent(ctx?.move);
  if (sound === 'byRank') return rankUpSound(ctx?.band ?? '');
  return sound;
}

/** The single choke point for feel on the web: sound only (no haptics on the web). */
export function emitFeel(event: FeelEvent, ctx?: FeelContext): void {
  const entry = FEEL_TABLE[event];
  if (!entry?.sound) return;
  sfx(resolveSound(entry.sound, ctx), { variant: ctx?.variant, force: ctx?.force });
}

/** Same shape as the app's `feel` object, so ported code reads alike. */
export const feel = { emit: emitFeel };

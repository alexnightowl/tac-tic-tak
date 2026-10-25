import {
  FEEL_TABLE,
  moveSoundEvent,
  rankUpSound,
  streakUpHaptic,
  type FeelEvent,
  type FeelSound,
  type SoundEvent,
} from '@tac/core/feel';

import { playHaptic } from './haptics';
import { hapticScaleFor } from './prefs';
import { sfx } from './sound';

export type { FeelEvent };

/** Extra context some events need to resolve their sound (see FEEL_TABLE). */
export type FeelContext = {
  /** chess.js move for `byMove` sounds (drop / capture / check / castle / promote). */
  move?: { san?: string; flags?: string; captured?: unknown; promotion?: unknown } | null;
  /** Rank band for `byRank` (rankUp). */
  band?: string;
  /** Streak length for streakUp's escalating haptic. */
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

// FEEL_TABLE marks these haptics "throttled" (FEEL.md): a fast drag across
// the board, or several achievements unlocking at once, must not buzz on
// every call. Haptic only; sound is never throttled. Provisional gaps, tune
// on a device and record in FEEL.md.
const HAPTIC_MIN_GAP_MS: Partial<Record<FeelEvent, number>> = {
  hoverLegal: 40,
  achievementToast: 1200,
};
const lastHapticAt: Partial<Record<FeelEvent, number>> = {};

function throttled(event: FeelEvent, now: number): boolean {
  const gap = HAPTIC_MIN_GAP_MS[event];
  if (gap === undefined) return false;
  const last = lastHapticAt[event];
  if (last !== undefined && now - last < gap) return true;
  lastHapticAt[event] = now;
  return false;
}

/**
 * The single choke point for sound + haptics (PLAN §2.8): looks the event up
 * in FEEL_TABLE and fires the sound, then step 0 of the haptic, in the same
 * JS task. Respects soundEnabled / volume / hapticsEnabled from the feel prefs.
 *
 * From a worklet (gesture callbacks, frame callbacks):
 *   scheduleOnRN(feel.emit, 'drop', { move })
 * `emit` is a plain function (no `this`), so passing it by reference is safe.
 */
function emit(event: FeelEvent, ctx?: FeelContext): void {
  const t0 = performance.now();
  const entry = FEEL_TABLE[event];
  if (!entry) return;
  if (entry.sound) {
    sfx(resolveSound(entry.sound, ctx), { variant: ctx?.variant, force: ctx?.force }, t0);
  }
  if (throttled(event, t0)) return;
  const haptic = event === 'streakUp' && ctx?.streak ? streakUpHaptic(ctx.streak) : entry.haptic;
  playHaptic(haptic, hapticScaleFor(event));
}

export const feel = { emit };

export { moveSoundEvent };
export { preloadSounds, sfx, stopLongClip, audioState, type SfxOptions } from './sound';
export {
  getFeelPrefs,
  setFeelPrefs,
  setHapticScale,
  hapticScaleFor,
  useFeelPrefs,
  type FeelPrefs,
} from './prefs';
export { feelStats, latencyLog, latencySummary, clearLatency, type LatencySummary } from './latency';

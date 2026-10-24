/**
 * Sound catalogue: every event the app makes a sound for, and the
 * variants a player can pick from in Settings → Sound. A variant is either
 * a synth recipe (see engine.ts, id `<event>_<variant>`) or an audio file
 * under /public/sounds/sfx.
 *
 * The catalogue is exactly what is left on the design canvas (Sound & motion
 * lab) after the 2026-10-25 pass: one sound per event, four to pick from
 * for rank-down. Picks saved under older ids fall back to these defaults.
 */

export type SoundEvent =
  | 'move' | 'capture' | 'check' | 'castle' | 'promote'
  | 'correct' | 'mistake' | 'gate'
  | 'rankTomoe' | 'rankMangekyo' | 'rankFinal' | 'rankDown';

export type SoundVariant = {
  id: string;
  /** English label; Ukrainian lives in i18n under `sound.v.<event>.<id>` when needed. */
  name: string;
  shinobi?: boolean;
  /** Public path of an audio file. Absent → synth recipe `${event}_${id}`. */
  file?: string;
  /** Long clips are faded out when the screen they belong to closes. */
  long?: boolean;
};

const F = (n: string) => `/sounds/sfx/${n}.mp3`;

export const SOUND_CATALOG: Record<SoundEvent, SoundVariant[]> = {
  move: [{ id: 'clip1', name: 'Clip #1', file: F('move-1') }],
  capture: [{ id: 'clip1', name: 'Clip #1', file: F('capture-1') }],
  check: [{ id: 'clip1', name: 'Clip #1', file: F('check-1') }],
  castle: [{ id: 'clip2', name: 'Castling — short', file: F('castle-2') }],
  promote: [{ id: 'clip1', name: 'Promotion', file: F('promote') }],
  correct: [{ id: 'clip5', name: 'Clip #5', file: F('correct-5') }],
  mistake: [{ id: 'thud', name: 'Muted thud' }],
  gate: [{ id: 'gongswell', name: 'Gong swell' }],
  rankTomoe: [{ id: 'clip1', name: 'Tomoe awakening', file: F('rank-tomoe') }],
  rankMangekyo: [{ id: 'clip1', name: 'Mangekyō awakening', file: F('rank-mangekyo') }],
  rankFinal: [{ id: 'clip1', name: 'Final awakening', file: F('rank-final') }],
  rankDown: [
    { id: 'a', name: 'Short clip', file: F('rank-down-a') },
    { id: 'b', name: 'Music', file: F('rank-down-b'), long: true },
    { id: 'c', name: 'Music II', file: F('rank-down-c'), long: true },
    { id: 'd', name: 'Clip', file: F('rank-down-d') },
  ],
};

export const DEFAULT_SOUND_PICKS: Record<SoundEvent, string> = {
  move: 'clip1',
  capture: 'clip1',
  check: 'clip1',
  castle: 'clip2',
  promote: 'clip1',
  correct: 'clip5',
  mistake: 'thud',
  gate: 'gongswell',
  rankTomoe: 'clip1',
  rankMangekyo: 'clip1',
  rankFinal: 'clip1',
  rankDown: 'a',
};

/** Events shown in Settings → Sound (single-option ones are listed but not pickable). */
export const SOUND_EVENT_ORDER: SoundEvent[] = [
  'move', 'capture', 'check', 'castle', 'promote', 'correct', 'mistake', 'gate',
  'rankTomoe', 'rankMangekyo', 'rankFinal', 'rankDown',
];

/**
 * Sound catalogue: every event the app makes a sound for, and the
 * variants a player can pick from in Settings → Sound. A variant is either
 * a synth recipe (see engine.ts, id `<event>_<variant>`) or an audio file
 * under /public/sounds/sfx.
 *
 * Defaults mirror the "Your set" picks on the design canvas
 * (Sound & motion lab).
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
  move: [
    { id: 'stone', name: 'Stone tap' },
    { id: 'wood', name: 'Wood click' },
    { id: 'felt', name: 'Felt thud' },
    { id: 'clay', name: 'Clay knock' },
    { id: 'kunai', name: 'Kunai clink', shinobi: true },
    { id: 'shuriken', name: 'Shuriken thunk', shinobi: true },
    { id: 'seal', name: 'Hand seal', shinobi: true },
    { id: 'tag', name: 'Paper tag', shinobi: true },
    { id: 'clip1', name: 'Clip #1', file: F('move-1') },
  ],
  capture: [
    { id: 'crack', name: 'Stone crack' },
    { id: 'heavy', name: 'Heavy drop' },
    { id: 'slide', name: 'Slide & take' },
    { id: 'snap', name: 'Snap' },
    { id: 'slash', name: 'Blade slash', shinobi: true },
    { id: 'poof', name: 'Smoke poof', shinobi: true },
    { id: 'crackle', name: 'Lightning snap', shinobi: true },
    { id: 'log', name: 'Substitution', shinobi: true },
    { id: 'clip1', name: 'Clip #1', file: F('capture-1') },
    { id: 'clip2', name: 'Clip #2', file: F('capture-2') },
  ],
  check: [
    { id: 'ping', name: 'Steel ping' },
    { id: 'double', name: 'Double knock' },
    { id: 'tick', name: 'Warning tick' },
    { id: 'kunaiwarn', name: 'Kunai warning', shinobi: true },
    { id: 'clip1', name: 'Clip #1', file: F('check-1') },
  ],
  castle: [{ id: 'clip1', name: 'Castling jump', file: F('castle') }],
  promote: [{ id: 'clip1', name: 'Promotion', file: F('promote') }],
  correct: [
    { id: 'bell', name: 'Temple bell' },
    { id: 'chime', name: 'Two-note chime' },
    { id: 'koto', name: 'Koto pluck' },
    { id: 'whoosh', name: 'Ember whoosh' },
    { id: 'shing', name: 'Eye awakens', shinobi: true },
    { id: 'spiral', name: 'Spiral sphere', shinobi: true },
    { id: 'flute', name: 'Shakuhachi', shinobi: true },
    { id: 'summon', name: 'Summoning', shinobi: true },
    { id: 'clip1', name: 'Clip #1', file: F('correct-1') },
    { id: 'clip2', name: 'Clip #2', file: F('correct-2') },
    { id: 'clip3', name: 'Clip #3', file: F('correct-3') },
    { id: 'clip4', name: 'Clip #4', file: F('correct-4') },
    { id: 'clip5', name: 'Clip #5', file: F('correct-5') },
  ],
  mistake: [
    { id: 'thud', name: 'Muted thud' },
    { id: 'gong', name: 'Low gong' },
    { id: 'minor', name: 'Minor second' },
    { id: 'buzz', name: 'Dull buzz' },
    { id: 'taiko', name: 'Taiko tap', shinobi: true },
    { id: 'parry', name: 'Blade parry', shinobi: true },
    { id: 'gust', name: 'Wind gust', shinobi: true },
    { id: 'broken', name: 'Broken seal', shinobi: true },
    { id: 'clip1', name: 'Clip #1', file: F('mistake-1') },
    { id: 'clip2', name: 'Clip #2', file: F('mistake-2') },
  ],
  gate: [
    { id: 'taiko', name: 'Taiko + bells' },
    { id: 'shamisen', name: 'Shamisen rise' },
    { id: 'pad', name: 'Warm swell' },
    { id: 'gongswell', name: 'Gong swell' },
    { id: 'chidori', name: 'Thousand birds', shinobi: true },
    { id: 'bigsummon', name: 'Grand summoning', shinobi: true },
    { id: 'awaken', name: 'Awakening', shinobi: true },
    { id: 'kage', name: 'Shadow of fire', shinobi: true },
    { id: 'clip1', name: 'Clip #1', file: F('gate-1'), long: true },
  ],
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
  move: 'stone',
  capture: 'crack',
  check: 'clip1',
  castle: 'clip1',
  promote: 'clip1',
  correct: 'bell',
  mistake: 'thud',
  gate: 'taiko',
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

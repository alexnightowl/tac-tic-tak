// Port of apps/frontend/src/lib/sound/catalog.ts. File URLs became asset
// KEYS (`move-1` ↔ web /sounds/sfx/move-1.mp3); apps/mobile maps each key
// to a bundled require(). Synth-only variants keep their recipe id, which is
// also the key of the clip pre-rendered from engine.ts (PLAN §2.8).

export type SoundEvent =
  | 'move' | 'capture' | 'check' | 'castle' | 'promote'
  | 'correct' | 'mistake' | 'gate'
  | 'rankTomoe' | 'rankMangekyo' | 'rankFinal' | 'rankDown';

export type SoundVariant = {
  id: string;
  /** English label; variant names are not localised on the web either. */
  name: string;
  shinobi?: boolean;
  /** Bundled clip key. Absent → synth recipe `${event}_${id}`. */
  asset?: string;
  /** Long clips are faded out when the screen they belong to closes. */
  long?: boolean;
};

export const SOUND_CATALOG: Record<SoundEvent, SoundVariant[]> = {
  move: [{ id: 'clip1', name: 'Clip #1', asset: 'move-1' }],
  capture: [{ id: 'clip1', name: 'Clip #1', asset: 'capture-1' }],
  check: [{ id: 'clip1', name: 'Clip #1', asset: 'check-1' }],
  castle: [{ id: 'clip2', name: 'Castling — short', asset: 'castle-2' }],
  promote: [{ id: 'clip1', name: 'Promotion', asset: 'promote' }],
  correct: [{ id: 'clip5', name: 'Clip #5', asset: 'correct-5' }],
  mistake: [{ id: 'thud', name: 'Muted thud' }],
  gate: [{ id: 'gongswell', name: 'Gong swell' }],
  rankTomoe: [{ id: 'clip1', name: 'Tomoe awakening', asset: 'rank-tomoe' }],
  rankMangekyo: [{ id: 'clip1', name: 'Mangekyō awakening', asset: 'rank-mangekyo' }],
  rankFinal: [{ id: 'clip1', name: 'Final awakening', asset: 'rank-final' }],
  rankDown: [
    { id: 'a', name: 'Short clip', asset: 'rank-down-a' },
    { id: 'b', name: 'Music', asset: 'rank-down-b', long: true },
    { id: 'c', name: 'Music II', asset: 'rank-down-c', long: true },
    { id: 'd', name: 'Clip', asset: 'rank-down-d' },
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

/** Board / feedback clips levelled to one loudness; rank clips keep their mastering. */
export const LEVELLED: ReadonlySet<SoundEvent> = new Set<SoundEvent>([
  'move', 'capture', 'check', 'castle', 'promote', 'correct',
]);

/** Offline trim/level parameters (lib/sound.ts analyse); used by tools/audio. */
export const CLIP_ANALYSIS = {
  onsetThreshold: 0.01, // -40 dBFS
  prerollS: 0.003, // keep the attack transient intact
  levelWindowS: 0.1, // loudness over the first 100ms of sound
  targetRms: 10 ** (-29 / 20), // where the move / capture / check clicks sit
  maxBoost: 2,
} as const;

/** Per-device prefs (web localStorage key, kept for the MMKV store). */
export const SOUND_PREFS_KEY = 'taktic.soundPrefs';
export const DEFAULT_SOUND_VOLUME = 0.7;
/** The synth master gain ran at volume * 0.9; clips go through the same gain. */
export const MASTER_GAIN_SCALE = 0.9;

/** Requested id → default id → first variant (picks saved under old ids fall back). */
export function variantFor(
  e: SoundEvent,
  picks: Partial<Record<SoundEvent, string>> = DEFAULT_SOUND_PICKS,
  id?: string,
): SoundVariant | undefined {
  const list = SOUND_CATALOG[e];
  const want = id ?? picks[e];
  return list.find((v) => v.id === want) ?? list.find((v) => v.id === DEFAULT_SOUND_PICKS[e]) ?? list[0];
}

/** The clip key a variant plays: its asset, or the pre-rendered synth recipe. */
export function clipKey(e: SoundEvent, v: SoundVariant): string {
  return v.asset ?? `${e}_${v.id}`;
}

/** Every clip key the app can play, for preloading at splash. */
export function allClipKeys(): string[] {
  const keys: string[] = [];
  for (const e of SOUND_EVENT_ORDER) for (const v of SOUND_CATALOG[e]) keys.push(clipKey(e, v));
  return keys;
}

/** Back-compat SoundKind from lib/sound.ts playSound ('fail' → 'mistake'). */
export type SoundKind = 'move' | 'capture' | 'correct' | 'fail';
export function soundKindToEvent(kind: SoundKind): SoundEvent {
  return kind === 'fail' ? 'mistake' : kind;
}

/** Pick the right board sound for a chess.js move (lib/sound.ts, verbatim). */
export function moveSoundEvent(m: { san?: string; flags?: string; captured?: unknown; promotion?: unknown } | null | undefined): SoundEvent {
  if (!m) return 'move';
  const flags = m.flags ?? '';
  if (m.promotion || flags.includes('p')) return 'promote';
  if (flags.includes('k') || flags.includes('q')) return 'castle';
  if (m.san && /[+#]/.test(m.san)) return 'check';
  if (m.captured) return 'capture';
  return 'move';
}

/** RankCeremony clip choice: expert → final, advanced → Mangekyō, else tomoe. */
export function rankUpSound(to: string): SoundEvent {
  return to === 'expert' ? 'rankFinal' : to === 'advanced' ? 'rankMangekyo' : 'rankTomoe';
}

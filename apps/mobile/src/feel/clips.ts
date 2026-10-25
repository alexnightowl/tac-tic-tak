// Clip key (SOUND_CATALOG / clipKey in @tac/core/feel) → bundled asset.
// Metro needs static require()s, hence the literal table. Files are the
// tools/audio outputs: trimmed to a 3 ms pre-roll and levelled offline, so
// every clip plays from sample 0 at gain 1 (tools/README.md § Audio).

export const CLIP_ASSETS: Record<string, number> = {
  'move-1': require('../../assets/sfx/move-1.wav'),
  'capture-1': require('../../assets/sfx/capture-1.wav'),
  'check-1': require('../../assets/sfx/check-1.wav'),
  'castle-2': require('../../assets/sfx/castle-2.wav'),
  promote: require('../../assets/sfx/promote.wav'),
  'correct-5': require('../../assets/sfx/correct-5.wav'),
  // Synth recipes pre-rendered by render-synth.mjs (keys = `${event}_${id}`).
  mistake_thud: require('../../assets/sfx/mistake-thud.wav'),
  gate_gongswell: require('../../assets/sfx/gate-gongswell.wav'),
  'rank-tomoe': require('../../assets/sfx/rank-tomoe.m4a'),
  'rank-mangekyo': require('../../assets/sfx/rank-mangekyo.m4a'),
  'rank-final': require('../../assets/sfx/rank-final.m4a'),
  'rank-down-a': require('../../assets/sfx/rank-down-a.m4a'),
  'rank-down-b': require('../../assets/sfx/rank-down-b.m4a'),
  'rank-down-c': require('../../assets/sfx/rank-down-c.m4a'),
  'rank-down-d': require('../../assets/sfx/rank-down-d.m4a'),
};

/**
 * The synth renders already carry the web's 0.9 master gain, so they go
 * through a master of plain `volume`; everything else gets `volume * 0.9`
 * (tools/README.md § Audio → Volume).
 */
export const PREMASTERED: ReadonlySet<string> = new Set(['mistake_thud', 'gate_gongswell']);

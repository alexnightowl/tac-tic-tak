'use client';

/**
 * WebAudio-based SFX with multiple presets. No external assets — tones are
 * synthesised on demand, which keeps the bundle small while still feeling
 * varied across packs.
 */
let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

type Tone = { freq: number; dur: number; type?: OscillatorType; gain?: number; delay?: number };

function play(tones: Tone[]) {
  const c = getCtx();
  if (!c) return;
  for (const t of tones) {
    const start = c.currentTime + (t.delay ?? 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = t.type ?? 'sine';
    osc.frequency.value = t.freq;
    g.gain.value = t.gain ?? 0.18;
    osc.connect(g);
    g.connect(c.destination);
    osc.start(start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
    osc.stop(start + t.dur);
  }
}

export type SoundPack = 'classic' | 'soft' | 'woody' | 'bell' | 'arcade' | 'mute';

type Pack = {
  move: Tone[];
  capture: Tone[];
  correct: Tone[];
  fail: Tone[];
};

const PACKS: Record<SoundPack, Pack> = {
  classic: {
    move: [{ freq: 440, dur: 0.08, type: 'triangle', gain: 0.2 }],
    capture: [{ freq: 260, dur: 0.12, type: 'sawtooth', gain: 0.18 }],
    correct: [{ freq: 660, dur: 0.12 }, { freq: 880, dur: 0.12, delay: 0.09 }],
    fail: [{ freq: 220, dur: 0.2, type: 'square', gain: 0.15 }],
  },
  soft: {
    move: [{ freq: 520, dur: 0.09, type: 'sine', gain: 0.14 }],
    capture: [{ freq: 320, dur: 0.14, type: 'sine', gain: 0.14 }],
    correct: [{ freq: 700, dur: 0.14, type: 'sine' }, { freq: 990, dur: 0.14, type: 'sine', delay: 0.1 }],
    fail: [{ freq: 200, dur: 0.25, type: 'sine', gain: 0.14 }],
  },
  woody: {
    move: [{ freq: 380, dur: 0.07, type: 'sawtooth', gain: 0.12 }, { freq: 300, dur: 0.07, type: 'sine', gain: 0.1, delay: 0.02 }],
    capture: [{ freq: 210, dur: 0.14, type: 'sawtooth', gain: 0.15 }, { freq: 140, dur: 0.12, type: 'square', gain: 0.08, delay: 0.04 }],
    correct: [{ freq: 600, dur: 0.1, type: 'triangle' }, { freq: 800, dur: 0.12, type: 'triangle', delay: 0.08 }],
    fail: [{ freq: 180, dur: 0.22, type: 'sawtooth', gain: 0.16 }],
  },
  bell: {
    move: [{ freq: 880, dur: 0.12, type: 'sine', gain: 0.1 }, { freq: 1320, dur: 0.1, type: 'sine', gain: 0.06, delay: 0.02 }],
    capture: [{ freq: 440, dur: 0.18, type: 'sine', gain: 0.14 }, { freq: 660, dur: 0.14, type: 'sine', gain: 0.08, delay: 0.05 }],
    correct: [{ freq: 660, dur: 0.14, type: 'sine' }, { freq: 990, dur: 0.14, type: 'sine', delay: 0.11 }, { freq: 1320, dur: 0.16, type: 'sine', delay: 0.22 }],
    fail: [{ freq: 330, dur: 0.3, type: 'sine', gain: 0.1 }],
  },
  arcade: {
    move: [{ freq: 660, dur: 0.06, type: 'square', gain: 0.12 }],
    capture: [{ freq: 440, dur: 0.08, type: 'square', gain: 0.14 }, { freq: 220, dur: 0.08, type: 'square', gain: 0.1, delay: 0.05 }],
    correct: [{ freq: 660, dur: 0.1, type: 'square' }, { freq: 990, dur: 0.1, type: 'square', delay: 0.08 }, { freq: 1320, dur: 0.12, type: 'square', delay: 0.16 }],
    fail: [{ freq: 165, dur: 0.18, type: 'square', gain: 0.14 }, { freq: 110, dur: 0.2, type: 'square', gain: 0.12, delay: 0.12 }],
  },
  mute: { move: [], capture: [], correct: [], fail: [] },
};

export const SOUND_PACK_KEYS: SoundPack[] = ['classic', 'soft', 'woody', 'bell', 'arcade', 'mute'];

export function playSound(pack: SoundPack, kind: 'move' | 'capture' | 'correct' | 'fail') {
  play(PACKS[pack]?.[kind] ?? PACKS.classic[kind]);
}

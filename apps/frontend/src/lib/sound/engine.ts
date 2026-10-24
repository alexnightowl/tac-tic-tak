'use client';

/**
 * Tiny Web Audio synth used for the app's sound effects. Every sound is
 * generated live (no audio files), so a "sound pack" is just a recipe.
 * Ported 1:1 from the design canvas "Sound & motion lab".
 */

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noise: AudioBuffer | null = null;
let volume = 0.7;

export function setSynthVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (out) out.gain.value = volume * 0.9;
}

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    out = ctx.createGain();
    out.gain.value = volume * 0.9;
    out.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Shared context + master gain, so sample clips mix through the same
 *  volume stage (and clock) as the synth recipes. */
export function audioOut(): { ctx: AudioContext; out: GainNode } | null {
  const c = ac();
  return c && out ? { ctx: c, out } : null;
}

function noiseBuf(c: AudioContext) {
  if (!noise) {
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = b;
  }
  return noise;
}

function tone(type: OscillatorType, f0: number, t: number, dur: number, peak: number, f1?: number | null, attack?: number) {
  const c = ac(); if (!c || !out) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const a = attack || 0.004;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}

function nz(t: number, dur: number, ftype: BiquadFilterType, f0: number, q: number, peak: number, f1?: number | null, attack?: number) {
  const c = ac(); if (!c || !out) return;
  const s = c.createBufferSource(); s.buffer = noiseBuf(c);
  const bq = c.createBiquadFilter(); bq.type = ftype; bq.frequency.setValueAtTime(f0, t); if (f1) bq.frequency.exponentialRampToValueAtTime(f1, t + dur); bq.Q.value = q;
  const g = c.createGain(); const a = attack || 0.002;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bq); bq.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

function bell(f: number, t: number, dur: number, amp: number) {
  ([[1, 1], [2.76, 0.32], [5.4, 0.12], [8.93, 0.05]] as const).forEach(([r, a], i) => tone('sine', f * r, t, dur / (1 + i * 0.6), amp * a));
}
function metal(f: number, t: number, dur: number, amp: number) {
  ([[1, 1], [2.32, 0.6], [4.25, 0.35], [6.63, 0.2], [9.38, 0.1]] as const).forEach(([r, a], i) => tone('sine', f * r, t, dur / (1 + i * 0.5), amp * a));
}
function pluck(f: number, t: number, dur: number, amp: number) {
  const c = ac(); if (!c || !out) return;
  const o = c.createOscillator(); const lp = c.createBiquadFilter(); const g = c.createGain();
  o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function crackle(t: number, dur: number, n: number, amp: number, f?: number) {
  for (let i = 0; i < n; i++) { const tt = t + Math.pow(Math.random(), 0.8) * dur; nz(tt, 0.008 + Math.random() * 0.02, 'highpass', f || 2500, 0.7, amp * (0.4 + Math.random() * 0.6)); }
}
function poof(t: number, size: number) { nz(t, 0.35 * size, 'lowpass', 1800, 0.5, 0.55, 300, 0.03); nz(t, 0.18 * size, 'bandpass', 900, 0.8, 0.25, 400, 0.01); }
function whirl(t: number, dur: number, amp: number) {
  const c = ac(); if (!c || !out) return;
  const s = c.createBufferSource(); s.buffer = noiseBuf(c); s.loop = true;
  const bq = c.createBiquadFilter(); bq.type = 'bandpass'; bq.Q.value = 6; bq.frequency.setValueAtTime(500, t); bq.frequency.exponentialRampToValueAtTime(2400, t + dur);
  const lfo = c.createOscillator(); const lg = c.createGain(); lfo.frequency.setValueAtTime(6, t); lfo.frequency.linearRampToValueAtTime(22, t + dur); lg.gain.value = 400; lfo.connect(lg); lg.connect(bq.frequency);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  s.connect(bq); bq.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
}
function flute(f: number, t: number, dur: number, amp: number) {
  const c = ac(); if (!c || !out) return;
  const o = c.createOscillator(); const g = c.createGain(); const v = c.createOscillator(); const vg = c.createGain();
  o.type = 'sine'; o.frequency.value = f; v.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6); v.connect(vg); vg.connect(o.frequency);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.08); g.gain.setValueAtTime(amp, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); v.start(t); v.stop(t + dur + 0.05);
  nz(t, dur * 0.9, 'bandpass', f * 2, 1.2, amp * 0.35, null, 0.06);
}
function saw(t: number, f: number, dur: number, amp: number, lpFrom: number, lpTo: number, detune = 0, attack = 0.01) {
  const c = ac(); if (!c || !out) return;
  const o = c.createOscillator(); const lp = c.createBiquadFilter(); const g = c.createGain();
  o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = detune; lp.type = 'lowpass';
  lp.frequency.setValueAtTime(lpFrom, t); lp.frequency.linearRampToValueAtTime(lpTo, t + Math.min(0.9, dur * 0.5));
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.1);
}

/** Play a synthesized recipe, `delay` seconds from now. Unknown ids are ignored. */
export function synth(id: string, delay = 0): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime + 0.01 + delay;
  switch (id) {
    case 'move_stone': nz(t, 0.05, 'bandpass', 2200, 1.2, 0.7); tone('sine', 170, t, 0.09, 0.5, 110); break;
    case 'move_wood': nz(t, 0.04, 'bandpass', 1100, 4, 0.9); tone('triangle', 520, t, 0.06, 0.25, 470); break;
    case 'move_felt': nz(t, 0.12, 'lowpass', 500, 0.7, 0.9); tone('sine', 120, t, 0.12, 0.45, 80); break;
    case 'move_clay': tone('triangle', 260, t, 0.11, 0.45, 150); nz(t, 0.03, 'bandpass', 1600, 2, 0.35); break;
    case 'move_kunai': metal(2100, t, 0.35, 0.12); nz(t, 0.02, 'highpass', 4000, 0.7, 0.4); break;
    case 'move_shuriken': synth('move_wood', delay); metal(2900, t + 0.012, 0.25, 0.07); break;
    case 'move_seal': nz(t, 0.035, 'bandpass', 1400, 1.5, 0.8); nz(t + 0.075, 0.035, 'bandpass', 1700, 1.5, 0.7); break;
    case 'move_tag': nz(t, 0.06, 'highpass', 2500, 0.6, 0.6, null, 0.001); nz(t, 0.03, 'bandpass', 800, 1, 0.3); break;

    case 'capture_crack': synth('move_stone', delay); nz(t + 0.045, 0.06, 'bandpass', 3200, 1.5, 0.8); tone('sine', 200, t + 0.045, 0.08, 0.4, 120); nz(t + 0.04, 0.09, 'highpass', 3000, 0.7, 0.25); break;
    case 'capture_heavy': tone('sine', 140, t, 0.2, 0.85, 55); nz(t, 0.12, 'lowpass', 900, 0.8, 0.7); break;
    case 'capture_slide': nz(t, 0.12, 'bandpass', 600, 1.4, 0.3, 2600, 0.05); synth('move_wood', delay + 0.11); break;
    case 'capture_snap': nz(t, 0.03, 'bandpass', 3200, 6, 1.0); tone('square', 900, t, 0.03, 0.08, 700); break;
    case 'capture_slash': nz(t, 0.14, 'bandpass', 1200, 2, 0.45, 6000, 0.03); metal(3200, t + 0.1, 0.4, 0.07); break;
    case 'capture_poof': poof(t, 1); tone('sine', 110, t, 0.15, 0.3, 70); break;
    case 'capture_crackle': crackle(t, 0.16, 26, 0.5); tone('square', 1800, t, 0.04, 0.05, 900); break;
    case 'capture_log': tone('triangle', 180, t, 0.16, 0.5, 120); nz(t, 0.05, 'bandpass', 700, 3, 0.4); poof(t + 0.09, 0.7); break;

    case 'check_ping': synth('move_stone', delay); tone('sine', 1760, t + 0.03, 0.25, 0.12); tone('sine', 2637, t + 0.03, 0.15, 0.05); break;
    case 'check_double': synth('move_stone', delay); nz(t + 0.07, 0.04, 'bandpass', 3000, 2, 0.6); tone('triangle', 900, t + 0.07, 0.06, 0.15, 820); break;
    case 'check_tick': nz(t, 0.025, 'bandpass', 4200, 5, 1.0); tone('square', 1500, t, 0.02, 0.06); tone('sine', 220, t, 0.06, 0.3, 160); break;
    case 'check_kunaiwarn': synth('move_wood', delay); nz(t + 0.02, 0.1, 'bandpass', 2500, 8, 0.4, 7000, 0.02); metal(2400, t + 0.05, 0.3, 0.08); break;

    case 'correct_bell': bell(1046.5, t, 1.5, 0.3); break;
    case 'correct_chime': tone('sine', 659.3, t, 0.6, 0.22); tone('sine', 987.8, t + 0.09, 0.8, 0.22); break;
    case 'correct_koto': [587.3, 784, 880].forEach((f, i) => pluck(f, t + i * 0.065, 0.45, 0.18)); break;
    case 'correct_whoosh': nz(t, 0.28, 'bandpass', 400, 1, 0.3, 3000, 0.12); bell(1318.5, t + 0.16, 0.7, 0.16); break;
    case 'correct_shing': nz(t, 0.25, 'bandpass', 2000, 12, 0.6, 7000, 0.02); metal(1568, t + 0.12, 1.1, 0.1); break;
    case 'correct_spiral': whirl(t, 0.55, 0.5); bell(1318.5, t + 0.55, 0.6, 0.12); nz(t + 0.53, 0.08, 'bandpass', 3000, 1, 0.4); break;
    case 'correct_flute': flute(587.3, t, 0.35, 0.18); flute(784, t + 0.3, 0.8, 0.18); break;
    case 'correct_summon': tone('sine', 75, t, 0.3, 0.7, 50); poof(t + 0.03, 1.2); bell(1046.5, t + 0.22, 0.9, 0.14); break;

    case 'mistake_thud': tone('sine', 82, t, 0.26, 0.6, 52); nz(t, 0.15, 'lowpass', 400, 0.8, 0.4); break;
    case 'mistake_gong': tone('sine', 98, t, 1.0, 0.45); tone('sine', 149, t, 0.7, 0.18); nz(t, 0.2, 'lowpass', 300, 0.8, 0.2); break;
    case 'mistake_minor': pluck(311.1, t, 0.4, 0.16); pluck(329.6, t + 0.01, 0.4, 0.16); break;
    case 'mistake_buzz': saw(t, 110, 0.22, 0.2, 650, 650, 0, 0.01); break;
    case 'mistake_taiko': tone('sine', 85, t, 0.35, 0.6, 55); nz(t, 0.08, 'lowpass', 300, 0.8, 0.35); break;
    case 'mistake_parry': metal(1180, t, 0.5, 0.1); metal(1250, t + 0.008, 0.45, 0.08); nz(t, 0.04, 'highpass', 3000, 0.7, 0.3); break;
    case 'mistake_gust': nz(t, 0.45, 'bandpass', 1600, 1.2, 0.35, 250, 0.08); break;
    case 'mistake_broken': pluck(392, t, 0.3, 0.16); pluck(277.2, t + 0.12, 0.45, 0.16); break;

    case 'gate_taiko': tone('sine', 72, t, 0.55, 0.95, 44); nz(t, 0.2, 'lowpass', 220, 0.8, 0.55); [523.3, 659.3, 784, 1046.5].forEach((f, i) => bell(f, t + 0.28 + i * 0.12, 1.1, 0.14)); break;
    case 'gate_shamisen': [293.7, 349.2, 392, 440, 523.3, 587.3, 698.5].forEach((f, i) => pluck(f, t + i * 0.07, i === 6 ? 1.2 : 0.35, 0.16)); break;
    case 'gate_pad': [220, 277.2, 329.6, 440].forEach((f) => [-6, 6].forEach((d) => saw(t, f, 2.2, 0.035, 400, 1800, d, 0.7))); bell(1318.5, t + 0.7, 1.2, 0.08); break;
    case 'gate_gongswell': [65, 98, 131, 175].forEach((f, i) => tone('sine', f * (1 + i * 0.003), t, 2.0, 0.3 / (i + 1), null, 0.35)); nz(t, 0.6, 'bandpass', 400, 0.6, 0.12, 1200, 0.3); bell(1567.98, t + 0.55, 1.4, 0.12); break;
    case 'gate_chidori': crackle(t, 0.9, 120, 0.35); whirl(t, 0.85, 0.25); tone('sine', 60, t + 0.9, 0.5, 0.9, 40); nz(t + 0.9, 0.25, 'lowpass', 3000, 0.6, 0.6, 400); bell(1567.98, t + 1.0, 1.0, 0.1); break;
    case 'gate_bigsummon': tone('sine', 70, t, 0.45, 0.9, 42); tone('sine', 70, t + 0.22, 0.45, 0.8, 42); poof(t + 0.45, 1.8); [293.7, 349.2, 392, 440, 523.3, 587.3].forEach((f, i) => pluck(f, t + 0.6 + i * 0.06, i === 5 ? 1.0 : 0.3, 0.15)); break;
    case 'gate_awaken': [55, 82.4].forEach((f) => saw(t, f, 1.2, 0.12, 150, 900, 0, 0.8)); nz(t + 0.85, 0.3, 'bandpass', 2000, 12, 0.6, 8000, 0.02); metal(1760, t + 0.95, 1.4, 0.12); break;
    case 'gate_kage': tone('sine', 72, t, 0.5, 0.85, 44); synth('gate_pad', delay + 0.1); [784, 1046.5, 1318.5].forEach((f, i) => bell(f, t + 0.3 + i * 0.15, 1.2, 0.12)); break;
  }
}

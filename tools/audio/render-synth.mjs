#!/usr/bin/env node
// Offline renderer for the two synth recipes the app still uses by default
// (DEFAULT_SOUND_PICKS: mistake 'thud', gate 'gongswell'), ported from
// apps/frontend/src/lib/sound/engine.ts with the Web Audio semantics they
// rely on: a-rate AudioParam automation (setValueAtTime +
// exponentialRampToValueAtTime), sine oscillators with phase accumulation,
// a 2 s white-noise buffer read from a random offset, BiquadFilterNode
// coefficients from the Web Audio spec (lowpass/highpass Q in dB, bandpass
// Q linear) recomputed per sample, and the master gain. Math.random is a
// seeded PRNG, so every run writes the same bytes.
//
//   node tools/audio/render-synth.mjs [--master 0.9]
//
// The web schedules at currentTime + 0.01; that lookahead is playback
// latency, not part of the sound, so recipes start at t = 0 here.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dB, writeWav16 } from './lib/wav.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(REPO, 'apps/mobile/assets/sfx');
const SR = 48000;
const argMaster = process.argv.indexOf('--master');
// engine.ts: out.gain = volume * 0.9; volume itself is applied by the app.
const MASTER = argMaster > 0 ? Number(process.argv[argMaster + 1]) : 0.9;

// mulberry32: small, fast, good enough for noise.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** AudioParam with the two automation calls engine.ts uses. */
class Param {
  constructor(value) { this.def = value; this.ev = []; }
  setValueAtTime(v, t) { this.ev.push({ type: 'set', v, t }); return this; }
  exponentialRampToValueAtTime(v, t) { this.ev.push({ type: 'exp', v, t }); return this; }
  at(t) {
    let v = this.def, t0 = -Infinity;
    for (const e of this.ev) {
      if (e.type === 'set') {
        if (t < e.t) return v;
        v = e.v; t0 = e.t;
      } else {
        if (t < e.t) return v * (e.v / v) ** ((t - t0) / (e.t - t0));
        v = e.v; t0 = e.t;
      }
    }
    return v;
  }
}

function makeCtx(seed) {
  const random = prng(seed);
  const voices = [];
  let noise = null;
  const noiseBuf = () => {
    if (!noise) {
      noise = new Float32Array(SR * 2);
      for (let i = 0; i < noise.length; i++) noise[i] = random() * 2 - 1;
    }
    return noise;
  };

  function tone(type, f0, t, dur, peak, f1, attack) {
    if (type !== 'sine') throw new Error(`oscillator ${type} not ported`);
    const freq = new Param(440).setValueAtTime(f0, t);
    if (f1) freq.exponentialRampToValueAtTime(f1, t + dur);
    const a = attack || 0.004;
    const g = new Param(1).setValueAtTime(0.0001, t).exponentialRampToValueAtTime(peak, t + a).exponentialRampToValueAtTime(0.0001, t + dur);
    let phase = 0;
    voices.push({
      start: t, stop: t + dur + 0.05,
      sample: (time) => {
        const s = Math.sin(phase) * g.at(time);
        phase += (2 * Math.PI * freq.at(time)) / SR;
        return s;
      },
    });
  }

  function nz(t, dur, ftype, f0, q, peak, f1, attack) {
    const buf = noiseBuf();
    const freq = new Param(350).setValueAtTime(f0, t);
    if (f1) freq.exponentialRampToValueAtTime(f1, t + dur);
    const a = attack || 0.002;
    const g = new Param(1).setValueAtTime(0.0001, t).exponentialRampToValueAtTime(peak, t + a).exponentialRampToValueAtTime(0.0001, t + dur);
    let pos = Math.floor(random() * SR); // s.start(t, Math.random())
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    voices.push({
      start: t, stop: t + dur + 0.05,
      sample: (time) => {
        const x = pos < buf.length ? buf[pos++] : 0;
        const [b0, b1, b2, a1, a2] = biquad(ftype, freq.at(time), q);
        const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        return y * g.at(time);
      },
    });
  }

  function bell(f, t, dur, amp) {
    [[1, 1], [2.76, 0.32], [5.4, 0.12], [8.93, 0.05]].forEach(([r, a], i) => tone('sine', f * r, t, dur / (1 + i * 0.6), amp * a));
  }

  function render() {
    const end = Math.max(...voices.map((v) => v.stop));
    const out = new Float32Array(Math.ceil(end * SR));
    for (const v of voices) {
      for (let n = Math.ceil(v.start * SR); n < Math.min(out.length, Math.ceil(v.stop * SR)); n++) out[n] += v.sample(n / SR);
    }
    for (let n = 0; n < out.length; n++) out[n] *= MASTER;
    return out;
  }

  return { tone, nz, bell, render };
}

/** Normalised biquad coefficients per the Web Audio spec. */
function biquad(type, f, Q) {
  const w0 = (2 * Math.PI * Math.max(0, Math.min(SR / 2, f))) / SR;
  const cos = Math.cos(w0), sin = Math.sin(w0);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'bandpass') {
    const al = sin / (2 * Q);
    [b0, b1, b2, a0, a1, a2] = [al, 0, -al, 1 + al, -2 * cos, 1 - al];
  } else {
    const al = sin / (2 * 10 ** (Q / 20));
    const k = type === 'lowpass' ? 1 - cos : 1 + cos, s = type === 'lowpass' ? 1 : -1;
    if (type !== 'lowpass' && type !== 'highpass') throw new Error(`biquad ${type} not ported`);
    [b0, b1, b2, a0, a1, a2] = [k / 2, s * k, k / 2, 1 + al, -2 * cos, 1 - al];
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

// Recipes, verbatim from engine.ts synth().
const RECIPES = {
  'mistake-thud': ({ tone, nz }, t) => {
    tone('sine', 82, t, 0.26, 0.6, 52); nz(t, 0.15, 'lowpass', 400, 0.8, 0.4);
  },
  'gate-gongswell': ({ tone, nz, bell }, t) => {
    [65, 98, 131, 175].forEach((f, i) => tone('sine', f * (1 + i * 0.003), t, 2.0, 0.3 / (i + 1), null, 0.35));
    nz(t, 0.6, 'bandpass', 400, 0.6, 0.12, 1200, 0.3);
    bell(1567.98, t + 0.55, 1.4, 0.12);
  },
};

console.log(`master gain ${MASTER}`);
for (const [name, recipe] of Object.entries(RECIPES)) {
  const ctx = makeCtx(0x7ac7ac);
  recipe(ctx, 0);
  const pcm = ctx.render();
  let peak = 0, sum = 0;
  for (const v of pcm) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  const clipped = writeWav16(path.join(OUT, `${name}.wav`), SR, [pcm]);
  console.log(`${name.padEnd(16)} ${(pcm.length / SR).toFixed(3)} s  peak ${dB(peak).toFixed(1)} dBFS  RMS ${dB(Math.sqrt(sum / pcm.length)).toFixed(1)} dBFS${clipped ? `  CLIPPED ${clipped}` : ''}`);
}

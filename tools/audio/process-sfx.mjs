#!/usr/bin/env node
// Offline version of the web's runtime clip analysis (apps/frontend/src/lib/
// sound.ts analyse()), so the app plays from sample 0 at gain 1:
//   - leading silence trimmed at the first sample above -40 dBFS (any
//     channel), keeping a 3 ms pre-roll;
//   - board/feedback clips levelled to -29 dBFS RMS over the first 100 ms
//     after onset (all channels), boost capped at +6 dB;
//   - short clips → 48 kHz mono 16-bit WAV; rank clips → AAC .m4a.
// The orphan sounds/correct.mp3 and sounds/fail.mp3 are not shipped.
//
//   node tools/audio/process-sfx.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dB, readWav, writeWav16 } from './lib/wav.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(REPO, 'apps/frontend/public/sounds/sfx');
const OUT = path.join(REPO, 'apps/mobile/assets/sfx');

const RATE = 48000;
const ONSET_THRESHOLD = 0.01;          // -40 dBFS
const PREROLL_S = 0.003;               // keep the attack transient intact
const LEVEL_WINDOW_S = 0.1;            // loudness measured over the first 100ms of sound
const TARGET_RMS = 10 ** (-29 / 20);   // where the move / capture / check clicks already sit
const MAX_BOOST = 2;
// Files of the LEVELLED events (move, capture, check, castle, promote,
// correct) in the web catalogue. Rank clips keep their own mastering.
const LEVELLED = new Set(['move-1', 'capture-1', 'check-1', 'castle-2', 'promote', 'correct-5']);
const AAC = (name) => name.startsWith('rank-');

/** The web's analyse(), on plain channel arrays. */
function analyse(channels, sampleRate, level) {
  const length = channels[0].length;
  let first = length;
  for (const d of channels) {
    for (let i = 0; i < first; i++) {
      if (Math.abs(d[i]) > ONSET_THRESHOLD) { first = i; break; }
    }
  }
  if (first === length) first = 0;
  let gain = 1;
  if (level) {
    const rms = windowRms(channels, sampleRate, first);
    if (rms > 0) gain = Math.min(MAX_BOOST, TARGET_RMS / rms);
  }
  return { first, offset: Math.max(0, first - Math.round(PREROLL_S * sampleRate)), gain };
}

function windowRms(channels, sampleRate, first) {
  const end = Math.min(channels[0].length, first + Math.round(LEVEL_WINDOW_S * sampleRate));
  let sum = 0;
  for (const d of channels) for (let i = first; i < end; i++) sum += d[i] * d[i];
  return Math.sqrt(sum / Math.max(1, (end - first) * channels.length));
}

function stats(channels, sampleRate) {
  const { first } = analyse(channels, sampleRate, false);
  let peak = 0;
  for (const d of channels) for (const v of d) peak = Math.max(peak, Math.abs(v));
  return { onsetMs: (first / sampleRate) * 1000, rms: dB(windowRms(channels, sampleRate, first)), peak: dB(peak), dur: channels[0].length / sampleRate };
}

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] });

function decode(src, dst) {
  // 16-bit at the output rate, channels kept: the web analyses all channels.
  sh('afconvert', ['-f', 'WAVE', '-d', `LEI16@${RATE}`, '--src-complexity', 'bats', '-r', '127', src, dst]);
  return readWav(dst);
}

const tmp = mkdtempSync(path.join(tmpdir(), 'tac-sfx-'));
mkdirSync(OUT, { recursive: true });
const rows = [];
for (const f of readdirSync(SRC).filter((f) => f.endsWith('.mp3')).sort()) {
  const name = f.replace(/\.mp3$/, '');
  const { channels, sampleRate } = decode(path.join(SRC, f), path.join(tmp, `${name}.wav`));
  const before = stats(channels, sampleRate);
  const { offset, gain } = analyse(channels, sampleRate, LEVELLED.has(name));
  const trimmed = channels.map((d) => d.map((v) => v * gain).subarray(offset));
  let out, after, clipped;
  if (AAC(name)) {
    // Music: keep the source channel layout; AAC at 64 kbps per channel
    // (the sources are 64–320 kbps MP3, rank-down-b only 22 kHz).
    const wav = path.join(tmp, `${name}.out.wav`);
    clipped = writeWav16(wav, sampleRate, trimmed);
    out = path.join(OUT, `${name}.m4a`);
    sh('afconvert', ['-f', 'm4af', '-d', `aac@${RATE}`, '-b', String(64000 * trimmed.length), '-q', '127', '-s', '2', wav, out]);
    // Measure what a decoder returns, AAC priming included.
    const back = decode(out, path.join(tmp, `${name}.back.wav`));
    after = stats(back.channels, back.sampleRate);
  } else {
    const mono = new Float32Array(trimmed[0].length);
    for (const d of trimmed) for (let i = 0; i < d.length; i++) mono[i] += d[i] / trimmed.length;
    out = path.join(OUT, `${name}.wav`);
    clipped = writeWav16(out, sampleRate, [mono]);
    const back = readWav(out);
    after = stats(back.channels, back.sampleRate);
  }
  rows.push({ name, levelled: LEVELLED.has(name), gain: dB(gain), before, after, clipped, file: path.relative(REPO, out), kb: statSync(out).size / 1024 });
}
rmSync(tmp, { recursive: true, force: true });

const n = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-inf');
console.log('clip               lvl  gain dB | onset ms   RMS dBFS  peak dBFS | onset ms   RMS dBFS  peak dBFS | dur s   out');
console.log('                                |            before            |            after             |');
for (const r of rows) {
  const b = r.before, a = r.after;
  console.log(
    `${r.name.padEnd(18)} ${r.levelled ? 'yes' : ' - '} ${n(r.gain).padStart(7)}  | ${n(b.onsetMs).padStart(8)} ${n(b.rms).padStart(9)} ${n(b.peak).padStart(10)} | ` +
      `${n(a.onsetMs).padStart(8)} ${n(a.rms).padStart(9)} ${n(a.peak).padStart(10)} | ${n(a.dur, 3).padStart(6)}  ${path.basename(r.file)} ${n(r.kb, 0)} KB` +
      (r.clipped ? `  CLIPPED ${r.clipped} samples` : ''),
  );
}
if (rows.some((r) => r.clipped)) process.exitCode = 1;

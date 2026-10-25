// Minimal RIFF/WAVE reader and 16-bit writer (PCM16 and float32 in, PCM16 out).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/** @returns {{ sampleRate: number, channels: Float32Array[] }} */
export function readWav(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: not a WAVE file`);
  let fmt = null, data = null;
  for (let p = 12; p + 8 <= b.length; ) {
    const id = b.toString('ascii', p, p + 4), len = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = b.subarray(p + 8, p + 8 + len);
    p += 8 + len + (len & 1);
  }
  if (!fmt || !data) throw new Error(`${file}: missing fmt or data chunk`);
  const { ch, rate, bits } = fmt;
  // 0xFFFE (extensible) carries the real format in its sub-GUID; afconvert
  // only writes it for PCM16/float32 here, told apart by bit depth.
  const float = fmt.format === 3 || (fmt.format === 0xfffe && bits === 32);
  const bps = bits / 8, frames = Math.floor(data.length / (bps * ch));
  const channels = Array.from({ length: ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      const o = (i * ch + c) * bps;
      channels[c][i] = float ? data.readFloatLE(o) : bits === 16 ? data.readInt16LE(o) / 32768 : (() => { throw new Error(`${file}: ${bits}-bit PCM unsupported`); })();
    }
  }
  return { sampleRate: rate, channels };
}

/** Write PCM16 (rounded, clipped to ±1). Returns the number of clipped samples. */
export function writeWav16(file, sampleRate, channels) {
  const ch = channels.length, frames = channels[0].length;
  const b = Buffer.alloc(44 + frames * ch * 2);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + frames * ch * 2, 4); b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(frames * ch * 2, 40);
  let clipped = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      let v = Math.round(channels[c][i] * 32768);
      if (v > 32767 || v < -32768) { clipped++; v = Math.max(-32768, Math.min(32767, v)); }
      b.writeInt16LE(v, 44 + (i * ch + c) * 2);
    }
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, b);
  return clipped;
}

export const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

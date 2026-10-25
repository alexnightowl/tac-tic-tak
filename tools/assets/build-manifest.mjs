#!/usr/bin/env node
// Index of everything in apps/mobile/assets → apps/mobile/assets/manifest.json.
// Scale variants (name@2x.webp, name@3x.webp) collapse into one entry whose
// `path` is what require() takes and whose size is in points.
//
//   node tools/assets/build-manifest.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { OUT, size } from './lib/img.mjs';
import { readWav } from '../audio/lib/wav.mjs';

const KIND = {
  pieces: 'piece', board: 'board', plates: 'plate', textures: 'texture', icons: 'icon', themes: 'theme-glyph',
  surfaces: 'surface', images: 'app-icon', fonts: 'font', sfx: 'sound',
};

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name.endsWith('.icon') ? [] : walk(p); // Xcode .icon bundles are not ours
    return e.name.startsWith('.') ? [] : [p];
  });
}

function audioInfo(file) {
  if (file.endsWith('.wav')) {
    const { sampleRate, channels } = readWav(file);
    return { duration: +(channels[0].length / sampleRate).toFixed(3), sampleRate, channels: channels.length, codec: 'pcm16' };
  }
  const t = execFileSync('afinfo', [file]).toString();
  const [, ch, rate] = /Data format:\s+(\d+) ch,\s+(\d+) Hz/.exec(t);
  // Valid frames exclude AAC priming/remainder, i.e. what a gapless decoder plays.
  const frames = /valid frames:\s*(\d+)/.exec(t) ?? /audio (\d+) valid frames/.exec(t);
  const dur = frames ? Number(frames[1]) / Number(rate) : Number(/estimated duration: ([\d.]+)/.exec(t)[1]);
  return { duration: +dur.toFixed(3), sampleRate: Number(rate), channels: Number(ch), codec: 'aac' };
}

const entries = new Map();
for (const file of walk(OUT).sort()) {
  const rel = path.relative(OUT, file);
  if (rel === 'manifest.json') continue;
  const top = rel.split(path.sep)[0];
  const ext = path.extname(rel).slice(1);
  const scaleMatch = /@(\d)x\.\w+$/.exec(rel);
  const base = scaleMatch ? rel.replace(/@\dx(\.\w+)$/, '$1') : rel;
  const key = base.replace(/\.\w+$/, '').split(path.sep).join('/');
  const bytes = statSync(file).size;
  let e = entries.get(base);
  if (!e) {
    e = { key, path: base.split(path.sep).join('/'), kind: KIND[top] ?? 'other', format: ext };
    if (['json', 'md', 'txt'].includes(ext)) e.kind = ext === 'json' ? 'data' : 'license';
    entries.set(base, e);
  }
  if (['png', 'webp', 'jpg'].includes(ext)) {
    const { w, h } = size(file);
    if (scaleMatch) {
      const s = Number(scaleMatch[1]);
      (e.scales ??= []).push(s);
      e.width = +(w / s).toFixed(2); e.height = +(h / s).toFixed(2); // pt
      (e.px ??= {})[`@${s}x`] = [w, h];
      e.bytes = (e.bytes ?? 0) + bytes;
      continue;
    }
    Object.assign(e, { width: w, height: h });
  } else if (ext === 'svg') {
    const vb = /viewBox="([^"]+)"/.exec(readFileSync(file, 'utf8'))[1].trim().split(/[\s,]+/).map(Number);
    Object.assign(e, { width: vb[2], height: vb[3] });
  } else if (ext === 'wav' || ext === 'm4a') {
    Object.assign(e, audioInfo(file));
  } else if (ext === 'ttf') {
    const fonts = JSON.parse(readFileSync(path.join(OUT, 'fonts/fonts.json'), 'utf8'));
    const f = fonts[path.basename(file)];
    Object.assign(e, { family: f.family, postScriptName: f.postScriptName, weight: f.weight, cyrillic: f.cyrillic });
  }
  e.bytes = bytes;
}

const list = [...entries.values()];
// Keys must be unique: when two formats share a name (the book glyph ships as
// SVG and as @2x/@3x WebP), the scaled raster keeps the bare key and the
// others get their extension appended.
const byKey = Map.groupBy(list, (e) => e.key);
for (const group of byKey.values()) {
  if (group.length < 2) continue;
  const keep = group.find((e) => e.scales) ?? group[0];
  for (const e of group) if (e !== keep) e.key = `${e.key}.${e.format}`;
}
if (new Set(list.map((e) => e.key)).size !== list.length) throw new Error('duplicate asset keys');
const manifest = {
  generatedBy: 'tools/assets/build-manifest.mjs',
  note: 'Sizes of scaled images (scales present) are in points; others in px. Durations in seconds.',
  totalBytes: list.reduce((s, e) => s + e.bytes, 0),
  assets: list,
};
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const byKind = list.reduce((m, e) => ((m[e.kind] = (m[e.kind] ?? 0) + 1), m), {});
console.log(`manifest: ${list.length} assets, ${(manifest.totalBytes / 1024 / 1024).toFixed(2)} MB`, byKind);

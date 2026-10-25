// Shared helpers for the image scripts: shell out to ImageMagick / cwebp,
// and move raw RGBA buffers in and out of JS for per-pixel compositing.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const WEB = path.join(REPO, 'apps/frontend');
// Baked (fade-applied) images, i.e. exactly what the web renders. design-src
// holds the un-baked originals at the same resolution, so it is not used.
export const DESIGN = path.join(WEB, 'public/design');
export const OUT = path.join(REPO, 'apps/mobile/assets');

export const STONE = '#1d1b20';

export function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'], maxBuffer: 1 << 30, ...opts });
}

export const magick = (...args) => run('magick', args.flat());

export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
  return p;
}

export function cleanDir(p) {
  rmSync(p, { recursive: true, force: true });
  return ensureDir(p);
}

export function tempDir() {
  return mkdtempSync(path.join(tmpdir(), 'tac-assets-'));
}

export function size(file) {
  const [w, h] = magick('identify', '-format', '%w %h', `${file}[0]`).toString().trim().split(' ').map(Number);
  return { w, h };
}

/**
 * Encode to WebP. Lossy keeps alpha lossless (alpha_q 100) so cut-out edges
 * stay clean; `lossless` is for small flat icons where lossy rings.
 */
export function webp(src, dst, { lossless = false, q = 92 } = {}) {
  ensureDir(path.dirname(dst));
  const args = lossless ? ['-lossless', '-z', '9', '-exact'] : ['-q', String(q), '-alpha_q', '100', '-m', '6', '-sharp_yuv'];
  run('cwebp', ['-quiet', '-metadata', 'none', ...args, src, '-o', dst]);
}

/** Read any image as straight (non-premultiplied) 8-bit RGBA. */
export function readRGBA(file) {
  const { w, h } = size(file);
  const data = magick(file, '-colorspace', 'sRGB', '-alpha', 'on', '-depth', '8', 'RGBA:-');
  return { w, h, data: new Uint8Array(data.buffer, data.byteOffset, data.length) };
}

/** Write straight 8-bit RGBA (or RGB when `opaque`) to a PNG, stripping metadata. */
export function writePNG(img, dst, { opaque = false } = {}) {
  ensureDir(path.dirname(dst));
  const args = ['-size', `${img.w}x${img.h}`, '-depth', '8', 'RGBA:-'];
  const flags = opaque ? ['-alpha', 'off', '-define', 'png:color-type=2'] : [];
  run('magick', [...args, ...flags, '-strip', '-define', 'png:compression-level=9', `PNG:${dst}`], {
    input: Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length),
  });
}

export function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Float RGBA canvas (straight alpha, 0..1) with source-over compositing. */
export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Float64Array(w * h * 4);
  }
  fill(r, g, b, a = 1) {
    for (let i = 0; i < this.w * this.h; i++) this.px.set([r, g, b, a], i * 4);
    return this;
  }
  /** Composite colour (r,g,b in 0..1) with coverage `a` over pixel i. */
  over(i, r, g, b, a) {
    if (a <= 0) return;
    const p = this.px, k = i * 4;
    const da = p[k + 3], oa = a + da * (1 - a);
    if (oa <= 0) return;
    p[k] = (r * a + p[k] * da * (1 - a)) / oa;
    p[k + 1] = (g * a + p[k + 1] * da * (1 - a)) / oa;
    p[k + 2] = (b * a + p[k + 2] * da * (1 - a)) / oa;
    p[k + 3] = oa;
  }
  /** Multiply the alpha of every pixel by mask(x, y) — used for clipping. */
  clip(mask) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.px[(y * this.w + x) * 4 + 3] *= mask(x, y);
  }
  /**
   * 8-bit straight RGBA. `dither` adds seeded triangular noise (±1 LSB)
   * before rounding: faint wide gradients (the splash glow peaks at alpha
   * 0.42) otherwise quantise into visible rings.
   */
  toRGBA({ dither = false } = {}) {
    const out = new Uint8Array(this.w * this.h * 4);
    let seed = 0x9e3779b9;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < out.length; i++) {
      const n = dither ? rnd() - rnd() : 0;
      out[i] = Math.max(0, Math.min(255, Math.round(this.px[i] * 255 + n)));
    }
    return { w: this.w, h: this.h, data: out };
  }
}

/** Anti-aliased coverage of a disc, 1 inside, 0 outside, linear over 1px. */
export function discCoverage(x, y, cx, cy, r) {
  const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
  return Math.max(0, Math.min(1, r - d + 0.5));
}

/** Separable box-blur ×3 ≈ Gaussian with the given sigma (px) on a 1-channel buffer. */
export function gaussian(buf, w, h, sigma) {
  if (sigma <= 0) return buf;
  // Three box passes whose variance sums to sigma² (Kovesi).
  const n = 3, wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  const sizes = Array.from({ length: n }, (_, i) => (i < m ? wl : wl + 2));
  let a = Float64Array.from(buf), b = new Float64Array(buf.length);
  const pass = (src, dst, r, horiz) => {
    const len = horiz ? w : h, lines = horiz ? h : w;
    for (let l = 0; l < lines; l++) {
      const at = (i) => (horiz ? l * w + Math.max(0, Math.min(len - 1, i)) : Math.max(0, Math.min(len - 1, i)) * w + l);
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[at(i)];
      for (let i = 0; i < len; i++) {
        dst[horiz ? l * w + i : i * w + l] = acc / (2 * r + 1);
        acc += src[at(i + r + 1)] - src[at(i - r)];
      }
    }
  };
  for (const s of sizes) {
    const r = (s - 1) / 2;
    pass(a, b, r, true);
    pass(b, a, r, false);
  }
  return a;
}

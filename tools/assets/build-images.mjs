#!/usr/bin/env node
// Image pipeline for apps/mobile/assets. Re-runnable; every stage rewrites its
// own output folder from apps/frontend sources. See tools/README.md.
//
//   node tools/assets/build-images.mjs            # all stages
//   node tools/assets/build-images.mjs plates     # one or more stages
import { copyFileSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import {
  DESIGN, OUT, WEB, STONE, Canvas, cleanDir, discCoverage, ensureDir, gaussian, hex, magick, readRGBA, size,
  tempDir, webp, writePNG,
} from './lib/img.mjs';

const PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
const rel = (p) => path.relative(OUT, p);
const log = (...a) => console.log(...a);

// ── pieces ───────────────────────────────────────────────────────────────
// 256 px is the largest master that exists (design-src has the same size,
// un-baked), so this is a straight re-encode of what the web shows.
function pieces() {
  const root = cleanDir(path.join(OUT, 'pieces'));
  const manifest = { size: 256, format: 'webp', sets: {} };
  for (const [set, dir] of [['ember', 'pieces'], ['classic', 'pieces-classic']]) {
    manifest.sets[set] = {};
    for (const p of PIECES) {
      const dst = path.join(root, set, `${p}.webp`);
      webp(path.join(DESIGN, dir, `${p}.png`), dst);
      manifest.sets[set][p] = `${set}/${p}.webp`;
    }
  }
  writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  log('pieces: 2 sets × 12');
}

// ── board ────────────────────────────────────────────────────────────────
// Web: an 8×8 grid, each square the full 512² tile stretched to the square
// (background-size 100% 100%, opaque JPEG so the stone colour underneath
// never shows). a1 dark: isLight = (file + rank) % 2 === 1. With rank 8 on
// top, that makes image (col + row) even → light. The pattern is
// 180°-symmetric, so one image serves both orientations.
function board() {
  const root = cleanDir(path.join(OUT, 'board'));
  const tmp = tempDir();
  const SQ = 256, N = 8;
  const tiles = {};
  for (const t of ['light', 'dark']) {
    const src = path.join(DESIGN, 'board', `tile-${t}.jpg`);
    webp(src, path.join(root, `tile-${t}.webp`), { q: 92 });
    tiles[t] = path.join(tmp, `${t}.png`);
    magick(src, '-filter', 'Lanczos', '-resize', `${SQ}x${SQ}!`, tiles[t]);
  }
  const args = ['-size', `${SQ * N}x${SQ * N}`, 'xc:black'];
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      args.push(tiles[(col + row) % 2 === 0 ? 'light' : 'dark'], '-geometry', `+${col * SQ}+${row * SQ}`, '-composite');
    }
  }
  const png = path.join(tmp, 'board.png');
  magick(...args, png);
  webp(png, path.join(root, 'board.webp'), { q: 92 });
  rmSync(tmp, { recursive: true, force: true });
  log(`board: ${SQ * N}px + 2 tiles`);
}

// ── plates ───────────────────────────────────────────────────────────────
// Web: border-image-slice 55 60 55 60 fill; repeat "round stretch";
// border-width per size (PLATE_BORDER in components/ui/button.tsx).
// The left/right columns (corners + stretched edge) become caps rendered at
// exactly the web's border widths. The centre band (top edge + fill +
// bottom edge) becomes one "mid" tile at the width CSS `round` starts from:
// srcMidWidth × borderTop / sliceTop. The app lays n = max(1, round(midW /
// tileW)) copies stretched to fill midW, which is what `round` does.
export const PLATE_SLICE = { top: 55, right: 60, bottom: 55, left: 60 };
export const PLATE_SIZES = {
  sm: { height: 36, borderV: 10, borderH: 11 },
  md: { height: 44, borderV: 12, borderH: 13 },
  lg: { height: 52, borderV: 14, borderH: 15 },
};

function sliceColumn(src, tmp, name, { x, w }, srcH, { height, borderV }, outW, s) {
  const bv = Math.round(borderV * s), mid = Math.round(height * s) - 2 * bv;
  const { top, bottom } = PLATE_SLICE;
  const parts = [
    [0, top, bv],
    [top, srcH - top - bottom, mid],
    [srcH - bottom, bottom, bv],
  ].map(([y, h, oh], i) => {
    const f = path.join(tmp, `${name}-${i}.png`);
    magick(src, '-crop', `${w}x${h}+${x}+${y}`, '+repage', '-filter', 'Lanczos', '-resize', `${outW}x${oh}!`, f);
    return f;
  });
  const out = path.join(tmp, `${name}.png`);
  magick(...parts, '-append', out);
  return out;
}

function plates() {
  const root = cleanDir(path.join(OUT, 'plates'));
  const tmp = tempDir();
  const meta = { slice: PLATE_SLICE, sizes: {}, variants: {} };
  for (const variant of ['ember', 'slate']) {
    const src = path.join(DESIGN, 'plates', `${variant}.webp`);
    const { w: W, h: H } = size(src);
    const midSrc = W - PLATE_SLICE.left - PLATE_SLICE.right;
    meta.variants[variant] = { source: path.relative(WEB, src), width: W, height: H };
    for (const [key, sz] of Object.entries(PLATE_SIZES)) {
      const tileW = (midSrc * sz.borderV) / PLATE_SLICE.top;
      meta.sizes[key] ??= { ...sz, capWidth: sz.borderH, midTileWidth: {} };
      meta.sizes[key].midTileWidth[variant] = Math.round(tileW * 100) / 100;
      for (const s of [2, 3]) {
        const cols = {
          left: { x: 0, w: PLATE_SLICE.left, outW: Math.round(sz.borderH * s) },
          mid: { x: PLATE_SLICE.left, w: midSrc, outW: Math.round(tileW * s) },
          right: { x: W - PLATE_SLICE.right, w: PLATE_SLICE.right, outW: Math.round(sz.borderH * s) },
        };
        for (const [part, c] of Object.entries(cols)) {
          const png = sliceColumn(src, tmp, `${variant}-${key}-${part}-${s}`, c, H, sz, c.outW, s);
          webp(png, path.join(root, `${variant}-${key}-${part}@${s}x.webp`), { q: 90 });
        }
      }
    }
  }
  writeFileSync(path.join(root, 'plates.json'), JSON.stringify(meta, null, 2) + '\n');
  rmSync(tmp, { recursive: true, force: true });
  log('plates: 2 variants × 3 sizes × 3 parts × @2x/@3x');
}

// ── textures ─────────────────────────────────────────────────────────────
// slate.jpg is already seamless (checked below). The web tiles it at 520 CSS
// px, so it ships as a 1x asset: RN `resizeMode="repeat"` then tiles at
// 512 pt, close enough to 520. There is no separate marble texture: "marble"
// is the light board tile (board/tile-light), as on the web.
function seamScore(file) {
  const { w, h, data } = readRGBA(file);
  const d = (x0, y0, x1, y1) => {
    let s = 0;
    for (let c = 0; c < 3; c++) s += Math.abs(data[(y0 * w + x0) * 4 + c] - data[(y1 * w + x1) * 4 + c]);
    return s / 3;
  };
  let wrap = 0, inner = 0;
  for (let y = 0; y < h; y++) { wrap += d(w - 1, y, 0, y); inner += d(w / 2 - 1, y, w / 2, y); }
  for (let x = 0; x < w; x++) { wrap += d(x, h - 1, x, 0); inner += d(x, h / 2 - 1, x, h / 2); }
  return { wrap: wrap / (w + h), inner: inner / (w + h) };
}

function textures() {
  const root = cleanDir(path.join(OUT, 'textures'));
  const src = path.join(DESIGN, 'textures', 'slate.jpg');
  const s = seamScore(src);
  log(`textures: slate seam Δ ${s.wrap.toFixed(2)} at the wrap vs ${s.inner.toFixed(2)} mid-image`);
  if (s.wrap > s.inner * 2) throw new Error('slate.jpg does not tile seamlessly any more');
  webp(src, path.join(root, 'slate.webp'), { q: 90 });
}

// ── icons ────────────────────────────────────────────────────────────────
// No larger masters exist (design-src holds the same sizes), so @3x is the
// source and @2x is ⅔ of it: logical size = source / 3 (32 pt mode and nav
// icons, 42.67 pt rank eyes, 128 pt knight). Tinted masks (white on alpha)
// are lossless because flat edges ring when lossy; painted ones are lossy.
// The book glyph is an SVG mask; it is rasterised at its 32×24 box.
const ICONS = [
  'icons/mode-blitz.png', 'icons/mode-bullet.png', 'icons/mode-rapid.png',
  'icons/nav-home.png', 'icons/nav-play.png', 'icons/nav-review.png', 'icons/nav-review-book.svg',
  'icons/rank-4.webp', 'icons/rank-5.webp', 'icons/tomoe-1.webp', 'icons/tomoe-2.webp', 'icons/tomoe-3.webp',
  'knight-logo.webp',
];

const MASK_ICONS = /^(mode-|nav-play|nav-review)/;

function stripSvg(text) {
  // C2PA provenance blocks are ~90% of each file and useless to the app.
  return text
    .replace(/<metadata>[\s\S]*?<\/metadata>/g, '')
    .replace(/\s+xmlns:c2pa="[^"]*"/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim() + '\n';
}

function icons() {
  const root = cleanDir(path.join(OUT, 'icons'));
  const tmp = tempDir();
  for (const f of ICONS) {
    const src = path.join(DESIGN, f);
    const name = path.basename(f).replace(/\.\w+$/, '');
    if (f.endsWith('.svg')) {
      const clean = path.join(root, `${name}.svg`);
      writeFileSync(clean, stripSvg(readFileSync(src, 'utf8')));
      const { w, h } = svgBox(clean);
      for (const s of [2, 3]) {
        const png = path.join(tmp, `${name}@${s}.png`);
        rasterMaskedSvg(clean, tmp, w * s, h * s, png);
        webp(png, path.join(root, `${name}@${s}x.webp`), { lossless: true });
      }
      continue;
    }
    const { w, h } = size(src);
    const png3 = path.join(tmp, `${name}@3.png`), png2 = path.join(tmp, `${name}@2.png`);
    magick(src, png3);
    magick(src, '-filter', 'Lanczos', '-resize', `${Math.round((w * 2) / 3)}x${Math.round((h * 2) / 3)}!`, png2);
    const enc = MASK_ICONS.test(name) ? { lossless: true } : { q: 92 };
    webp(png3, path.join(root, `${name}@3x.webp`), enc);
    webp(png2, path.join(root, `${name}@2x.webp`), enc);
  }
  rmSync(tmp, { recursive: true, force: true });
  log(`icons: ${ICONS.length} × @2x/@3x`);
}

/**
 * Rasterise the book glyph, which cuts its page lines out with an SVG
 * <mask>. ImageMagick's SVG reader ignores masks and drops fill="none"
 * strokes, so the paths are drawn as MVG at 16× and composited by hand:
 * (masked paths − the mask's strokes) + the remaining paths.
 */
function rasterMaskedSvg(file, tmp, W, H, dst) {
  const t = readFileSync(file, 'utf8');
  const { w, h } = svgBox(file), k = 16;
  const paths = (frag) => [...frag.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  const draw = (frag, out, stroke) => {
    const style = stroke
      ? ['-fill', 'none', '-stroke', 'white', '-strokewidth', stroke.width]
      : ['-fill', 'white', '-stroke', 'none'];
    const cap = stroke ? `stroke-linecap ${stroke.cap} ` : '';
    const mvg = paths(frag).map((d) => `path '${d}'`).join(' ');
    magick('-size', `${w * k}x${h * k}`, 'xc:none', ...style, '-draw', `scale ${k},${k} ${cap}${mvg}`, out);
    return out;
  };
  const mask = /<mask[^>]*>([\s\S]*?)<\/mask>/.exec(t);
  const masked = /<g mask="url\(#\w+\)">([\s\S]*?)<\/g>/.exec(t);
  const rest = t.replace(/<defs>[\s\S]*?<\/defs>/, '').replace(masked?.[0] ?? '', '');
  const layers = [draw(rest, path.join(tmp, 'rest.png'))];
  if (mask && masked) {
    const g = /<g[^>]*stroke-width="([\d.]+)"[^>]*>/.exec(mask[1]);
    const cap = /stroke-linecap="(\w+)"/.exec(mask[1])?.[1] ?? 'butt';
    layers.push('(', draw(masked[1], path.join(tmp, 'masked.png')), draw(mask[1], path.join(tmp, 'cut.png'), { width: g[1], cap }),
      '-compose', 'DstOut', '-composite', ')', '-compose', 'Over', '-composite');
  }
  // Mask icons are alpha-only (tinted at runtime), so they render white.
  magick(...layers, '-filter', 'Lanczos', '-resize', `${W}x${H}!`, dst);
  return dst;
}

function svgBox(file) {
  const t = readFileSync(file, 'utf8');
  const vb = /viewBox="([\d.\s-]+)"/.exec(t)[1].trim().split(/\s+/).map(Number);
  return { w: vb[2], h: vb[3] };
}

// ── theme glyphs ─────────────────────────────────────────────────────────
function themes() {
  const src = path.join(DESIGN, 'themes');
  const root = cleanDir(path.join(OUT, 'themes'));
  let before = 0, after = 0, n = 0;
  for (const f of readdirSync(src)) {
    if (f.endsWith('.svg')) {
      const t = readFileSync(path.join(src, f), 'utf8'), clean = stripSvg(t);
      if (/c2pa|<metadata/i.test(clean)) throw new Error(`metadata left in ${f}`);
      writeFileSync(path.join(root, f), clean);
      before += t.length; after += clean.length; n++;
    } else if (f === 'CREDITS.md') {
      copyFileSync(path.join(src, f), path.join(root, f));
    }
  }
  log(`themes: ${n} svgs, ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB, CREDITS.md kept`);
}

// ── surfaces: avatar disc, page background ───────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;

/** Bilinear sample of an RGBA image with wrap-around (for tiled textures). */
function sampleWrap(img, x, y) {
  const { w, h, data } = img;
  const fx = ((x % w) + w) % w, fy = ((y % h) + h) % h;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const x1 = (x0 + 1) % w, y1 = (y0 + 1) % h;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const p = (xx, yy) => data[(yy * w + xx) * 4 + c] / 255;
    out[c] = lerp(lerp(p(x0, y0), p(x1, y0), tx), lerp(p(x0, y1), p(x1, y1), tx), ty);
  }
  return out;
}

// .eos-avatar baked for a 60 pt disc at 4 px/pt. The two box-shadow rings
// (1 px dark, 1 px faint light) sit outside the disc, so the 256 px image is
// the disc plus 2 pt on each side: render it at (size + 4) with a −2 margin.
// The outer drop shadow (0 3px 8px rgba(17,15,17,.45)) is left to RN
// boxShadow, and the initials to Text, as the inventory recommends.
export const AVATAR = { refSize: 60, ring: 2, pxPerPt: 4 };

function avatar(root) {
  const { refSize, ring, pxPerPt: k } = AVATAR;
  const N = (refSize + 2 * ring) * k, c = N / 2, R = (refSize * k) / 2;
  const tex = readRGBA(path.join(DESIGN, 'textures', 'slate.jpg'));
  const cv = new Canvas(N, N);
  const box = (v) => v - (c - R); // canvas px → disc box px
  // Texture: 220 CSS px tiles, centred in the disc box.
  const tile = 220 * k, texScale = tex.w / tile;
  const insetTop = new Float64Array(N * N), outside = new Float64Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const bx = box(x + 0.5), by = box(y + 0.5);
      const [r, g, b] = sampleWrap(tex, (bx - R + tile / 2) * texScale, (by - R + tile / 2) * texScale);
      cv.px.set([r, g, b, 1], i * 4);
      // linear-gradient(rgba(74,72,80,.35), rgba(23,21,25,.35)) top → bottom
      const t = Math.max(0, Math.min(1, by / (2 * R)));
      cv.over(i, lerp(74, 23, t) / 255, lerp(72, 21, t) / 255, lerp(80, 25, t) / 255, 0.35);
      // radial-gradient(circle at 35% 28%, rgba(255,255,254,.12), transparent 60%), farthest-corner
      const hx = 0.35 * 2 * R, hy = 0.28 * 2 * R, far = Math.hypot(2 * R - hx, 2 * R - hy);
      const u = Math.hypot(bx - hx, by - hy) / (far * 0.6);
      cv.over(i, 1, 1, 254 / 255, 0.12 * Math.max(0, 1 - u));
      const cov = discCoverage(x, y, c, c, R);
      // inset 0 1px 0: the disc minus itself shifted down 1 pt
      insetTop[i] = cov * (1 - discCoverage(x, y - k, c, c, R));
      // inset 0 -2px 4px: the outside shape shifted up 2 pt, blurred (σ = 2 pt)
      outside[i] = 1 - discCoverage(x, y + 2 * k, c, c, R);
    }
  }
  const shade = gaussian(outside, N, N, 2 * k);
  for (let i = 0; i < N * N; i++) {
    cv.over(i, 17 / 255, 15 / 255, 17 / 255, 0.55 * shade[i]);
    cv.over(i, 1, 1, 254 / 255, 0.16 * insetTop[i]);
  }
  // Clip to the disc, then draw the rings behind it.
  const out = new Canvas(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const inDisc = discCoverage(x, y, c, c, R);
      const ring1 = discCoverage(x, y, c, c, R + k) - inDisc;
      // The 2 px spread lies under the 1 px one, so it spans both rings.
      const ring2 = discCoverage(x, y, c, c, R + 2 * k) - inDisc;
      out.over(i, 1, 1, 254 / 255, 0.06 * ring2);
      out.over(i, 17 / 255, 15 / 255, 17 / 255, 0.65 * ring1);
      const p = cv.px;
      out.over(i, p[i * 4], p[i * 4 + 1], p[i * 4 + 2], inDisc);
    }
  }
  writePNG(out.toRGBA(), path.join(root, 'avatar-disc.png'));
}

// .app-shell background over --eos-ink:
//   radial-gradient(900px 520px at 50% -12%, ember 7%, transparent 62%)   (scrolls)
//   radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(10,8,12,.23) 100%) (fixed)
// The vignette is all percentages, so one image stretched to the screen is
// exact. The glow has fixed px radii; its centre is −12% of the page
// height, taken here as a 932 pt viewport (the tallest iPhone).
export const BACKGROUND = { refW: 430, refH: 932, scale: 2, glowH: 260 };
const EMBER = hex('#a64241');
const INK = hex(STONE);

function vignetteAlpha(x, y, W, H) {
  // ellipse farthest-corner at (50%, 45%), closest-side aspect ratio
  const cx = 0.5 * W, cy = 0.45 * H;
  const ry = Math.hypot(0.45 * H, 0.55 * H), rx = ((0.5 * W) / (0.45 * H)) * ry;
  const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
  return 0.23 * Math.max(0, Math.min(1, (d - 0.55) / 0.45));
}

function glowAlpha(x, y, W, H) {
  const cx = 0.5 * W, cy = -0.12 * H;
  const d = Math.hypot((x - cx) / 900, (y - cy) / 520);
  return 0.07 * Math.max(0, 1 - d / 0.62);
}

function background(root) {
  const { refW: W, refH: H, scale: s, glowH } = BACKGROUND;
  const w = W * s, h = H * s;
  const vig = new Canvas(w, h), full = new Canvas(w, h).fill(...INK.map((v) => v / 255), 1);
  const glow = new Canvas(w, Math.round(glowH * s));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x, X = (x + 0.5) / s, Y = (y + 0.5) / s;
      const va = vignetteAlpha(X, Y, W, H), ga = glowAlpha(X, Y, W, H);
      vig.over(i, 10 / 255, 8 / 255, 12 / 255, va);
      if (y < glow.h) glow.over(i, ...EMBER.map((v) => v / 255), ga);
      full.over(i, 10 / 255, 8 / 255, 12 / 255, va);
      full.over(i, ...EMBER.map((v) => v / 255), ga);
    }
  }
  writePNG(vig.toRGBA(), path.join(root, 'vignette.png'));
  writePNG(glow.toRGBA(), path.join(root, 'top-glow.png'));
  writePNG(full.toRGBA(), path.join(root, 'background.png'), { opaque: true });
}

function surfaces() {
  const root = cleanDir(path.join(OUT, 'surfaces'));
  avatar(root);
  background(root);
  log('surfaces: avatar-disc, vignette, top-glow, background');
}

// ── app icon, adaptive icon, splash ──────────────────────────────────────
// src/app/icon.png is the knight on a light paper ground. The knight is cut
// out (dark pixels, plus the red eyes enclosed by them) and set on stone with
// the Logo component's ember glow, so every launcher surface is dark.
const LOGO_GLOW = [
  [0, [201, 81, 70, 0.42]], [0.18, [166, 66, 65, 0.26]], [0.36, [133, 48, 49, 0.14]],
  [0.54, [96, 35, 39, 0.06]], [0.72, [96, 35, 39, 0]],
];

function glowAt(t) {
  if (t >= LOGO_GLOW.at(-1)[0]) return [0, 0, 0, 0];
  for (let k = 1; k < LOGO_GLOW.length; k++) {
    const [t1, c1] = LOGO_GLOW[k];
    if (t <= t1) {
      const [t0, c0] = LOGO_GLOW[k - 1], u = (t - t0) / (t1 - t0);
      // CSS interpolates in premultiplied space
      const a = lerp(c0[3], c1[3], u);
      const rgb = [0, 1, 2].map((j) => (a > 0 ? lerp(c0[j] * c0[3], c1[j] * c1[3], u) / a : 0));
      return [...rgb, a];
    }
  }
  return [0, 0, 0, 0];
}

function knightCutout(tmp) {
  const src = path.join(WEB, 'src/app/icon.png');
  // Hard mask: dark pixels or saturated (red) ones, then fill enclosed holes
  // (the eyes) by flood-filling the exterior from a corner.
  const hard = path.join(tmp, 'hard.png');
  magick(
    src, '(', '+clone', '-colorspace', 'gray', '-threshold', '35%', '-negate', ')',
    '(', src.toString(), '-colorspace', 'HSL', '-channel', 'S', '-separate', '+channel', '-threshold', '45%', ')',
    '-delete', '0', '-compose', 'lighten', '-composite',
    '-fill', 'red', '-draw', 'color 0,0 floodfill', '-fill', 'white', '+opaque', 'red', '-fill', 'black', '-opaque', 'red',
    '-alpha', 'off', '-colorspace', 'gray', hard,
  );
  const inner = path.join(tmp, 'inner.png'), near = path.join(tmp, 'near.png');
  magick(hard, '-morphology', 'Erode', 'Disk:2', inner);
  magick(hard, '-morphology', 'Dilate', 'Disk:3', near);
  const img = readRGBA(src), I = readRGBA(inner), Nr = readRGBA(near);
  const { w, h, data } = img;
  const PAPER = 228, KNIGHT = [28, 28, 29];
  const out = new Uint8Array(w * h * 4);
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let i = 0; i < w * h; i++) {
    const k = i * 4;
    const L = 0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2];
    const mx = Math.max(data[k], data[k + 1], data[k + 2]), mn = Math.min(data[k], data[k + 1], data[k + 2]);
    let rgb = KNIGHT, a = 0;
    // Red (eyes) keeps its colour. Everything else is ink over paper: unmix
    // it into black + alpha, so paper-coloured negative space inside the
    // head (the tear marks under the eyes) stays negative space on stone.
    if (I.data[k] > 127 && mx - mn > 60) { rgb = [data[k], data[k + 1], data[k + 2]]; a = 1; }
    else if (Nr.data[k] > 127) a = Math.max(0, Math.min(1, (PAPER - L) / (PAPER - KNIGHT[0])));
    out.set([...rgb, Math.round(a * 255)], k);
    if (a > 0.5) {
      const x = i % w, y = (i / w) | 0;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  const cut = path.join(tmp, 'knight.png');
  writePNG({ w, h, data: out }, cut);
  return { file: cut, w, h, box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
}

/**
 * Render one launcher image: the knight scaled so its height is `knightH` of
 * the canvas, centred, over the ember glow (sized like <Logo glow> for a
 * logo box of the knight's height) and an optional stone ground.
 */
function launcher(knight, tmp, N, knightH, { ground = true, glow = true, mono = false, figure = true } = {}) {
  const scale = (knightH * N) / knight.box.h;
  const kw = Math.round(knight.w * scale), kh = Math.round(knight.h * scale);
  const ox = Math.round(N / 2 - (knight.box.x + knight.box.w / 2) * scale);
  const oy = Math.round(N / 2 - (knight.box.y + knight.box.h / 2) * scale);
  const placed = path.join(tmp, `placed-${N}-${knightH}.png`);
  magick('-size', `${N}x${N}`, 'xc:none', '(', knight.file, '-filter', 'Lanczos', '-resize', `${kw}x${kh}!`, ')',
    '-geometry', `${ox >= 0 ? '+' : ''}${ox}${oy >= 0 ? '+' : ''}${oy}`, '-compose', 'over', '-composite', placed);
  const K = readRGBA(placed);
  const cv = new Canvas(N, N);
  if (ground) cv.fill(...INK.map((v) => v / 255), 1);
  // <Logo glow>: a circle 2.8 × size, farthest-corner gradient (r = 1.4√2 size).
  const logo = knightH * N, R = 1.4 * Math.SQRT2 * logo;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x, k = i * 4;
      if (glow) {
        const [r, g, b, a] = glowAt(Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / R);
        cv.over(i, r / 255, g / 255, b / 255, a);
      }
      const a = figure ? K.data[k + 3] / 255 : 0;
      if (mono) cv.over(i, 1, 1, 1, a);
      else cv.over(i, K.data[k] / 255, K.data[k + 1] / 255, K.data[k + 2] / 255, a);
    }
  }
  return cv.toRGBA();
}

function appicon() {
  const root = ensureDir(path.join(OUT, 'images'));
  const tmp = tempDir();
  const knight = knightCutout(tmp);
  // iOS: opaque 1024, knight at the height it has in icon.png (68%).
  const iosH = Math.round((knight.box.h / knight.h) * 100) / 100;
  writePNG(launcher(knight, tmp, 1024, iosH), path.join(root, 'icon.png'), { opaque: true });
  // Android adaptive (108 dp canvas, 66 dp safe circle): knight at 52%.
  writePNG(launcher(knight, tmp, 1024, 0.52, { ground: false, glow: false }), path.join(root, 'android-icon-foreground.png'));
  writePNG(launcher(knight, tmp, 1024, 0.52, { figure: false }), path.join(root, 'android-icon-background.png'), { opaque: true });
  writePNG(launcher(knight, tmp, 1024, 0.52, { ground: false, glow: false, mono: true }), path.join(root, 'android-icon-monochrome.png'));
  // Splash: transparent, knight + glow, shown on the stone splash background.
  // Unlike the opaque icons, nothing may be cut at the canvas edge (a faint
  // red square would show on the stone), so the canvas is <Logo glow>'s own
  // 2.8 × size span: the glow has faded out by its inscribed circle.
  writePNG(launcher(knight, tmp, 1024, 1 / 2.8, { ground: false }), path.join(root, 'splash-icon.png'));
  rmSync(tmp, { recursive: true, force: true });
  log(`appicon: icon (knight ${Math.round(iosH * 100)}%), adaptive fg/bg/mono, splash`);
}

const STAGES = { pieces, board, plates, textures, icons, themes, surfaces, appicon };

const want = process.argv.slice(2);
for (const name of want.length ? want : Object.keys(STAGES)) {
  if (!STAGES[name]) throw new Error(`unknown stage ${name}; one of ${Object.keys(STAGES).join(', ')}`);
  STAGES[name]();
}

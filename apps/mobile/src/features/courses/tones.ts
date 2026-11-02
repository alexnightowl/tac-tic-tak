import { control, eos, tone } from '@tac/core/tokens';

import { courseColor, courseTint } from '@/features/learn/courseColor';

// Every colour a course screen derives from the course colour (data, a
// `#rrggbb` from the API; DECISIONS D28). Tints are alpha suffixes
// (learn/courseColor). The light inks the canvas draws on dark ground
// (label #d8847c, glyph #f0c9bf, chip #e39b93 for the ember course) are
// the colour lifted in HSL; the ember course gets the canvas tokens
// exactly, any other course the same lift of its own hue.

export type CourseTones = {
  color: string;
  tint: (a: number) => string;
  /** Kicker / label text on dark (ember: tone.rose). */
  ink: string;
  /** Theme glyph on a course-tinted tile (ember: tone.blush). */
  glyph: string;
  /** Cycle chip text (ember: tone.roseSoft). */
  chip: string;
  /** Progress bar gradient, deep → colour (ember: control.rankProgress). */
  bar: readonly [string, string];
  /** Medal / wax seal radial: highlight → colour → shadow (ember: tone.medalEmber). */
  seal: readonly [string, string, string];
};

const cache = new Map<string, CourseTones>();

export function courseTones(raw: string | null | undefined): CourseTones {
  const color = courseColor(raw, eos.ember);
  const hit = cache.get(color);
  if (hit) return hit;
  const tint = (a: number) => courseTint(color, a);
  let out: CourseTones;
  if (color.toLowerCase() === eos.ember) {
    out = { color, tint, ink: tone.rose, glyph: tone.blush, chip: tone.roseSoft, bar: control.rankProgress, seal: tone.medalEmber };
  } else {
    const [h, s, l] = toHsl(color);
    const lift = (to: number, sat: number) => fromHsl(h, Math.min(1, Math.max(s, sat * Math.min(1, s * 3))), Math.max(l, to));
    out = {
      color,
      tint,
      ink: lift(0.67, 0.55),
      glyph: lift(0.85, 0.6),
      chip: lift(0.73, 0.6),
      bar: [fromHsl(h, s, l * 0.75), color],
      seal: [fromHsl(h, s, Math.min(0.9, l * 1.16)), fromHsl(h, s, l * 0.86), fromHsl(h, s, l * 0.55)],
    };
  }
  cache.set(color, out);
  return out;
}

function toHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    const v = u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${ch(h + 1 / 3)}${ch(h)}${ch(h - 1 / 3)}`;
}

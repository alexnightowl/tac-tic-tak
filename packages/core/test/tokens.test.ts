import { describe, expect, it } from 'vitest';
import {
  ANIMATION_MS, colors, countTo, easing, emToPx, eos, keyframes, mixed, semantic,
  shadows, text, timing,
} from '../src/tokens';

const HEX = /^#[0-9a-f]{6}$/;
const RGBA = /^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,(0|1|0?\.\d+))?\)$/;

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
/** color-mix(in srgb, a p%, b) for opaque a and b. */
function mixOpaque(a: string, p: number, b: string): string {
  const A = rgb(a), B = rgb(b);
  const c = A.map((v, i) => Math.round(v * p + B[i] * (1 - p)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
/** color-mix(in srgb, a p%, transparent): premultiplied → a at alpha p. */
function mixTransparent(a: string, p: number): string {
  return `rgba(${rgb(a).join(',')},${p})`;
}

function walk(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string' && (v.startsWith('#') || v.startsWith('rgb'))) out.push(v);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x, out);
  return out;
}

describe('colours', () => {
  it('every colour literal is a valid hex or rgba', () => {
    const all = walk(colors);
    expect(all.length).toBeGreaterThan(100);
    for (const c of all) expect(HEX.test(c) || RGBA.test(c), c).toBe(true);
  });

  it('color-mix() surfaces are baked correctly', () => {
    expect(semantic.accentSoft).toBe(mixTransparent(eos.ember, 0.18));
    expect(semantic.accentWeak).toBe(mixTransparent(eos.ember, 0.08));
    expect(mixed.shellGlow).toBe(mixTransparent(eos.ember, 0.07));
    expect(mixed.heat1).toBe(mixTransparent(eos.ember, 0.22));
    expect(mixed.heat2).toBe(mixTransparent(eos.ember, 0.45));
    expect(mixed.heat3).toBe(mixTransparent(eos.ember, 0.7));
    expect(mixed.heroViolet22).toBe(mixTransparent('#6a6be0', 0.22));
    // The design v2 canvas keeps the play-setup dock baked from the web
    // ember (#a64241), even though its flat ember moved to #8e4542.
    expect(mixed.ctaDockBottom).toBe(mixOpaque('#a64241', 0.1, eos.ink));
    expect(mixed.ctaDockMid).toBe(mixOpaque('#a64241', 0.06, eos.ink));
    expect(mixed.ctaDockFade).toBe(mixTransparent(eos.ink, 0.75));
  });

  it('board uses the rendered highlight blue', () => {
    expect(colors.board.selected).toBe('rgba(47,95,158,0.45)');
    expect(colors.board.lastMove).toBe('rgba(47,95,158,0.35)');
  });
});

describe('type scale', () => {
  it('converts em letter-spacing to px per size', () => {
    expect(emToPx(15, 0.1)).toBe(1.5);
    expect(text.label.letterSpacing).toBe(1.32);
    expect(text.eyebrow.letterSpacing).toBe(1.92);
    expect(text.plateLabelSm.letterSpacing).toBe(1.3);
    expect(text.title.letterSpacing).toBe(0.44);
    expect(text.turnTitle.letterSpacing).toBe(0.45);
  });
});

describe('shadows', () => {
  it('are RN boxShadow-shaped objects', () => {
    for (const list of Object.values(shadows)) {
      for (const s of list) {
        expect(typeof s.offsetX).toBe('number');
        expect(typeof s.blurRadius).toBe('number');
        expect(typeof s.spreadDistance).toBe('number');
        expect(RGBA.test(s.color) || HEX.test(s.color)).toBe(true);
      }
    }
  });
});

describe('motion', () => {
  it('matches the web constants', () => {
    expect(ANIMATION_MS).toEqual({ instant: 0, fast: 160, normal: 280, slow: 460 });
    expect([timing.nextAfterCorrect, timing.nextAfterWrong]).toEqual([220, 360]);
    expect([timing.feedback, timing.reset, timing.solvedPause]).toEqual([500, 520, 1000]);
    expect(countTo).toEqual({ delay: 350, duration: 900 });
  });

  it('every easing is a 4-tuple with x in [0,1]', () => {
    const all = [...Object.values(easing), ...Object.values(keyframes).map((k) => k.easing)];
    for (const b of all) {
      expect(b).toHaveLength(4);
      expect(b[0]).toBeGreaterThanOrEqual(0);
      expect(b[0]).toBeLessThanOrEqual(1);
      expect(b[2]).toBeGreaterThanOrEqual(0);
      expect(b[2]).toBeLessThanOrEqual(1);
    }
  });
});

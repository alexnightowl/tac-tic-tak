import { describe, expect, it } from 'vitest';
import {
  KNOWN_THEME_SLUGS, LICHESS_THEME_ICON_KEYS, META_THEME_SLUGS, THEME_ICON_FALLBACK_KEY,
  isMetaTheme, resolveThemeIconKey, themeLabel,
} from '../src/themes';

// Vite's glob (vitest runtime) lists the web's glyph files without Node types.
const GLYPHS = (import.meta as unknown as { glob(p: string): Record<string, unknown> })
  .glob('../../../apps/frontend/public/design/themes/*.svg');

describe('theme labels', () => {
  it('translates, falls back to en, then to spaced camelCase', () => {
    expect(themeLabel('fork')).toBe('Fork');
    expect(themeLabel('fork', 'uk')).toBe('Вилка');
    expect(themeLabel('backRankMate', 'uk')).toBe('Мат по останній горизонталі');
    expect(themeLabel('someNewTheme', 'uk')).toBe('Some New Theme');
    // Dataset slugs the web never labelled.
    expect(themeLabel('discoveredCheck')).toBe('Discovered check');
    expect(themeLabel('clearance', 'uk')).toBe('Звільнення');
  });

  it('meta slugs', () => {
    expect(isMetaTheme('middlegame')).toBe(true);
    expect(isMetaTheme('puzzle')).toBe(true);
    expect(isMetaTheme('fork')).toBe(false);
    expect(META_THEME_SLUGS.size).toBe(15);
  });

  it('known slugs exclude meta slugs', () => {
    expect(KNOWN_THEME_SLUGS).toContain('fork');
    expect(KNOWN_THEME_SLUGS).toContain('mateIn2');
    expect(KNOWN_THEME_SLUGS.some(isMetaTheme)).toBe(false);
    expect(KNOWN_THEME_SLUGS).toHaveLength(47);
  });
});

describe('theme icons', () => {
  it('resolves glyph keys', () => {
    expect(resolveThemeIconKey('fork')).toBe('fork');
    expect(resolveThemeIconKey('mateIn3')).toBe('mate');
    expect(resolveThemeIconKey('mate')).toBe('mate');
    expect(resolveThemeIconKey('opening')).toBe(THEME_ICON_FALLBACK_KEY);
  });

  it('every glyph key has an SVG on the web', () => {
    const files = new Set(Object.keys(GLYPHS).map((p) => p.split('/').pop()!.slice(0, -4)));
    expect(files.size).toBeGreaterThan(0);
    for (const k of LICHESS_THEME_ICON_KEYS) expect(files.has(k), k).toBe(true);
  });
});

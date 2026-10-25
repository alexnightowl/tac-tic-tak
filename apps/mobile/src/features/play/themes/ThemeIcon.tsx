import { resolveThemeIconKey, THEME_GLYPH_SCALE, THEME_ICON_FALLBACK_KEY } from '@tac/core/themes';
import { Puzzle } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';

import { THEME_GLYPHS } from './glyphs';

/**
 * Puzzle-theme glyph (web lib/theme-icons.ts): the Lichess icon for the
 * slug, tinted through currentColor, else lucide Puzzle. Lichess glyphs
 * carry little padding, so they draw ~20 % larger, like the web.
 */
export function ThemeIcon({ slug, size, color }: { slug: string; size: number; color: string }) {
  const key = resolveThemeIconKey(slug);
  const xml = key === THEME_ICON_FALLBACK_KEY ? undefined : THEME_GLYPHS[key];
  if (!xml) return <Puzzle size={size} color={color} strokeWidth={1.75} />;
  const s = Math.round(size * THEME_GLYPH_SCALE);
  return <SvgXml xml={xml} width={s} height={s} color={color} />;
}

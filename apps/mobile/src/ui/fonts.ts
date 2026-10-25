import type { Language } from '@tac/core/i18n';
import { fontFamilies, type FontRole, type FontWeight } from '@tac/core/tokens';

/**
 * Cyrillic display candidates for `uk` (Cinzel has no Cyrillic). The owner
 * picks one from /dev/typography (PLAN §8 #2); the losers are dropped from
 * assets and app.config. Each maps a requested weight to an embedded face;
 * Forum and Prata ship a single Regular, so every weight resolves to it.
 */
export const UK_DISPLAY_CANDIDATES = {
  forum: { label: 'Forum', faces: { 500: 'Forum', 600: 'Forum', 700: 'Forum' } },
  cormorant: {
    label: 'Cormorant SC',
    faces: { 500: 'CormorantSC-Medium', 600: 'CormorantSC-SemiBold', 700: 'CormorantSC-Bold' },
  },
  prata: { label: 'Prata', faces: { 500: 'Prata-Regular', 600: 'Prata-Regular', 700: 'Prata-Regular' } },
} as const;

export type UkDisplayCandidate = keyof typeof UK_DISPLAY_CANDIDATES;

/** PROVISIONAL (PLAN §8 #2): Forum until the owner chooses. */
export const UK_DISPLAY_DEFAULT: UkDisplayCandidate = 'forum';

/** 'display' = the serif face (titles, plates, numbers); 'body' = Manrope. */
export type FontUse = 'display' | 'body';

function serifWeight(weight: FontWeight): 500 | 600 | 700 {
  return weight <= 500 ? 500 : weight === 600 ? 600 : 700;
}

/**
 * One family string per (language, role, weight): Android ignores
 * fontWeight on custom fonts, so the weight is baked into the face name.
 */
export function fontFamily(
  lang: Language,
  role: FontUse | FontRole,
  weight: FontWeight = 700,
  ukDisplay: UkDisplayCandidate = UK_DISPLAY_DEFAULT,
): string {
  if (role === 'display' || role === 'serif') {
    const w = serifWeight(weight);
    return lang === 'uk' ? UK_DISPLAY_CANDIDATES[ukDisplay].faces[w] : fontFamilies.serif[w];
  }
  return fontFamilies.sans[weight];
}

const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * The face a user-typed name is set in: by its glyphs, not the UI language
 * (a Latin nickname keeps Cinzel in uk; a Cyrillic one needs the uk face).
 */
export function scriptLang(text: string): Language {
  return CYRILLIC.test(text) ? 'uk' : 'en';
}

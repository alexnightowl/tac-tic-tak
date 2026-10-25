// Type scale. Web letter-spacing is in em; RN wants px, so each variant
// bakes `em * fontSize`. Line heights are px too.

/** em → px letter-spacing at a given font size (2-decimal precision). */
export function emToPx(fontSize: number, em: number): number {
  return Math.round(fontSize * em * 100) / 100;
}

export type FontRole = 'sans' | 'serif';
export type FontWeight = 400 | 500 | 600 | 700 | 800;

/**
 * One family per weight (Android ignores fontWeight on custom fonts). Each
 * name is the font's PostScript name, which is also its file name in
 * apps/mobile/assets/fonts — iOS resolves the former, Android the latter,
 * so one string works on both. Cinzel has no Cyrillic; the uk display face
 * is an open owner decision (PLAN §2.5), so it is not listed here.
 */
export const fontFamilies = {
  sans: {
    400: 'Manrope-Regular',
    500: 'Manrope-Medium',
    600: 'Manrope-SemiBold',
    700: 'Manrope-Bold',
    800: 'Manrope-ExtraBold',
  },
  serif: {
    500: 'Cinzel-Medium',
    600: 'Cinzel-SemiBold',
    700: 'Cinzel-Bold',
  },
} as const;

/** Tailwind text-* sizes [fontSize, lineHeight]. */
export const fontSize = {
  '2xs': [10, 14], // text-[10px]
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  '2xl': [24, 32],
  '3xl': [30, 36],
  '4xl': [36, 40],
} as const;

/** Tailwind tracking-* in em, for ad-hoc conversions with emToPx. */
export const trackingEm = {
  tight: -0.025,
  normal: 0,
  wide: 0.025,
  wider: 0.05,
  widest: 0.1,
  serifDisplay: 0.02, // .font-serif-display, app h1/h2
  sectionLabel: 0.12, // uppercase h2/h3 in the app shell
} as const;

export type TextVariant = {
  role: FontRole;
  weight: FontWeight;
  fontSize: number;
  lineHeight?: number;
  letterSpacing: number;
  uppercase?: boolean;
  tabular?: boolean;
  /** Dynamic Type cap for text that sits in fixed-size chrome. */
  maxFontSizeMultiplier?: number;
};

function v(
  role: FontRole, weight: FontWeight, fontSize: number, em: number,
  extra: Partial<Omit<TextVariant, 'role' | 'weight' | 'fontSize' | 'letterSpacing'>> = {},
): TextVariant {
  return { role, weight, fontSize, letterSpacing: emToPx(fontSize, em), ...extra };
}

/** AppText variants (PLAN §2.5). Sources noted per line. */
export const text = {
  /** Landing hero h1: font-serif 44px bold, leading 1.05, no tracking. */
  display: v('serif', 700, 44, 0, { lineHeight: 46, maxFontSizeMultiplier: 1.2 }),
  /** SectionTitle: Cinzel 700 34px, leading 1.12. */
  sectionTitle: v('serif', 700, 34, 0, { lineHeight: 38, maxFontSizeMultiplier: 1.2 }),
  /** Page h1/h2: Cinzel 700 22px, 0.02em (app-shell heading rule). */
  title: v('serif', 700, 22, 0.02, { maxFontSizeMultiplier: 1.3 }),
  /** Uppercase h2/h3 section labels: Manrope 700 12px, 0.12em. */
  sectionLabel: v('sans', 700, 12, 0.12, { uppercase: true }),
  /** Plate buttons: Cinzel 700 uppercase 0.1em at 13/14/15px. */
  plateLabelSm: v('serif', 700, 13, 0.1, { uppercase: true, maxFontSizeMultiplier: 1.2 }),
  plateLabel: v('serif', 700, 14, 0.1, { uppercase: true, maxFontSizeMultiplier: 1.2 }),
  plateLabelLg: v('serif', 700, 15, 0.1, { uppercase: true, maxFontSizeMultiplier: 1.2 }),
  /** Eyebrow: Manrope 800 12px uppercase 0.16em, ember. */
  eyebrow: v('sans', 800, 12, 0.16, { uppercase: true }),
  /** CardTitle: Manrope 700 11px uppercase 0.12em, ash. */
  label: v('sans', 700, 11, 0.12, { uppercase: true }),
  /** CardValue: 24px 800 tabular-nums. */
  value: v('sans', 800, 24, 0, { lineHeight: 32, tabular: true }),
  /** Runner timer pill: Manrope 800 text-xl tabular-nums. */
  timer: v('sans', 800, 20, 0, { lineHeight: 28, tabular: true, maxFontSizeMultiplier: 1.2 }),
  /** Body copy (text-sm). */
  body: v('sans', 400, 14, 0, { lineHeight: 20 }),
  /** Input text: 15px 500. */
  input: v('sans', 500, 15, 0),
  /** Captions / meta (text-xs). */
  caption: v('sans', 400, 12, 0, { lineHeight: 16 }),
  /** Segmented tabs: bold 12 (sm) / 14 (md). */
  segmentedSm: v('sans', 700, 12, 0),
  segmented: v('sans', 700, 14, 0),
  /** TurnCard title: serif 15px bold 0.03em; subtitle 12px ash. */
  turnTitle: v('serif', 700, 15, 0.03, { maxFontSizeMultiplier: 1.2 }),
  turnSubtitle: v('sans', 400, 12, 0, { maxFontSizeMultiplier: 1.2 }),
  /** Board coordinates: 10px bold on web; mobile scales to sq*0.2. */
  boardCoord: v('sans', 700, 10, 0, { maxFontSizeMultiplier: 1 }),
} as const satisfies Record<string, TextVariant>;

/** Board coordinate size relative to the square (PLAN §2.6). */
export const BOARD_COORD_SCALE = 0.2;

/** Logo wordmark 'tac·tic·tak': Cinzel 700, 0.04em, fontSize = size * 0.6. */
export function wordmark(size: number): TextVariant {
  return v('serif', 700, size * 0.6, 0.04);
}

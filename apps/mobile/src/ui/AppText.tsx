import type { Language } from '@tac/core/i18n';
import { eos, text, tone, type TextVariant } from '@tac/core/tokens';
import type { ColorValue, TextProps, TextStyle } from 'react-native';
import { Text } from 'react-native';

import { fontFamily, type UkDisplayCandidate } from './fonts';
import { useLang } from './lang';

export type TextVariantName = keyof typeof text;

/** Default ink per variant (web: eyebrow ember, CardTitle/caption ash). */
const DEFAULT_COLOR: Partial<Record<TextVariantName, ColorValue>> = {
  eyebrow: eos.ember,
  kicker: tone.rose,
  label: eos.ash,
  sectionLabel: eos.ash,
  caption: eos.ash,
  turnSubtitle: eos.ash,
  chip: eos.ash,
};

const cache = new Map<string, TextStyle>();

/**
 * Resolved style for a variant in a language. Cached per key so every
 * AppText of a variant shares one object (no per-render style churn).
 * Exported for TextInput and Animated.Text, which can't wrap AppText.
 */
export function textStyle(
  variant: TextVariantName,
  lang: Language,
  ukDisplay?: UkDisplayCandidate,
): TextStyle {
  const key = `${variant}|${lang}|${ukDisplay ?? ''}`;
  let s = cache.get(key);
  if (!s) {
    const v: TextVariant = text[variant];
    s = {
      fontFamily: fontFamily(lang, v.role, v.weight, ukDisplay),
      fontSize: v.fontSize,
      letterSpacing: v.letterSpacing,
      color: DEFAULT_COLOR[variant] ?? eos.bone,
      ...(v.lineHeight ? { lineHeight: v.lineHeight } : null),
      ...(v.uppercase ? { textTransform: 'uppercase' as const } : null),
      ...(v.tabular ? { fontVariant: ['tabular-nums' as const] } : null),
    };
    cache.set(key, s);
  }
  return s;
}

export function maxScale(variant: TextVariantName): number | undefined {
  return (text[variant] as TextVariant).maxFontSizeMultiplier;
}

export type AppTextProps = TextProps & {
  variant?: TextVariantName;
  color?: ColorValue;
  /** Override the language (the typography sheet renders both side by side). */
  lang?: Language;
  /** Override the uk display candidate (typography sheet only). */
  ukDisplay?: UkDisplayCandidate;
};

export function AppText({ variant = 'body', color, lang, ukDisplay, style, ...rest }: AppTextProps) {
  const ctx = useLang();
  const base = textStyle(variant, lang ?? ctx.lang, ukDisplay ?? ctx.ukDisplay);
  return (
    <Text
      maxFontSizeMultiplier={maxScale(variant)}
      {...rest}
      style={[base, color ? { color } : null, style]}
    />
  );
}

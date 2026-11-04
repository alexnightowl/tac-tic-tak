import type { Language } from '@tac/core/i18n';
import type { text } from '@tac/core/tokens';
import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';

import clsx from 'clsx';
import './kit.css';

export type TextVariantName = keyof typeof text;

/** Default ink per variant, as the app (eyebrow ember, caption ash…). */
const DEFAULT_COLOR: Partial<Record<TextVariantName, string>> = {
  eyebrow: 'var(--eos-ember)',
  kicker: 'var(--tone-rose)',
  label: 'var(--eos-ash)',
  sectionLabel: 'var(--eos-ash)',
  caption: 'var(--eos-ash)',
  turnSubtitle: 'var(--eos-ash)',
  chip: 'var(--eos-ash)',
};

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** The `.tv-*` class of a variant (font, size, line height, tracking, case). */
export function textClass(variant: TextVariantName): string {
  return `tv-${kebab(variant)}`;
}

/** Default colour of a variant as a CSS value. */
export function textColor(variant: TextVariantName): string {
  return DEFAULT_COLOR[variant] ?? 'var(--eos-bone)';
}

export type AppTextProps = Omit<HTMLAttributes<HTMLElement>, 'color'> & {
  variant?: TextVariantName;
  /** Any CSS colour, normally a token variable (`var(--eos-ash)`). */
  color?: string;
  /** Element to render (default `span`). */
  as?: ElementType;
  /** RN numberOfLines: 1 truncates with an ellipsis, more clamps. */
  numberOfLines?: number;
  /** Render in another language's display face (the kit's side-by-side columns). */
  lang?: Language;
  htmlFor?: string;
  testID?: string;
  children?: ReactNode;
};

export function AppText({
  variant = 'body',
  color,
  as: Tag = 'span',
  numberOfLines,
  lang,
  testID,
  className,
  style,
  ...rest
}: AppTextProps) {
  const clamp = numberOfLines && numberOfLines > 1 ? numberOfLines : undefined;
  const merged: CSSProperties = {
    color: color ?? textColor(variant),
    ...(clamp ? { WebkitLineClamp: clamp } : null),
    ...style,
  };
  return (
    <Tag
      {...rest}
      lang={lang}
      data-testid={testID}
      className={clsx(
        'v2-text',
        textClass(variant),
        numberOfLines === 1 && 'v2-trunc',
        clamp && 'v2-clamp',
        lang && 'v2-lang',
        className,
      )}
      style={merged}
    />
  );
}

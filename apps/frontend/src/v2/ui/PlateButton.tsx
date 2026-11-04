'use client';

import { layout } from '@tac/core/tokens';
import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

import { useT } from '@/lib/i18n';
import plates from '../../../public/v2/plates/plates.json';
import { AppText, type TextVariantName } from './AppText';
import { Spinner } from './Buttons';
import { Press } from './Press';
import './kit.css';

export type PlateVariant = 'ember' | 'slate';
export type PlateSize = 'sm' | 'md' | 'lg';

const LABEL: Record<PlateSize, TextVariantName> = { sm: 'plateLabelSm', md: 'plateLabel', lg: 'plateLabelLg' };
/** Web: `px-1.5` inside the border box; callers usually add more. */
const INNER_PAD = 6;
const EXTRA_PAD: Record<PlateSize, number> = { sm: 10, md: 14, lg: 18 };

const url = (variant: PlateVariant, size: PlateSize, part: 'left' | 'mid' | 'right') =>
  `url(/v2/plates/${variant}-${size}-${part}@2x.webp)`;

/**
 * The stone plate as 3 slices: fixed caps and a centre band of n copies of
 * the mid tile, each stretched to midW / n — CSS `background-repeat: round`
 * (the app lays out the same `border-image-repeat: round` by hand). With
 * `tint`, the slices become a mask over that colour: the plate's own
 * silhouette, for the press shade and the disabled veil.
 */
function PlateBackground({
  variant,
  size,
  tint,
  className,
}: {
  variant: PlateVariant;
  size: PlateSize;
  tint?: string;
  className?: string;
}) {
  const cap = plates.sizes[size].capWidth;
  const tile = plates.sizes[size].midTileWidth[variant];
  const slice = (part: 'left' | 'mid' | 'right', w: number | null): CSSProperties => {
    const img = url(variant, size, part);
    const bgSize = `${w ?? tile}px 100%`;
    const repeat = part === 'mid' ? 'round no-repeat' : 'no-repeat';
    const box: CSSProperties = w ? { width: w } : {};
    return tint
      ? {
          ...box,
          backgroundColor: tint,
          maskImage: img,
          maskSize: bgSize,
          maskRepeat: repeat,
          WebkitMaskImage: img,
          WebkitMaskSize: bgSize,
          WebkitMaskRepeat: repeat,
        }
      : { ...box, backgroundImage: img, backgroundSize: bgSize, backgroundRepeat: repeat };
  };
  return (
    <span className={clsx('v2-plate-bg', className)} aria-hidden>
      <span style={slice('left', cap)} />
      <span className="v2-plate-mid" style={slice('mid', null)} />
      <span style={slice('right', cap)} />
    </span>
  );
}

export type PlateButtonProps = {
  label: string;
  onPress?: () => void;
  /** Navigate instead (renders a link styled as the plate). */
  href?: string;
  variant?: PlateVariant;
  size?: PlateSize;
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the parent's width. */
  block?: boolean;
  /** Leading glyph (gap 8), e.g. a 16–18 px icon; it inherits the label colour. */
  icon?: ReactNode;
  /** `submit` inside a form. */
  type?: 'button' | 'submit';
  testID?: string;
  accessibilityLabel?: string;
  className?: string;
  style?: CSSProperties;
  /** Kit page only: start in the held-down state. */
  pressedPreview?: boolean;
};

export function PlateButton({
  label,
  onPress,
  href,
  variant = 'ember',
  size = 'md',
  disabled = false,
  loading = false,
  block = false,
  icon,
  type,
  testID,
  accessibilityLabel,
  className,
  style,
  pressedPreview = false,
}: PlateButtonProps) {
  const t = useT();
  const inactive = disabled || loading;
  const height = layout.plateHeight[size];
  const cap = plates.sizes[size].capWidth;
  const ink = variant === 'ember' ? 'var(--control-plate-text-ember)' : 'var(--control-plate-text-slate)';

  return (
    <Press
      testID={testID}
      onPress={onPress}
      href={href}
      disabled={inactive}
      aria-label={accessibilityLabel}
      aria-busy={loading || undefined}
      data-block={block || undefined}
      className={clsx('v2-plate-btn', pressedPreview && 'is-pressed', className)}
      style={{ height, ...style }}
      type={type}
    >
      <span className="v2-plate" style={{ padding: `0 ${cap + INNER_PAD + EXTRA_PAD[size]}px`, color: ink }}>
        <PlateBackground variant={variant} size={size} />
        <PlateBackground
          variant={variant}
          size={size}
          tint={variant === 'ember' ? 'var(--control-plate-press-ember)' : 'var(--control-plate-press-slate)'}
          className="v2-plate-shade"
        />
        {disabled ? (
          // grayscale(0.6) brightness(0.7) as the app solves it: a slate veil
          // on ember, an ink veil on slate, in the plate's silhouette.
          <PlateBackground
            variant={variant}
            size={size}
            tint={variant === 'ember' ? 'var(--eos-slate)' : 'var(--eos-ink)'}
            className={`v2-plate-veil--${variant}`}
          />
        ) : null}
        {icon && !loading ? (
          <span className="v2-plate-icon" style={disabled ? { opacity: 0.7 } : undefined} aria-hidden>
            {icon}
          </span>
        ) : null}
        <AppText
          variant={LABEL[size]}
          numberOfLines={1}
          color="currentColor"
          className={`v2-plate-label v2-plate-label--${variant}`}
          style={loading || disabled ? { opacity: loading ? 0 : 0.7 } : undefined}
        >
          {label}
        </AppText>
        {loading ? (
          <span className="v2-plate-spin">
            <Spinner color={ink} label={t('ui.loading')} />
          </span>
        ) : null}
      </span>
    </Press>
  );
}

import { radii } from '@tac/core/tokens';
import clsx from 'clsx';
import type { CSSProperties, ReactNode } from 'react';

import './kit.css';

/**
 * Rise-coloured square that holds a glyph (session rows, review themes,
 * profile stats): 36 px radius 8, 40 px radius 10/12, 48 px radius 12.
 * Defaults to radius 8 at 36 and 12 above.
 */
export function IconTile({
  size = 40,
  radius,
  color = 'var(--control-tile)',
  children,
  className,
  style,
}: {
  size?: number;
  radius?: number;
  /** Fill (defaults to rise). */
  color?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const r = radius ?? (size <= 36 ? radii.lg : radii.xl);
  return (
    <span
      className={clsx('v2-tile', className)}
      style={{ width: size, height: size, borderRadius: r, background: color, ...style }}
    >
      {children}
    </span>
  );
}

/**
 * CSS `mask: url(…)` + a fill colour: the image's alpha in one colour (mode
 * icons, nav glyphs). `width` defaults to `size` (the review book is 28 × 24).
 * `source` is a public URL (e.g. `/v2/icons/mode-blitz@2x.webp`).
 */
export function TintIcon({
  source,
  size,
  width,
  color,
  className,
  style,
}: {
  source: string;
  size: number;
  width?: number;
  color: string;
  className?: string;
  style?: CSSProperties;
}) {
  const img = `url(${source})`;
  return (
    <span
      aria-hidden
      className={clsx('v2-tint', className)}
      style={{
        width: width ?? size,
        height: size,
        backgroundColor: color,
        maskImage: img,
        WebkitMaskImage: img,
        ...style,
      }}
    />
  );
}

/**
 * Thin progress bar: rounded rise track (6 px; 5 px in achievements) with a
 * horizontal gradient fill. `value` is 0…1; `colors` are CSS colours,
 * normally token variables (default: the rank ember ramp).
 */
export function ProgressBar({
  value,
  colors = ['var(--control-rank-progress-0)', 'var(--control-rank-progress-1)'],
  height = 6,
  trackColor = 'var(--control-progress-track)',
  label,
  className,
  style,
  testID,
}: {
  value: number;
  colors?: readonly [string, string, ...string[]];
  height?: number;
  trackColor?: string;
  /** Accessible name of the bar. */
  label?: string;
  className?: string;
  style?: CSSProperties;
  testID?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={clsx('v2-progress', className)}
      style={{ height, background: trackColor, ...style }}
      data-testid={testID}
    >
      {v > 0 ? (
        <div
          className="v2-progress-fill"
          style={{ width: `${v * 100}%`, backgroundImage: `linear-gradient(to right, ${colors.join(', ')})` }}
        />
      ) : null}
    </div>
  );
}

/* eslint-disable @next/next/no-img-element -- fixed-size brand mark; next/image adds nothing here */
import type { CSSProperties } from 'react';

import './kit.css';

/** Glow disc diameter and blur in px (the canvas draws it per screen). */
export type LogoGlow = { box: number; blur: number };

/** Tab header (MobRivals / MobStats): 120 px disc around the 32 px logo, blur 5. */
export const HEADER_LOGO_GLOW: LogoGlow = { box: 120, blur: 5 };

/**
 * Brand mark, as the design canvas draws it (Login.dc.html, 128 px logo): a
 * 360 px circle offset −116 px, `radial-gradient(circle at 50% 46%)` to the
 * farthest corner, `blur(14px)`, all scaled with `size`; and
 * `drop-shadow(0 8px 14px …)` on the knight from 64 px up.
 */
export function BrandLogo({
  size,
  glow = true,
  alt = '',
  className,
  style,
}: {
  size: number;
  /**
   * Soft ember glow behind the knight. `true` = the Login proportions
   * (360 / 128 of the logo, blur 14 / 128); an object sets the disc size
   * and blur directly (always centred on the logo).
   */
  glow?: boolean | LogoGlow;
  /** Decorative by default. */
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const k = size / 128;
  const spec = typeof glow === 'object' ? glow : null;
  const box = spec ? spec.box : 360 * k;
  const blur = spec ? spec.blur : 14 * k;
  const offset = (size - box) / 2;
  return (
    <span
      className={className}
      style={{ position: 'relative', display: 'inline-block', flex: 'none', width: size, height: size, ...style }}
    >
      {glow ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: offset,
            top: offset,
            width: box,
            height: box,
            borderRadius: '50%',
            background: 'radial-gradient(circle farthest-corner at 50% 46%, var(--logo-glow))',
            filter: `blur(${blur}px)`,
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <img
        src="/v2/icons/knight-logo@2x.webp"
        srcSet="/v2/icons/knight-logo@2x.webp 2x, /v2/icons/knight-logo@3x.webp 3x"
        width={size}
        height={size}
        alt={alt}
        draggable={false}
        style={{ position: 'relative', display: 'block', filter: size >= 64 ? 'var(--logo-drop)' : undefined }}
      />
    </span>
  );
}

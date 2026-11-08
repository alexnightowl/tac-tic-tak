import { logoGlow } from '@tac/core/tokens';

// The browser draws the design's CSS directly (Login.dc.html): an svg
// feGaussianBlur over a dark gradient bands visibly in Chrome.
const GRADIENT = `radial-gradient(circle farthest-corner at 50% 46%, ${logoGlow
  .map(([o, c]) => `${c} ${Math.round(o * 1000) / 10}%`)
  .join(', ')})`;

type Props = { box: number; blur: number; offset: number };

export function LogoGlowDisc({ box, blur, offset }: Props) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: offset,
        top: offset,
        width: box,
        height: box,
        borderRadius: '50%',
        background: GRADIENT,
        filter: `blur(${blur}px)`,
        pointerEvents: 'none',
      }}
    />
  );
}

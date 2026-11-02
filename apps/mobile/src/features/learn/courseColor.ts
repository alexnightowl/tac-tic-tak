// Course colours are data: a `#rrggbb` string from GET /library/courses
// (DECISIONS D28). Every tint of one is spelled here, as the canvas does
// (`#8e454280` = the colour at 50 %), so screens never hold a hex literal.

import { black } from '@tac/core/tokens';

const HEX = /^#[0-9a-f]{6}$/i;

/** The course colour, or the fallback when the API sends something odd. */
export function courseColor(hex: string | null | undefined, fallback: string): string {
  return hex && HEX.test(hex) ? hex : fallback;
}

/** `#rrggbb` + an alpha suffix (0..1), e.g. courseTint('#8e4542', 0.5) → '#8e454280'. */
export function courseTint(hex: string, a: number): string {
  const base = HEX.test(hex) ? hex : black;
  const byte = Math.round(Math.min(1, Math.max(0, a)) * 255);
  return `${base}${byte.toString(16).padStart(2, '0')}`;
}

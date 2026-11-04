// CSS variables the v2 primitives need beyond tokensCss() (src/v2/tokens.ts):
// shadows, text shadows, transitions, the logo glow and the per-script serif
// stacks. Every value comes from @tac/core/tokens. tailwind.config.ts adds
// them to :root through `addBase`, so kit.css can stay plain CSS. Imported by
// the Tailwind config (jiti), so no `@/` aliases here.
import {
  easing,
  logoGlow,
  shadows,
  textShadows,
  transitions,
  type Bezier,
  type Shadow,
  type TextShadow,
} from '@tac/core/tokens';

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const bezier = (b: Bezier) => `cubic-bezier(${b.join(',')})`;

export function boxShadow(list: readonly Shadow[]): string {
  return list
    .map((s) => `${s.inset ? 'inset ' : ''}${s.offsetX}px ${s.offsetY}px ${s.blurRadius}px ${s.spreadDistance}px ${s.color}`)
    .join(',');
}

export function textShadow(list: readonly TextShadow[]): string {
  return list.map((s) => `${s.offsetX}px ${s.offsetY}px ${s.radius}px ${s.color}`).join(',');
}

/** `{ '--sh-card': '…', '--t-colors': '150ms cubic-bezier(…)', … }` */
export function kitVars(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(shadows)) out[`--sh-${kebab(k)}`] = boxShadow(v);
  for (const [k, v] of Object.entries(textShadows)) out[`--tsh-${kebab(k)}`] = textShadow(v);
  for (const [k, v] of Object.entries(transitions)) {
    out[`--t-${kebab(k)}`] = `${v.duration}ms ${bezier(v.easing)}`;
    out[`--t-${kebab(k)}-d`] = `${v.duration}ms`;
    out[`--t-${kebab(k)}-e`] = bezier(v.easing);
  }
  out['--ease-tw-out'] = bezier(easing.twEaseOut);
  // BrandLogo: radial stops and the knight's drop shadow (filter syntax).
  out['--logo-glow'] = logoGlow.map(([o, c]) => `${c} ${Math.round(o * 1000) / 10}%`).join(',');
  const d = shadows.logo[0];
  out['--logo-drop'] = `drop-shadow(${d.offsetX}px ${d.offsetY}px ${d.blurRadius}px ${d.color})`;
  // Display face per script, for a subtree whose `lang` differs from <html lang>.
  out['--font-serif-latin'] = '"Cinzel", "Cinzel Fallback", serif';
  out['--font-serif-cyrillic'] = '"Forum", serif';
  return out;
}

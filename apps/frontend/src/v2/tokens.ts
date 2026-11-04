// Design v2 tokens as CSS (D31): one palette for the app and the web.
// Every value comes from @tac/core/tokens; the root layout inlines the
// result, so there is no generated file to keep in sync.
import {
  board,
  ceremony,
  control,
  course,
  cover,
  eos,
  feedback,
  layout,
  learn,
  mixed,
  radii,
  semantic,
  space,
  surface,
  text,
  tone,
  type TextVariant,
} from '@tac/core/tokens';

type Tree = { readonly [k: string]: string | number | boolean | Tree | readonly unknown[] };

const kebab = (s: string) =>
  s
    .replace(/\./g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

/** `{ eos: { ink: '#1d1b20' } }` → `--eos-ink:#1d1b20`; arrays become `-0`, `-1`… */
function vars(prefix: string, value: unknown, unit = '', out: string[] = []): string[] {
  if (typeof value === 'string') out.push(`--${prefix}:${value}`);
  else if (typeof value === 'number') out.push(`--${prefix}:${value}${unit}`);
  else if (Array.isArray(value)) value.forEach((v, i) => vars(`${prefix}-${i}`, v, unit, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Tree)) vars(`${prefix}-${kebab(k)}`, v, unit, out);
  }
  return out;
}

const COLORS = { eos, semantic, mixed, surface, control, tone, board, feedback, ceremony, cover, learn, course };

const FONT_STACK = {
  sans: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  serif: '"Cinzel", "Cinzel Fallback", serif',
  /** The app sets display text in Forum for uk (Cinzel has no Cyrillic). */
  serifUk: '"Forum", serif',
};

function textClass(name: string, v: TextVariant): string {
  const rules = [
    `font-family:var(--font-${v.role})`,
    `font-weight:${v.weight}`,
    `font-size:${v.fontSize}px`,
    v.lineHeight ? `line-height:${v.lineHeight}px` : '',
    `letter-spacing:${v.letterSpacing}px`,
    v.uppercase ? 'text-transform:uppercase' : '',
    v.tabular ? 'font-variant-numeric:tabular-nums' : '',
  ].filter(Boolean);
  return `.tv-${kebab(name)}{${rules.join(';')}}`;
}

/** The whole v2 stylesheet: variables on :root, the uk display face, one class per text variant. */
export function tokensCss(): string {
  const decls = [
    ...Object.entries(COLORS).flatMap(([group, tree]) => vars(kebab(group), tree)),
    ...vars('r', radii, 'px'),
    ...vars('s', space, 'px'),
    ...vars('l', layout, 'px'),
    `--font-sans:${FONT_STACK.sans}`,
    `--font-serif:${FONT_STACK.serif}`,
  ];
  return [
    `:root{${decls.join(';')}}`,
    `:root[lang="uk"]{--font-serif:${FONT_STACK.serifUk}}`,
    '@font-face{font-family:"Forum";font-style:normal;font-weight:400 700;font-display:swap;src:url(/v2/fonts/Forum.ttf) format("truetype")}',
    ...Object.entries(text).map(([name, v]) => textClass(name, v)),
  ].join('\n');
}

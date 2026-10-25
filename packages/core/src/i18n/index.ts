// Pure port of apps/frontend/src/lib/i18n.ts (useT/useTn) and
// lib/landingI18n.tsx (useLandingT). The React hooks live in apps/mobile;
// this is the lookup logic they wrap.
import { en } from './en';
import { uk } from './uk';
import { landingEn } from './landing.en';
import { landingUk } from './landing.uk';
import type { Dict, Language, PluralForm } from './types';

export type { Dict, Language, PluralForm } from './types';
export { en, uk, landingEn, landingUk };

export const LANGUAGES: readonly Language[] = ['en', 'uk'];

export const DICTS: Record<Language, Dict> = { en, uk };
export const LANDING_DICTS: Record<Language, Dict> = { en: landingEn, uk: landingUk };

export type TVars = Record<string, string | number>;

/**
 * Replaces `{name}` tokens. The web did `.replace('{x}', v)` at each call
 * site (first occurrence only, `$`-patterns live); no dict string repeats a
 * token, so split/join is equivalent and immune to `$&` in user input.
 * Tokens with no matching var are left as-is, like the web.
 */
export function interpolate(s: string, vars?: TVars): string {
  if (!vars) return s;
  let out = s;
  for (const k of Object.keys(vars)) {
    out = out.split(`{${k}}`).join(String(vars[k]));
  }
  return out;
}

/** CLDR uk cardinal rules, for runtimes without Intl.PluralRules. */
export function pluralizeUk(n: number): PluralForm {
  if (!Number.isInteger(n)) return 'other';
  const abs = Math.abs(n);
  const m10 = abs % 10;
  const m100 = abs % 100;
  if (m10 === 1 && m100 !== 11) return 'one';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
  return 'many';
}

/** CLDR en cardinal rules: only integer 1 is 'one'. */
export function pluralizeEn(n: number): PluralForm {
  return n === 1 ? 'one' : 'other';
}

function makePluralSelect(lang: Language): (n: number) => PluralForm {
  const fallback = lang === 'uk' ? pluralizeUk : pluralizeEn;
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function') {
      const pr = new Intl.PluralRules(lang);
      // Hermes builds without ICU data can resolve 'uk' to a root locale
      // that only knows 'other'; trust Intl only if it agrees on a probe.
      if (lang !== 'uk' || pr.select(2) === 'few') {
        return (n) => pr.select(n) as PluralForm;
      }
    }
  } catch {
    // fall through to the pure rules
  }
  return fallback;
}

export type Translator = {
  lang: Language;
  /** useT: lang dict → en dict → the key itself. */
  t: (key: string, vars?: TVars) => string;
  /** useTn: picks `${key}.${pluralForm(n)}` with the web's fallback chain. */
  tn: (key: string, n: number) => string;
};

/**
 * `dicts` defaults to the app dictionaries; pass LANDING_DICTS for the
 * welcome copy (landing used the same lang → EN → key rule).
 */
export function createTranslator(
  lang: Language,
  dicts: Record<Language, Dict> = DICTS,
): Translator {
  const dict = dicts[lang] ?? dicts.en;
  const base = dicts.en;
  const select = makePluralSelect(lang);
  return {
    lang,
    t: (key, vars) => interpolate(dict[key] ?? base[key] ?? key, vars),
    tn: (key, n) => {
      const form = select(n);
      return (
        dict[`${key}.${form}`] ??
        dict[`${key}.other`] ??
        dict[`${key}.many`] ??
        base[`${key}.${form}`] ??
        base[`${key}.other`] ??
        key
      );
    },
  };
}

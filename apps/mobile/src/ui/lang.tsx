import { createTranslator, type Language, type Translator } from '@tac/core/i18n';
import { createContext, use, useMemo, type ReactNode } from 'react';

import { UK_DISPLAY_DEFAULT, type UkDisplayCandidate } from './fonts';

// The app's i18n context (PLAN Phase 4). The root layout feeds it the
// account language from appStore (MMKV-hydrated, so the first frame is
// already in the right language); dev screens wrap a subtree in their own
// LangProvider to flip en/uk locally. Every string goes through useT/useTn.
type LangValue = { lang: Language; ukDisplay: UkDisplayCandidate; tr: Translator };

/** One translator per language for the app's lifetime (stable t/tn identities). */
const translators: Record<Language, Translator> = {
  en: createTranslator('en'),
  uk: createTranslator('uk'),
};

export function translatorFor(lang: Language): Translator {
  return translators[lang] ?? translators.en;
}

const LangContext = createContext<LangValue>({
  lang: 'en',
  ukDisplay: UK_DISPLAY_DEFAULT,
  tr: translators.en,
});

export function LangProvider({
  lang,
  ukDisplay = UK_DISPLAY_DEFAULT,
  children,
}: {
  lang: Language;
  ukDisplay?: UkDisplayCandidate;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ lang, ukDisplay, tr: translatorFor(lang) }), [lang, ukDisplay]);
  return <LangContext value={value}>{children}</LangContext>;
}

export function useLang(): LangValue {
  return use(LangContext);
}

export type TFn = Translator['t'];
export type TnFn = Translator['tn'];

/** `t(key, vars?)`: lang dict → en dict → key, `{var}` interpolation. */
export function useT(): TFn {
  return use(LangContext).tr.t;
}

/** `tn(key, n)`: plural form via Intl.PluralRules (pluralizeUk fallback on Hermes without uk ICU). */
export function useTn(): TnFn {
  return use(LangContext).tr.tn;
}

import { createTranslator, type Language, type Translator } from '@tac/core/i18n';
import { createContext, use, useMemo, type ReactNode } from 'react';

import { UK_DISPLAY_DEFAULT, type UkDisplayCandidate } from './fonts';

// Minimal language context so primitives can pick the display face and
// translate their own a11y strings. Stand-in until the Phase 4 i18n layer
// (settings-backed language) replaces the provider; consumers keep using
// useLang()/useT().
type LangValue = { lang: Language; ukDisplay: UkDisplayCandidate; tr: Translator };

const translators: Record<Language, Translator> = {
  en: createTranslator('en'),
  uk: createTranslator('uk'),
};

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
  const value = useMemo(() => ({ lang, ukDisplay, tr: translators[lang] }), [lang, ukDisplay]);
  return <LangContext value={value}>{children}</LangContext>;
}

export function useLang(): LangValue {
  return use(LangContext);
}

export function useT(): Translator['t'] {
  return use(LangContext).tr.t;
}

import type { Language } from '@tac/core/i18n';
import { createContext, use, useState, type ReactNode } from 'react';

import { LangProvider } from '../lang';
import { Segmented } from '../Segmented';

// Dev screens flip en/uk locally (there is no settings-backed language yet).
type DevLang = { lang: Language; setLang: (l: Language) => void };
const Ctx = createContext<DevLang>({ lang: 'en', setLang: () => {} });

export function DevLangProvider({ initial = 'en', children }: { initial?: Language; children: ReactNode }) {
  const [lang, setLang] = useState<Language>(initial);
  return (
    <Ctx value={{ lang, setLang }}>
      <LangProvider lang={lang}>{children}</LangProvider>
    </Ctx>
  );
}

export function useDevLang(): DevLang {
  return use(Ctx);
}

const LANG_OPTIONS = [
  { value: 'en', label: 'EN' },
  { value: 'uk', label: 'УКР' },
] as const;

/** en | uk switch; tabs get `${testID}-en` / `${testID}-uk`. */
export function DevLangSwitch({ testID }: { testID: string }) {
  const { lang, setLang } = useDevLang();
  return (
    <Segmented
      options={LANG_OPTIONS}
      value={lang}
      onChange={setLang}
      size="sm"
      testID={testID}
      accessibilityLabel="Language"
    />
  );
}

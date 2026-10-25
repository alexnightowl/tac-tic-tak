import type { Language } from '@tac/core/i18n';

import { useLang } from './lang';

/**
 * Strings the primitives and the dev mocks need that @tac/core/i18n does
 * not have yet. packages/core is out of this stream's scope, so they live
 * here until they are moved into en.ts / uk.ts (reported to the
 * orchestrator). Lookup order: this table → core dict → key.
 */
const LOCAL: Record<Language, Record<string, string>> = {
  en: {
    'ui.password_show': 'Show password',
    'ui.password_hide': 'Hide password',
    'ui.loading': 'Loading',
    'ui.on': 'On',
    'ui.off': 'Off',
    'nav.social': 'Social',
  },
  uk: {
    'ui.password_show': 'Показати пароль',
    'ui.password_hide': 'Сховати пароль',
    'ui.loading': 'Завантаження',
    'ui.on': 'Увімк.',
    'ui.off': 'Вимк.',
    'nav.social': 'Спільнота',
  },
};

export function useUiT(): (key: string, vars?: Record<string, string | number>) => string {
  const { lang, tr } = useLang();
  return (key, vars) => {
    const local = LOCAL[lang][key] ?? LOCAL.en[key];
    return local ?? tr.t(key, vars);
  };
}

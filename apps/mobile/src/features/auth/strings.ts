import { isApiError } from '@tac/core/api';
import type { Language } from '@tac/core/i18n';

import { useLang } from '@/ui';

/**
 * Auth/Home copy @tac/core/i18n lacks. packages/core/i18n has no owner this
 * phase, so these live here until they move into en.ts / uk.ts (reported).
 * Lookup: this table → core dict → key.
 */
const LOCAL: Record<Language, Record<string, string>> = {
  en: {
    'brand.name': 'tac·tic·tak',
    'auth.err_invalid': 'Wrong nickname or password',
    'auth.err_required': 'Enter your nickname and password',
    'auth.err_network': 'Can’t reach the server. Check your connection.',
    'auth.err_timeout': 'The server is taking too long. Try again.',
    'auth.err_generic': 'Something went wrong. Try again.',
    'dev.open': 'Dev menu',
  },
  uk: {
    'brand.name': 'tac·tic·tak',
    'auth.err_invalid': 'Невірний нікнейм або пароль',
    'auth.err_required': 'Введіть нікнейм і пароль',
    'auth.err_network': 'Немає зв’язку із сервером. Перевірте мережу.',
    'auth.err_timeout': 'Сервер відповідає надто довго. Спробуйте ще раз.',
    'auth.err_generic': 'Щось пішло не так. Спробуйте ще раз.',
    'dev.open': 'Меню розробника',
  },
};

export type AuthT = (key: string, vars?: Record<string, string | number>) => string;

export function useAuthT(): AuthT {
  const { lang, tr } = useLang();
  return (key, vars) => LOCAL[lang][key] ?? LOCAL.en[key] ?? tr.t(key, vars);
}

/**
 * The web showed the server's English message raw; mobile maps the known
 * ones to i18n keys (inventory "Map server error messages to i18n keys").
 */
export function loginErrorKey(e: unknown): string {
  if (isApiError(e)) {
    if (e.kind === 'timeout') return 'auth.err_timeout';
    if (e.kind === 'network') return 'auth.err_network';
    if (e.status === 401) return 'auth.err_invalid';
  }
  return 'auth.err_generic';
}

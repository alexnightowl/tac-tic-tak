import { isApiError } from '@tac/core/api';
import type { Language } from '@tac/core/i18n';

import { useLang } from '@/ui';

/**
 * Play copy @tac/core/i18n lacks (the web hard-coded the exit dialog in
 * en/uk). packages/core/i18n has no owner this phase, so these live here
 * until they move into en.ts / uk.ts (reported). Lookup: this table → core
 * dict → key.
 */
const LOCAL: Record<Language, Record<string, string>> = {
  en: {
    'play.exit_title': 'End session?',
    'play.exit_save': 'Save',
    'play.exit_discard': 'Discard',
    'play.exit_keep': 'Keep playing',
    'play.timer': 'Time left',
    'play.err_start': 'Couldn’t start the session. Try again.',
    'play.err_network': 'Can’t reach the server. Check your connection.',
  },
  uk: {
    'play.exit_title': 'Завершити сесію?',
    'play.exit_save': 'Зберегти',
    'play.exit_discard': 'Відкинути',
    'play.exit_keep': 'Продовжити',
    'play.timer': 'Залишилось часу',
    'play.err_start': 'Не вдалося почати сесію. Спробуйте ще раз.',
    'play.err_network': 'Немає зв’язку із сервером. Перевірте мережу.',
  },
};

export type PlayT = (key: string, vars?: Record<string, string | number>) => string;

export function usePlayT(): PlayT {
  const { lang, tr } = useLang();
  return (key, vars) => {
    const local = LOCAL[lang][key] ?? LOCAL.en[key];
    return local ?? tr.t(key, vars);
  };
}

/** POST /sessions failure → a translated message (the web showed e.message raw). */
export function startErrorKey(e: unknown): string {
  if (isApiError(e) && (e.kind === 'network' || e.kind === 'timeout')) return 'play.err_network';
  return 'play.err_start';
}

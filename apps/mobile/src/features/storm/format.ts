import { localeFor } from '@tac/core/format';
import type { Language } from '@tac/core/i18n';
import type { StormUser } from '@tac/core/storm';

/** "2:05" (m:ss), rounded up so 0:00 means the clock really ran out. */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "Oct 19" / "19 жовт." */
export function shortDate(iso: string, lang: Language): string {
  return new Date(iso).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short' });
}

/** "2nd" / "2-е" for "{rank} among friends". */
export function ordinal(n: number, lang: Language): string {
  if (lang === 'uk') return `${n}-е`;
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export const nameOf = (u: Pick<StormUser, 'displayName' | 'nickname'>) => u.displayName?.trim() || u.nickname;

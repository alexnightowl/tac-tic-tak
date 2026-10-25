import { fmtResponseTime, localeFor } from '@tac/core/format';
import { themeLabel } from '@tac/core/themes';

// Display helpers for the history row and the session detail (web
// sessions/[id]/page.tsx and SessionList.tsx), with the web's raw-slug and
// hard-coded-English bits fixed.

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** 'Sunday, October 25, 14:47' / 'Неділя, 25 жовтня, 14:47' (web: first letter capitalised). */
export function formatSessionTitle(startedAt: string, lang: 'en' | 'uk'): string {
  const d = new Date(startedAt);
  const locale = localeFor(lang);
  const date = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${cap(date)}, ${time}`;
}

/** fix: the web row showed the raw theme slug (or 'theme'/'mixed'); labels now, as in the detail. */
export function sessionThemeLabel(theme: string | null | undefined, lang: 'en' | 'uk', mixed: string): string {
  return theme ? themeLabel(theme, lang) : mixed;
}

export const pct = (accuracy: number) => `${Math.round((accuracy ?? 0) * 100)}%`;

/** fix: attempt times used fmtDuration (seconds) on milliseconds — 5000 ms read '83:20'. */
export const responseTime = (ms: number) => fmtResponseTime(ms ?? 0);

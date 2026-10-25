// Display formatters from apps/frontend/src/lib/utils.ts and
// components/SessionList.tsx. `now` is a parameter wherever the web read
// the clock, so screens and tests can pin it.

export type AppLanguage = 'en' | 'uk';

/** BCP-47 locale the web passes to toLocale*String for each app language. */
export function localeFor(language: string): 'uk-UA' | 'en-US' {
  return language === 'uk' ? 'uk-UA' : 'en-US';
}

/**
 * Format a response time for end-user display. Always in seconds with
 * one decimal — milliseconds are an implementation detail nobody outside
 * the eng team thinks in.
 */
export function fmtResponseTime(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

/**
 * Format a Date as 'YYYY-MM-DD' in the device's local timezone. Sent to
 * the backend on session finish so the daily streak ticks in the
 * player's TZ rather than UTC. Avoid `toISOString()` — that's UTC.
 */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Named StreakState on the web; renamed so it can't be confused with the
// stored StreakState in @tac/core/rules.
export type StreakDisplayState = 'secured' | 'at_risk' | 'broken' | 'none';

/**
 * Resolve the daily-streak state from the server-provided `lastDay` and
 * the current local calendar day. Colours the streak badge and decides
 * whether to surface a "play today" nudge; count and freezes still come
 * from the API.
 */
export function streakState(
  days: number,
  lastDay: string | null,
  now: Date = new Date(),
): StreakDisplayState {
  if (days <= 0 || !lastDay) return 'none';
  const today = formatLocalDate(now);
  if (lastDay === today) return 'secured';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = formatLocalDate(y);
  if (lastDay === yesterday) return 'at_risk';
  return 'broken';
}

// ---- Session history grouping (SessionList) -----------------------------

export type SessionRow = {
  id: string;
  startedAt: string;
  durationSec: number;
  solved: number;
  failed: number;
  accuracy: number;
  avgResponseMs: number;
  peakRating: number;
  startRating: number;
  mode: string;
  /** bullet | blitz | rapid — drives the time-control icon. Optional for
   *  tolerance with older endpoints that don't return it. */
  style?: string;
  theme: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Buckets sessions under 'Today' / 'Yesterday' / weekday (last 7 days) /
 * 'weekday, day month' headings, in input order. Labels are capitalised
 * because uk weekday names come back lower-case.
 */
export function groupSessionsByDay<T extends { startedAt: string }>(
  sessions: T[],
  language: string,
  now: Date = new Date(),
): Array<[label: string, rows: T[]]> {
  const locale = localeFor(language);
  const today = startOfDay(now);
  // web bug: SessionList uses `today - 24h`, which misses midnight on a
  // DST-change day and mislabels yesterday's rows with a weekday.
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const buckets = new Map<string, T[]>();
  for (const s of sessions) {
    const d = startOfDay(new Date(s.startedAt));
    let label: string;
    if (d.getTime() === today.getTime()) label = language === 'uk' ? 'Сьогодні' : 'Today';
    else if (d.getTime() === yesterday.getTime()) label = language === 'uk' ? 'Вчора' : 'Yesterday';
    else if (now.getTime() - d.getTime() < 7 * DAY_MS) {
      label = d.toLocaleDateString(locale, { weekday: 'long' });
    } else {
      label = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    }
    label = label.charAt(0).toUpperCase() + label.slice(1);
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label)!.push(s);
  }
  return Array.from(buckets.entries());
}

/** Row time, forced to 24h so it fits one line in every locale (en-US
 *  would otherwise render "04:45 PM"). */
export function formatSessionTime(startedAt: string, language: string): string {
  return new Date(startedAt).toLocaleTimeString(localeFor(language), {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

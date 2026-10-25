/**
 * IANA time-zone helpers for the optional `tz` on session finish.
 * Pure (Intl only, no imports) so they are trivially unit-testable.
 */

/**
 * Returns the zone name as sent (trimmed) when the runtime knows it
 * (e.g. 'Europe/Kyiv', 'America/Port-au-Prince', 'UTC'), or null for
 * anything else: missing, too long, or not a real zone. The name is kept
 * as sent rather than ICU-canonicalised (some ICU builds map Europe/Kyiv
 * to Europe/Kiev). Fixed offsets like '+02:00' are rejected because they
 * ignore DST, which is what a stored zone is for.
 */
export function normalizeTimeZone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const tz = raw.trim();
  if (tz.length === 0 || tz.length > 64 || !/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(tz)) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** 'YYYY-MM-DD' of `at` in zone `tz` (a value normalizeTimeZone accepted). */
export function localDayInZone(tz: string, at: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

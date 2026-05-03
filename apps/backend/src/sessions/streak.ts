/**
 * Pure helpers for the daily-play streak. Held off the service so
 * the rules are testable in isolation and the storage shape is the
 * only contract.
 *
 * "Day" here is whatever 'YYYY-MM-DD' the client tells us — the
 * user's local calendar day. We don't store a TZ; date arithmetic
 * is done on the strings (parsed at UTC midnight, so no DST drift
 * because every comparison is a fixed 24h step).
 *
 * Freeze policy (chess.com-style, deliberately gentle):
 *   - Player gets 1 freeze in pocket; cap stays at 1 — they don't
 *     stockpile.
 *   - Missing exactly one day auto-consumes the freeze and the
 *     streak survives. The user doesn't have to do anything.
 *   - Missing 2+ days, or missing 1 day with no freeze in pocket,
 *     resets the streak to 1 on the next play.
 *   - A consumed freeze regenerates 7 days later. If the player
 *     never burns one, they always have it ready.
 */

export const STREAK_FREEZE_MAX = 1;
export const STREAK_FREEZE_REGEN_DAYS = 7;

export type StreakState = {
  streakDays: number;
  streakFreezes: number;
  /** 'YYYY-MM-DD' in the user's local TZ, or null for never-played. */
  streakLastDay: string | null;
  /** 'YYYY-MM-DD' on which a consumed freeze becomes available
   *  again; null when no freeze is regenerating. */
  streakFreezeRegenAt: string | null;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDay(s: unknown): s is string {
  if (typeof s !== 'string' || !DAY_RE.test(s)) return false;
  const d = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(d)) return false;
  // Round-trip rejects inputs like '2026-02-31' that parse but
  // don't equal what we passed in.
  return new Date(d).toISOString().slice(0, 10) === s;
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  return Math.round((db - da) / 86_400_000);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Apply a single play event to the streak state. `today` is the
 * user's local calendar day. Returns the new state and a flag
 * indicating what happened (used for UI feedback).
 */
export function applyStreakOnPlay(
  state: StreakState,
  today: string,
): { next: StreakState; outcome: 'same-day' | 'continued' | 'frozen' | 'reset' | 'started' } {
  let { streakDays, streakFreezes, streakLastDay, streakFreezeRegenAt } = state;

  // Regenerate a previously-consumed freeze if its cooldown is up.
  // Run before the streak logic so a freeze can cover today's gap
  // even if it regenerated this very session.
  if (
    streakFreezeRegenAt &&
    today >= streakFreezeRegenAt &&
    streakFreezes < STREAK_FREEZE_MAX
  ) {
    streakFreezes = STREAK_FREEZE_MAX;
    streakFreezeRegenAt = null;
  }

  // Same calendar day — already counted.
  if (streakLastDay === today) {
    return {
      next: { streakDays, streakFreezes, streakLastDay, streakFreezeRegenAt },
      outcome: 'same-day',
    };
  }

  // First-ever play (or post-reset cold start where streak was 0).
  if (!streakLastDay || streakDays === 0) {
    return {
      next: { streakDays: 1, streakFreezes, streakLastDay: today, streakFreezeRegenAt },
      outcome: 'started',
    };
  }

  const gap = daysBetween(streakLastDay, today);

  // Negative gap means a date in the past — client clock skew or
  // tampered date. Refuse to advance to keep the record monotonic.
  if (gap < 0) {
    return { next: state, outcome: 'same-day' };
  }

  if (gap === 1) {
    return {
      next: { streakDays: streakDays + 1, streakFreezes, streakLastDay: today, streakFreezeRegenAt },
      outcome: 'continued',
    };
  }

  // gap === 2 means exactly one missed day. A freeze covers it.
  if (gap === 2 && streakFreezes >= 1) {
    return {
      next: {
        streakDays: streakDays + 1,
        streakFreezes: streakFreezes - 1,
        streakLastDay: today,
        streakFreezeRegenAt: addDays(today, STREAK_FREEZE_REGEN_DAYS),
      },
      outcome: 'frozen',
    };
  }

  // Streak broken — start over at 1 (today still counts as a day
  // played).
  return {
    next: { streakDays: 1, streakFreezes, streakLastDay: today, streakFreezeRegenAt },
    outcome: 'reset',
  };
}

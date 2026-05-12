import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
 * Format a Date as 'YYYY-MM-DD' in the browser's local timezone.
 * Used to tell the backend the user's local calendar day on
 * session finish so the daily-streak ticks in their TZ rather
 * than UTC. Avoid `toISOString()` — that's UTC.
 */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type StreakState = 'secured' | 'at_risk' | 'broken' | 'none';

/**
 * Resolve the user's daily-streak state from the server-provided
 * `lastDay` and the current local calendar day. Used to colour the
 * streak badge and decide whether to surface a "play today" nudge —
 * the source of truth (count, freezes) still comes from the API.
 */
export function streakState(days: number, lastDay: string | null): StreakState {
  if (days <= 0 || !lastDay) return 'none';
  const today = formatLocalDate(new Date());
  if (lastDay === today) return 'secured';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = formatLocalDate(y);
  if (lastDay === yesterday) return 'at_risk';
  return 'broken';
}

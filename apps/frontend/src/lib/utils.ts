import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  const rem = Math.floor((ms % 1000) / 100);
  return `${s}.${rem}s`;
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

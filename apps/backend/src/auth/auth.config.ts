import { Logger } from '@nestjs/common';

const log = new Logger('AuthConfig');

/** Mobile access-token lifetime when ACCESS_TOKEN_TTL is unset or invalid. */
export const DEFAULT_ACCESS_TOKEN_TTL_SEC = 30 * 60;
/** Sliding refresh-token lifetime when REFRESH_TOKEN_TTL_DAYS is unset or invalid. */
export const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 90;

const UNIT_SEC: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * Parses "1800", "45s", "30m", "1h", "1d" into seconds. A bare number is
 * seconds (unlike jsonwebtoken, where a numeric *string* means ms).
 * Returns null for anything else so the caller can fall back.
 */
export function parseDurationSec(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const m = /^\s*(\d+)\s*([smhd]?)\s*$/i.exec(raw);
  if (!m) return null;
  const sec = Number(m[1]) * UNIT_SEC[(m[2] || 's').toLowerCase()];
  return Number.isSafeInteger(sec) && sec > 0 ? sec : null;
}

/**
 * Access-token TTL for client:'mobile' logins, in seconds (env
 * ACCESS_TOKEN_TTL, default 30m). An invalid value logs a warning and
 * falls back to the default rather than failing boot: a typo in the VPS
 * env must not take the live web down.
 */
export function accessTokenTtlSec(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.ACCESS_TOKEN_TTL;
  if (raw === undefined || raw === '') return DEFAULT_ACCESS_TOKEN_TTL_SEC;
  const sec = parseDurationSec(raw);
  if (sec === null) {
    log.warn(`ACCESS_TOKEN_TTL="${raw}" is not a duration (e.g. 1800, 30m, 1h); using ${DEFAULT_ACCESS_TOKEN_TTL_SEC}s`);
    return DEFAULT_ACCESS_TOKEN_TTL_SEC;
  }
  return sec;
}

/** Sliding refresh-token TTL in days (env REFRESH_TOKEN_TTL_DAYS, integer 1–365, default 90). */
export function refreshTokenTtlDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.REFRESH_TOKEN_TTL_DAYS;
  if (raw === undefined || raw === '') return DEFAULT_REFRESH_TOKEN_TTL_DAYS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 365) {
    log.warn(`REFRESH_TOKEN_TTL_DAYS="${raw}" is not an integer in 1..365; using ${DEFAULT_REFRESH_TOKEN_TTL_DAYS}`);
    return DEFAULT_REFRESH_TOKEN_TTL_DAYS;
  }
  return n;
}

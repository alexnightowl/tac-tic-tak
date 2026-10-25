import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/**
 * Client-generated idempotency keys (`clientAttemptId`, `requestId`): a
 * UUID or cuid in practice. Restricted to URL-safe characters because the
 * value becomes part of a Redis key.
 */
const CLIENT_KEY = /^[A-Za-z0-9_-]{8,64}$/;
const CLIENT_KEY_MESSAGE = '$property must be 8-64 characters of A-Z, a-z, 0-9, _ or -';

/**
 * Optional `client` marker. The web never sends it; mobile sends
 * 'mobile'. Mobile-only response extras (`serverNow`, `progression`) are
 * keyed on it so web responses stay byte-identical (PLAN §4: behaviour is
 * keyed on DTO fields, never on the path).
 */
export const CLIENTS = ['web', 'mobile'] as const;
export type ClientKind = (typeof CLIENTS)[number];

export class CreateSessionDto {
  @IsInt() @Min(400) @Max(3000)
  startRating!: number;

  // Accept any duration between 1 minute and 1 hour.
  @IsInt() @Min(60) @Max(3600)
  durationSec!: number;

  @IsIn(['mixed', 'theme'])
  mode!: 'mixed' | 'theme';

  @IsIn(['bullet', 'blitz', 'rapid'])
  style!: 'bullet' | 'blitz' | 'rapid';

  @IsOptional() @IsString()
  theme?: string;

  /** 'mobile' adds `serverNow` to the response. */
  @IsOptional() @IsIn(CLIENTS)
  client?: ClientKind;
}

/** Body of POST /sessions/:id/next. The web sends no body at all. */
export class NextDto {
  /**
   * Retry key: the same requestId within 5 minutes replays the same
   * response (same puzzle) instead of popping another one.
   */
  @IsOptional() @IsString() @Matches(CLIENT_KEY, { message: CLIENT_KEY_MESSAGE })
  requestId?: string;

  /** 'mobile' adds `serverNow` to the response. */
  @IsOptional() @IsIn(CLIENTS)
  client?: ClientKind;
}

export class AttemptDto {
  @IsString()
  puzzleId!: string;

  @IsBoolean()
  correct!: boolean;

  // Up to 1 hour (a session's maximum length). Was 10 minutes; raised so
  // a slow but legitimate solve is never rejected (relaxing only).
  @IsInt() @Min(0) @Max(60 * 60 * 1000)
  responseMs!: number;

  /**
   * Idempotency key for outbox retries. The first request records the
   * attempt and steps the rating; any replay within 24 h gets the first
   * response body verbatim and changes nothing.
   */
  @IsOptional() @IsString() @Matches(CLIENT_KEY, { message: CLIENT_KEY_MESSAGE })
  clientAttemptId?: string;

  /** true adds `next` (the /next response, or null) in the same round-trip. */
  @IsOptional() @IsBoolean()
  includeNext?: boolean;

  /** 'mobile' adds `serverNow` to the embedded `next`. */
  @IsOptional() @IsIn(CLIENTS)
  client?: ClientKind;
}

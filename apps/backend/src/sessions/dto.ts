import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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
}

export class AttemptDto {
  @IsString()
  puzzleId!: string;

  @IsBoolean()
  correct!: boolean;

  @IsInt() @Min(0) @Max(10 * 60 * 1000)
  responseMs!: number;
}

/** Page size bounds for GET /sessions (the paginated history list). */
export const SESSION_LIST_DEFAULT_LIMIT = 20;
export const SESSION_LIST_MAX_LIMIT = 50;

/**
 * Query for GET /sessions (B9). New route, so validation is strict: an
 * unknown style, a non-integer or out-of-range limit, or a malformed
 * cursor is a 400 rather than a silent fallback.
 */
export class ListSessionsQueryDto {
  /** Opaque `nextCursor` from the previous page. */
  @IsOptional() @IsString() @MaxLength(200)
  cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(SESSION_LIST_MAX_LIMIT)
  limit?: number;

  @IsOptional() @IsIn(['bullet', 'blitz', 'rapid'])
  style?: 'bullet' | 'blitz' | 'rapid';
}

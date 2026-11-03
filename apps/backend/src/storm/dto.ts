import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const STORM_FORMATS = ['time3', 'time5', 'survival'] as const;
export type StormFormat = (typeof STORM_FORMATS)[number];

export const STREAM_LENGTH = 100;
export const STORM_LIVES = 3;
export const NOTE_MAX = 80;
/** A run lasts at most 5:00 plus combo time; Survival is capped at 2 h. */
export const MAX_RUN_MS = 2 * 3600_000;

export class StreamDto {
  @IsOptional() @IsString() @MaxLength(64)
  challengeId?: string;
}

export class StormResultDto {
  @IsInt() @Min(0) @Max(STREAM_LENGTH - 1)
  i!: number;

  @IsBoolean()
  ok!: boolean;

  @IsInt() @Min(0) @Max(MAX_RUN_MS)
  ms!: number;
}

export class StormRunDto {
  @IsString() @MaxLength(64)
  clientId!: string;

  @IsString() @MaxLength(64)
  streamId!: string;

  @IsIn(STORM_FORMATS)
  format!: StormFormat;

  @IsOptional() @IsString() @MaxLength(64)
  challengeId?: string;

  @IsInt() @Min(0) @Max(STREAM_LENGTH)
  score!: number;

  @IsInt() @Min(0) @Max(STORM_LIVES)
  mistakes!: number;

  @IsInt() @Min(0) @Max(STREAM_LENGTH)
  bestCombo!: number;

  @IsInt() @Min(0) @Max(MAX_RUN_MS)
  durationMs!: number;

  @IsInt() @Min(0) @Max(MAX_RUN_MS)
  lastSolveMs!: number;

  @IsArray() @ArrayMaxSize(STREAM_LENGTH)
  @ValidateNested({ each: true }) @Type(() => StormResultDto)
  results!: StormResultDto[];

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDay?: string;

  /** `Date#getTimezoneOffset()`; with `localDay`, the streak's "today". */
  @IsOptional() @IsInt() @Min(-840) @Max(840)
  tzOffsetMin?: number;
}

export class SummaryQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(-840) @Max(840)
  tzOffsetMin?: number;
}

export class ChallengeCreateDto {
  @IsString() @MaxLength(64)
  opponentId!: string;

  @IsIn(STORM_FORMATS)
  format!: StormFormat;

  @IsOptional() @IsString() @MaxLength(NOTE_MAX)
  note?: string;

  /** A dare: send my finished solo run (its stream and score). */
  @IsOptional() @IsString() @MaxLength(64)
  runId?: string;
}

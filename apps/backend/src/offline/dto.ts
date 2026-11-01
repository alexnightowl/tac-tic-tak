import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const PACK_KINDS = ['level', 'weak', 'mate', 'endgame', 'hard'] as const;
export type PackKind = (typeof PACK_KINDS)[number];

export const MAX_PACK_COUNT = 150;
export const MAX_SYNC_ATTEMPTS = 1000;

export class PackQueryDto {
  @IsIn(PACK_KINDS as unknown as string[])
  kind!: PackKind;

  @IsIn(['bullet', 'blitz', 'rapid'])
  style!: 'bullet' | 'blitz' | 'rapid';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PACK_COUNT)
  count?: number;
}

export class OfflineAttemptDto {
  @IsString() @MaxLength(64)
  clientId!: string;

  @IsString() @MaxLength(32)
  puzzleId!: string;

  @IsBoolean()
  correct!: boolean;

  @IsInt() @Min(0) @Max(10 * 60 * 1000)
  responseMs!: number;

  @IsISO8601()
  solvedAt!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDay!: string;

  @IsIn(['pack', 'review'])
  source!: 'pack' | 'review';
}

export class SyncDto {
  @IsIn(['bullet', 'blitz', 'rapid'])
  style!: 'bullet' | 'blitz' | 'rapid';

  /** `Date#getTimezoneOffset()` at sync time: minutes, UTC minus local (Kyiv summer = -180). */
  @IsInt() @Min(-840) @Max(840)
  tzOffsetMin!: number;

  @IsArray() @ArrayMaxSize(MAX_SYNC_ATTEMPTS)
  @ValidateNested({ each: true }) @Type(() => OfflineAttemptDto)
  attempts!: OfflineAttemptDto[];
}

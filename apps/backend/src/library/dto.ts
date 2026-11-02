import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsISO8601,
  IsObject,
  IsString,
  Max,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const LIBRARY_RESULTS = ['clean', 'hint', 'missed'] as const;
export type LibraryResult = (typeof LIBRARY_RESULTS)[number];

export const MAX_LIBRARY_SYNC = 1000;
/** Time on one puzzle is capped at 30 min (a phone left on the board). */
export const MAX_LIBRARY_TIME_MS = 30 * 60 * 1000;
export const MAX_LIBRARY_CYCLE = 99;

export class LibraryAttemptDto {
  @IsString() @MaxLength(64)
  clientId!: string;

  @IsString() @MaxLength(32)
  bookId!: string;

  @IsString() @MaxLength(32)
  puzzleId!: string;

  @IsInt() @Min(1) @Max(MAX_LIBRARY_CYCLE)
  cycle!: number;

  @IsIn(LIBRARY_RESULTS as unknown as string[])
  result!: LibraryResult;

  @IsInt() @Min(0)
  timeMs!: number;

  @IsISO8601()
  solvedAt!: string;

  /** The player's 'YYYY-MM-DD' when solved: the day counts for the streak (Q47). */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDay?: string;
}

/** One finished course exam try (mobile Learn tab). */
export class CourseExamDto {
  @IsString() @MaxLength(64)
  clientId!: string;

  @IsString() @MaxLength(32)
  courseId!: string;

  @IsInt() @Min(1) @Max(MAX_LIBRARY_CYCLE)
  cycle!: number;

  @IsInt() @Min(0) @Max(200)
  score!: number;

  @IsInt() @Min(1) @Max(200)
  total!: number;

  /** The phone's verdict; the server recomputes it from the course's pass mark. */
  @IsOptional() @IsBoolean()
  passed?: boolean;

  /** theme slug → [right, asked]; unknown themes and malformed rows are dropped. */
  @IsObject()
  byTheme!: Record<string, unknown>;

  @IsISO8601()
  takenAt!: string;
}

export const MAX_EXAM_SYNC = 100;

export class LibrarySyncDto {
  /** `Date#getTimezoneOffset()` at sync time; with `localDay`, the streak's "today". */
  @IsOptional() @IsInt() @Min(-840) @Max(840)
  tzOffsetMin?: number;

  @IsArray() @ArrayMaxSize(MAX_LIBRARY_SYNC)
  @ValidateNested({ each: true }) @Type(() => LibraryAttemptDto)
  attempts!: LibraryAttemptDto[];

  @IsOptional() @IsArray() @ArrayMaxSize(MAX_EXAM_SYNC)
  @ValidateNested({ each: true }) @Type(() => CourseExamDto)
  exams?: CourseExamDto[];
}

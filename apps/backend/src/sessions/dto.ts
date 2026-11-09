import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateSessionDto {
  @IsInt() @Min(400) @Max(3000)
  startRating!: number;

  // Accept any duration between 1 minute and 1 hour.
  @IsInt() @Min(60) @Max(3600)
  durationSec!: number;

  @IsIn(['mixed', 'theme', 'casual'])
  mode!: 'mixed' | 'theme' | 'casual';

  @IsIn(['bullet', 'blitz', 'rapid'])
  style!: 'bullet' | 'blitz' | 'rapid';

  @IsOptional() @IsString()
  theme?: string;

  // Play v2 client: levels instead of the norm (sessions/progress.ts).
  @IsOptional() @IsIn(['v2'])
  ruleset?: 'v2';

  // Mobile trainers (D40): 'blind' hides the pieces after a look (casual
  // or theme only); 'plan' is the daily plan (theme mode with `themes`).
  @IsOptional() @IsIn(['blind', 'plan'])
  variant?: 'blind' | 'plan';

  // Mobile: up to three theme slugs drawn together (theme mode only).
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3)
  @IsString({ each: true }) @Matches(/^[A-Za-z0-9]{1,40}$/, { each: true })
  themes?: string[];
}

export class AttemptDto {
  @IsString()
  puzzleId!: string;

  @IsBoolean()
  correct!: boolean;

  @IsInt() @Min(0) @Max(10 * 60 * 1000)
  responseMs!: number;

  // Mobile: thinking time on the move that went wrong (haste, D40).
  @IsOptional() @IsInt() @Min(0) @Max(10 * 60 * 1000)
  mistakeMs?: number;
}

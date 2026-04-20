import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSessionDto {
  @IsInt() @Min(400) @Max(3000)
  startRating!: number;

  // Accept any duration between 1 minute and 1 hour.
  @IsInt() @Min(60) @Max(3600)
  durationSec!: number;

  @IsIn(['mixed', 'theme'])
  mode!: 'mixed' | 'theme';

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

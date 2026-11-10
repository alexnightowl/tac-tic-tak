import { IsIn, IsOptional } from 'class-validator';

export const WOODPECKER_SIZES = [50, 100, 150] as const;
export const WOODPECKER_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type WoodpeckerDifficulty = (typeof WOODPECKER_DIFFICULTIES)[number];

/**
 * Only `style` (D41): the canonical method, a pool the first cycle cuts.
 * `size` + `difficulty` (D40, app builds before D41): a fixed set.
 */
export class CreateWoodpeckerSetDto {
  @IsOptional()
  @IsIn(WOODPECKER_SIZES as unknown as number[])
  size?: number;

  @IsOptional()
  @IsIn(WOODPECKER_DIFFICULTIES as unknown as string[])
  difficulty?: WoodpeckerDifficulty;

  @IsIn(['bullet', 'blitz', 'rapid'])
  style!: 'bullet' | 'blitz' | 'rapid';
}

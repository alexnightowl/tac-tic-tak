import { IsIn } from 'class-validator';

export const WOODPECKER_SIZES = [50, 100, 150] as const;
export const WOODPECKER_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type WoodpeckerDifficulty = (typeof WOODPECKER_DIFFICULTIES)[number];

export class CreateWoodpeckerSetDto {
  @IsIn(WOODPECKER_SIZES as unknown as number[])
  size!: number;

  @IsIn(WOODPECKER_DIFFICULTIES as unknown as string[])
  difficulty!: WoodpeckerDifficulty;

  @IsIn(['bullet', 'blitz', 'rapid'])
  style!: 'bullet' | 'blitz' | 'rapid';
}

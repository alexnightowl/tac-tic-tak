import { LEVEL_GRID, type TrainingStyle } from '@tac/core/rules';

// D39: the level is the only number a player sees at rest. Desktop helpers
// for the screens that used to show the rating.

/** "Level over time": the shared helper (rated v2 session starts only). */
export { toLevelPoints } from '@/features/stats/api';

/**
 * Level now minus the level Home showed on the previous visit (0: unchanged
 * or first visit). A stored value off the level grid is a rating saved
 * before D39, not a level: no delta from it.
 */
export function levelDelta(seen: Partial<Record<TrainingStyle, number>>, style: TrainingStyle, level: number): number {
  const was = seen[style];
  return was == null || was % LEVEL_GRID !== 0 ? 0 : level - was;
}

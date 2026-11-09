import type { RatingPoint } from '@tac/core/charts';
import { LEVEL_GRID, isTrainingStyle, type TrainingStyle } from '@tac/core/rules';

import type { TimelinePoint } from '@/features/stats/api';

// D39: the level is the only number a player sees at rest. Desktop helpers
// for the screens that used to show the rating.

/**
 * "Level over time": each training-style session at the difficulty it
 * started at. Rated sessions start at the level, so the line is the level.
 */
export function toLevelPoints(timeline: TimelinePoint[] | undefined): RatingPoint[] {
  if (!timeline) return [];
  return timeline
    .filter((p) => isTrainingStyle(p.style))
    .map((p) => ({ endedAt: p.endedAt, style: p.style as TrainingStyle, rating: p.startRating }));
}

/**
 * Level now minus the level Home showed on the previous visit (0: unchanged
 * or first visit). A stored value off the level grid is a rating saved
 * before D39, not a level: no delta from it.
 */
export function levelDelta(seen: Partial<Record<TrainingStyle, number>>, style: TrainingStyle, level: number): number {
  const was = seen[style];
  return was == null || was % LEVEL_GRID !== 0 ? 0 : level - was;
}

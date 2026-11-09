// Woodpecker cycles (D40): one fixed set of puzzles solved again and
// again, each cycle faster. A set is a Library "book" for the progress
// arithmetic: its results are Library attempts with bookId = the set id,
// and its chapters are blocks of WOODPECKER_BLOCK puzzles in set order.
import type { WoodpeckerDifficulty, WoodpeckerSize } from '../api/types';
import type { BookShape } from './library';

export const WOODPECKER_SIZES: readonly WoodpeckerSize[] = [50, 100, 150];
export const WOODPECKER_DIFFICULTIES: readonly WoodpeckerDifficulty[] = ['easy', 'medium', 'hard'];
export const WOODPECKER_DEFAULT_SIZE: WoodpeckerSize = 100;
export const WOODPECKER_DEFAULT_DIFFICULTY: WoodpeckerDifficulty = 'easy';

/** The window's centre against the style's level (the method wants easy-ish puzzles). */
export const WOODPECKER_OFFSET: Record<WoodpeckerDifficulty, number> = { easy: -300, medium: -150, hard: 0 };
/** Half the rating window the puzzles are picked from. */
export const WOODPECKER_HALF_WINDOW = 75;
/** The lowest window centre (the puzzle base thins out below). */
export const WOODPECKER_MIN_RATING = 600;
/** Puzzles per block (a sitting). */
export const WOODPECKER_BLOCK = 25;

export const WOODPECKER_ID_PREFIX = 'wp_';
export const isWoodpeckerId = (id: string) => id.startsWith(WOODPECKER_ID_PREFIX);

/** The rating window a new set of this difficulty draws from at this level. */
export function woodpeckerWindow(level: number, difficulty: WoodpeckerDifficulty): { rating: number; min: number; max: number } {
  const rating = Math.max(WOODPECKER_MIN_RATING, Math.round(level + WOODPECKER_OFFSET[difficulty]));
  return { rating, min: rating - WOODPECKER_HALF_WINDOW, max: rating + WOODPECKER_HALF_WINDOW };
}

/** The set as a book: blocks of WOODPECKER_BLOCK puzzles in set order. */
export function woodpeckerShape(set: { id: string; puzzles: readonly { id: string }[] }): BookShape {
  const chapters: BookShape['chapters'] = [];
  for (let i = 0; i < set.puzzles.length; i += WOODPECKER_BLOCK) {
    chapters.push({ id: `${set.id}#${chapters.length}`, puzzleIds: set.puzzles.slice(i, i + WOODPECKER_BLOCK).map((p) => p.id) });
  }
  return { id: set.id, chapters };
}

/**
 * The solving queue: the puzzles without a result this cycle, in set
 * order from `start` (a block's first index) to the end, then the ones
 * before it that are still open.
 */
export function woodpeckerQueue(puzzleIds: readonly string[], done: ReadonlySet<string>, start = 0): string[] {
  const from = Math.max(0, Math.min(start, puzzleIds.length));
  const open = (ids: readonly string[]) => ids.filter((id) => !done.has(id));
  return [...open(puzzleIds.slice(from)), ...open(puzzleIds.slice(0, from))];
}

/** "Mate in N" from Lichess themes (mateIn1 … mateIn5), else null. */
export function mateInFromThemes(themes: readonly string[]): number | null {
  for (const th of themes) {
    const m = /^mateIn(\d)$/.exec(th);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Whole-percent change from `before` to `after` seconds (positive = faster). */
export function speedupPct(before: number | null, after: number | null): number | null {
  if (before == null || after == null || before <= 0) return null;
  return Math.round(((before - after) / before) * 100);
}

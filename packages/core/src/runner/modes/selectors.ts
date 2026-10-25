// Read-only views over PracticeState, plus the pure adapters the practice
// screens share (server shapes → PracticeItem, next drill puzzle, e2e).
import { Chess } from 'chess.js';
import type { ServerPuzzle } from '../../puzzle';
import { uciFromMove } from '../../puzzle';
import { isMetaTheme } from '../../themes';
import type { PracticeItem, PracticeState, ReviewReason } from './types';

/** GET /review list row (themes come along; `setupMove` is moves[0] only). */
export type ReviewListItem = {
  id: string;
  puzzleId: string;
  createdAt: string;
  rating: number;
  fen: string;
  setupMove: string;
  themes: string[];
};

/** GET /review/themes row. */
export type ReviewThemeRow = { slug: string; count: number; minRating: number };

/** GET /sessions/:id/review-items row: `moves` is a space-joined string here. */
export type SessionReviewItem = {
  puzzleId: string;
  reason: ReviewReason;
  responseMs: number;
  rating: number;
  fen: string;
  moves: string | string[];
  themes: string[];
};

/** fix: ServerPuzzle.moves is an array, review-items sends a string; one parser for both. */
export function normalizeMoves(moves: string | string[] | null | undefined): string[] {
  if (Array.isArray(moves)) return moves.filter(Boolean);
  return (moves ?? '').split(/\s+/).filter(Boolean);
}

export function sessionItemToPractice(i: SessionReviewItem): PracticeItem {
  return {
    puzzle: { id: i.puzzleId, fen: i.fen, moves: normalizeMoves(i.moves), rating: i.rating, themes: i.themes ?? [], gameUrl: null },
    reason: i.reason,
  };
}

/** web resolveAndAdvance: the first item of the fresh list that is not the one just solved. */
export function nextReviewPuzzleId(list: readonly Pick<ReviewListItem, 'puzzleId'>[], currentId: string): string | null {
  return list.find((i) => i.puzzleId !== currentId)?.puzzleId ?? null;
}

/** Up to `n` tactical theme slugs of a puzzle (the runners' themes line). */
export function tacticalThemes(themes: readonly string[], n = 3): string[] {
  return themes.filter((t) => !isMetaTheme(t)).slice(0, n);
}

/**
 * Drill counter 'X / N': N is frozen at the first list fetch, X is the
 * puzzle's place in that list, pinned to N when the server slipped in a
 * puzzle the list never had (web sessionRef).
 */
export function drillCounterOf(s: PracticeState): { position: number; total: number } | null {
  const total = s.counterIds.length;
  if (total === 0 || !s.item) return null;
  const idx = s.counterIds.indexOf(s.item.puzzle.id);
  return { position: Math.min(idx >= 0 ? idx + 1 : total, total), total };
}

export type PracticeTitle = 'loading' | 'opponent' | 'yourTurn' | 'solved' | 'solution';

/** TurnCard title (web override priority: solution > solved > opponent > your turn). */
export function practiceTitleOf(s: PracticeState): PracticeTitle {
  if (s.phase === 'solution') return 'solution';
  if (s.phase === 'solved' || s.phase === 'advancing' || s.phase === 'advanceFailed') return 'solved';
  if (s.phase === 'idle' || s.phase === 'swapping') return 'loading';
  if (s.phase === 'playerTurn') return 'yourTurn';
  return 'opponent';
}

export const canHint = (s: PracticeState) => s.phase === 'playerTurn' && s.hintLevel < 2 && s.remaining.length > 0;

/** Viewer stepper: 'Move n of total' counts the player's line (the setup move is ply 1). */
export function solutionStepOf(s: PracticeState): { n: number; total: number; ply: number; maxPly: number } | null {
  if (s.phase !== 'solution' || !s.item) return null;
  const maxPly = s.item.puzzle.moves.length;
  return { n: s.ply - 1, total: maxPly - 1, ply: s.ply, maxPly };
}

/** Mistakes progress 0…1. */
export const mistakesProgressOf = (s: PracticeState) => (s.total > 0 ? s.solvedCount / s.total : 0);

/** Dev / E2E: a legal move that is neither the expected one nor a mate. */
export function e2eWrongMove(fen: string, expected: string | undefined): string | null {
  const c = new Chess(fen);
  for (const m of c.moves({ verbose: true })) {
    const uci = uciFromMove({ from: m.from, to: m.to, promotion: m.promotion });
    if (uci === expected) continue;
    const probe = new Chess(fen);
    probe.move(m);
    if (!probe.isCheckmate()) return uci;
  }
  return null;
}

/** A PracticeItem for a full ServerPuzzle (drill, viewer). */
export const puzzleItem = (puzzle: ServerPuzzle): PracticeItem => ({ puzzle });

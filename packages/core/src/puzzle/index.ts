// From apps/frontend/src/lib/puzzle.ts plus the UCI helpers inlined in
// app/(app)/puzzles/[puzzleId]/page.tsx.
import { Chess, type Square } from 'chess.js';

export type ServerPuzzle = {
  id: string;
  fen: string;
  moves: string[];     // UCI, first is opponent's setup move
  rating: number;
  themes: string[];
  gameUrl: string | null;
};

export type PuzzleMove = { from: Square; to: Square; promotion?: string };

/**
 * Initialises a puzzle. Returns both FENs (before / after the opponent's
 * setup move) so the UI can animate the setup move sliding on the board.
 */
export type InitResult = {
  preFen: string;
  postFen: string;
  setupMove: PuzzleMove | null;
  remaining: string[];
  playerColor: 'w' | 'b';
};

export function initPuzzle(p: ServerPuzzle): InitResult {
  const post = new Chess(p.fen);
  const [setup, ...rest] = p.moves;
  let setupMove: PuzzleMove | null = null;
  if (setup) {
    const from = setup.slice(0, 2) as Square;
    const to = setup.slice(2, 4) as Square;
    const promotion = setup.length > 4 ? setup.slice(4) : undefined;
    post.move({ from, to, promotion });
    setupMove = { from, to, promotion };
  }
  return {
    preFen: p.fen,
    postFen: post.fen(),
    setupMove,
    remaining: rest,
    playerColor: post.turn(),
  };
}

// How long review runners hold on a solved position (showing the
// "Solved" badge) before moving to the next puzzle.
export const SOLVED_PAUSE_MS = 1000;

export function uciFromMove(m: PuzzleMove) {
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}

export function parseUci(uci: string): PuzzleMove {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? uci.slice(4) : undefined,
  };
}

/** Positions along the full solution line: fens[k] = after k moves
 *  (fens[0] is the puzzle FEN, fens[1] is after the setup move). Throws,
 *  like chess.js, if a move in the line is illegal. */
export function buildSolutionFens(p: Pick<ServerPuzzle, 'fen' | 'moves'>): string[] {
  const c = new Chess(p.fen);
  const out = [c.fen()];
  for (const uci of p.moves) {
    c.move(parseUci(uci));
    out.push(c.fen());
  }
  return out;
}

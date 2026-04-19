import { Chess, Square } from 'chess.js';

export type ServerPuzzle = {
  id: string;
  fen: string;
  moves: string[];     // UCI, first is opponent's setup move
  rating: number;
  themes: string[];
  gameUrl: string | null;
};

export type PuzzleState = {
  chess: Chess;
  movesToPlay: string[];   // remaining expected moves after current index
  playerTurn: 'w' | 'b';   // whose move the SOLVER plays
  solved: boolean;
};

/**
 * Initialises a puzzle: applies the opponent's setup move, leaving it for
 * the solver to play next. Returns the side the solver plays as.
 */
export function initPuzzle(p: ServerPuzzle): { chess: Chess; remaining: string[]; playerColor: 'w' | 'b'; opponentSetup: { from: Square; to: Square } | null } {
  const chess = new Chess(p.fen);
  const [setup, ...rest] = p.moves;
  let opponentSetup: { from: Square; to: Square } | null = null;
  if (setup) {
    const from = setup.slice(0, 2) as Square;
    const to = setup.slice(2, 4) as Square;
    const promotion = setup.length > 4 ? setup.slice(4) : undefined;
    chess.move({ from, to, promotion });
    opponentSetup = { from, to };
  }
  const playerColor = chess.turn();
  return { chess, remaining: rest, playerColor, opponentSetup };
}

export function uciFromMove(m: { from: Square; to: Square; promotion?: string }) {
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}

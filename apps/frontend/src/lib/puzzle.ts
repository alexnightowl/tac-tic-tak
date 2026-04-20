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
 * Initialises a puzzle. Returns both FENs (before / after the opponent's
 * setup move) so the UI can animate the setup move sliding on the board.
 */
export type InitResult = {
  preFen: string;
  postFen: string;
  setupMove: { from: Square; to: Square; promotion?: string } | null;
  remaining: string[];
  playerColor: 'w' | 'b';
};

export function initPuzzle(p: ServerPuzzle): InitResult {
  const post = new Chess(p.fen);
  const [setup, ...rest] = p.moves;
  let setupMove: { from: Square; to: Square; promotion?: string } | null = null;
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

export function uciFromMove(m: { from: Square; to: Square; promotion?: string }) {
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}

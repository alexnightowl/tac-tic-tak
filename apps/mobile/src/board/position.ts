// FEN → FEN diff with stable piece ids, so React keeps the same piece view
// across a move and the view slides instead of remounting (PLAN §2.6).
import { legalTable, squareIndex, squareName, type Square } from '@tac/core/board';
import { Chess, type Move } from './chess';
import { PIECE_CODES, type PieceCode } from './assets';

export type BoardPiece = { id: number; code: PieceCode; sq: Square };

/** 64 entries, a1 = 0; piece code or null. */
export type Placement = (PieceCode | null)[];

export function placementFromFen(fen: string): Placement {
  const out: Placement = new Array(64).fill(null);
  const rows = fen.split(' ')[0].split('/');
  for (let r = 0; r < 8 && r < rows.length; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        file += Number(ch);
        continue;
      }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      out[(7 - r) * 8 + file] = `${color}${ch.toUpperCase()}` as PieceCode;
      file++;
    }
  }
  return out;
}

/** Code indices (PIECE_CODES order) per square, -1 = empty: the UI thread's view of the board. */
export function codeIndices(p: Placement): number[] {
  return p.map((c) => (c ? PIECE_CODES.indexOf(c) : -1));
}

function dist(a: number, b: number): number {
  return Math.abs((a & 7) - (b & 7)) + Math.abs((a >> 3) - (b >> 3));
}

export type DiffResult = {
  pieces: BoardPiece[];
  /** Ids from `prev` that are gone (captured): fade them out. */
  captured: BoardPiece[];
  /** Ids whose square changed. */
  moved: Set<number>;
};

/**
 * Matches next pieces to prev ids: the hinted move first, then pieces that
 * stayed put, then nearest same-code pieces (castling rook, arbitrary jumps),
 * then pawn → promoted piece. Whatever is left is captured or new.
 */
export function diffPieces(
  prev: readonly BoardPiece[],
  next: Placement,
  hint: { from: string; to: string } | null | undefined,
  newId: () => number,
): DiffResult {
  const prevAt = new Map<number, BoardPiece>();
  for (const p of prev) prevAt.set(squareIndex(p.sq), p);
  const used = new Set<number>(); // prev ids already assigned
  const filled = new Array<boolean>(64).fill(false);
  const pieces: BoardPiece[] = [];
  const moved = new Set<number>();

  const assign = (p: BoardPiece, idx: number) => {
    const code = next[idx] as PieceCode;
    const sq = squareName(idx);
    if (p.sq !== sq) moved.add(p.id);
    pieces.push({ id: p.id, code, sq });
    used.add(p.id);
    filled[idx] = true;
  };

  if (hint) {
    const f = squareIndex(hint.from);
    const t = squareIndex(hint.to);
    const mover = prevAt.get(f);
    const landed = next[t];
    if (mover && landed && next[f] !== mover.code && landed[0] === mover.code[0] &&
        (landed === mover.code || mover.code[1] === 'P')) {
      assign(mover, t);
    }
  }

  for (let i = 0; i < 64; i++) {
    const p = prevAt.get(i);
    if (!filled[i] && p && !used.has(p.id) && next[i] === p.code) assign(p, i);
  }

  const greedy = (match: (p: BoardPiece, code: PieceCode) => boolean) => {
    const pairs: { p: BoardPiece; idx: number; d: number }[] = [];
    for (let i = 0; i < 64; i++) {
      const code = next[i];
      if (!code || filled[i]) continue;
      for (const p of prev) {
        if (!used.has(p.id) && match(p, code)) pairs.push({ p, idx: i, d: dist(squareIndex(p.sq), i) });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    for (const { p, idx } of pairs) if (!filled[idx] && !used.has(p.id)) assign(p, idx);
  };
  greedy((p, code) => p.code === code);
  greedy((p, code) => p.code[1] === 'P' && p.code[0] === code[0]);

  for (let i = 0; i < 64; i++) {
    const code = next[i];
    if (code && !filled[i]) {
      pieces.push({ id: newId(), code, sq: squareName(i) });
      filled[i] = true;
    }
  }
  const captured = prev.filter((p) => !used.has(p.id));
  return { pieces, captured, moved };
}

export function freshPieces(next: Placement, newId: () => number): BoardPiece[] {
  const out: BoardPiece[] = [];
  for (let i = 0; i < 64; i++) {
    const code = next[i];
    if (code) out.push({ id: newId(), code, sq: squareName(i) });
  }
  return out;
}

/** Everything the board derives from a FEN with chess.js (JS thread only). */
export type FenInfo = {
  fen: string;
  placement: Placement;
  moves: Move[];
  turn: 'w' | 'b';
  checkSquare: Square | null;
};

export function fenInfo(fen: string): FenInfo {
  const chess = new Chess(fen);
  const placement = placementFromFen(fen);
  const turn = chess.turn();
  let checkSquare: Square | null = null;
  if (chess.inCheck()) {
    const king = `${turn}K`;
    const idx = placement.indexOf(king as PieceCode);
    if (idx >= 0) checkSquare = squareName(idx);
  }
  return { fen: chess.fen(), placement, moves: chess.moves({ verbose: true }), turn, checkSquare };
}

/** Applies a move with chess.js; null when illegal. */
export function applyMove(fen: string, from: string, to: string, promotion?: string): { fen: string; move: Move } | null {
  const chess = new Chess(fen);
  try {
    const move = chess.move({ from, to, promotion });
    return move ? { fen: chess.fen(), move } : null;
  } catch {
    return null;
  }
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type InternalMoves = { _moves?: (opts: { legal: boolean }) => { from: number; to: number }[] };

/** chess.js 0x88 square (a8 = 0, h1 = 119) → board index (a1 = 0). */
const from0x88 = (s: number) => (7 - (s >> 4)) * 8 + (s & 15);

/**
 * Legal-target table (legalTable layout) for the side to move. The public
 * `moves({ verbose: true })` builds SAN for every move (O(n²); ~2 ms on V8,
 * several times that on Hermes, twice per move before this), but the board
 * only needs from/to: read chess.js 1.4's internal list, and fall back to the
 * public API if a chess.js upgrade drops it.
 */
export function legalTableOf(chess: Chess): number[] {
  const internal = (chess as unknown as InternalMoves)._moves;
  if (typeof internal !== 'function') return legalTable(chess.moves({ verbose: true }));
  const t: number[] = new Array(128).fill(0);
  for (const m of internal.call(chess, { legal: true })) {
    const f = from0x88(m.from) * 2;
    const to = from0x88(m.to);
    if (to < 32) t[f] = (t[f] | (1 << to)) | 0;
    else t[f + 1] = (t[f + 1] | (1 << (to - 32))) | 0;
  }
  return t;
}

/** Occupied squares as int32 lo/hi (a1 = bit 0): splits legal targets into dots and rings. */
export function occupancy(p: Placement): [number, number] {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < 64; i++) {
    if (!p[i]) continue;
    if (i < 32) lo = (lo | (1 << i)) | 0;
    else hi = (hi | (1 << (i - 32))) | 0;
  }
  return [lo, hi];
}

/** The checked king's square, or null. */
export function checkSquareOf(chess: Chess, p: Placement): Square | null {
  if (!chess.inCheck()) return null;
  const idx = p.indexOf(`${chess.turn()}K` as PieceCode);
  return idx >= 0 ? squareName(idx) : null;
}

/** Plays a move on `chess` in place; null (and `chess` unchanged) when illegal. */
export function tryMove(chess: Chess, from: string, to: string, promotion?: string): Move | null {
  try {
    return chess.move({ from, to, promotion }) ?? null;
  } catch {
    return null;
  }
}

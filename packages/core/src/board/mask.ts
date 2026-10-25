// 64-square sets as two int32 halves (lo = a1..h4, hi = a5..h8), so legal
// targets live in plain-number SharedValues and selecting a piece never
// renders React (PLAN §2.6). Bit i of the board index = square i.
import { squareIndex } from './geometry';

export type Mask = { lo: number; hi: number };

export const EMPTY_MASK: Mask = { lo: 0, hi: 0 };

export function maskHas(lo: number, hi: number, index: number): boolean {
  'worklet';
  return index < 32 ? ((lo >>> index) & 1) === 1 : ((hi >>> (index - 32)) & 1) === 1;
}

export function maskHasSquare(mask: Mask, sq: string): boolean {
  'worklet';
  return maskHas(mask.lo, mask.hi, squareIndex(sq));
}

export function maskAdd(mask: Mask, index: number): Mask {
  'worklet';
  return index < 32
    ? { lo: (mask.lo | (1 << index)) | 0, hi: mask.hi }
    : { lo: mask.lo, hi: (mask.hi | (1 << (index - 32))) | 0 };
}

export function maskFromSquares(squares: readonly string[]): Mask {
  'worklet';
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < squares.length; i++) {
    const idx = squareIndex(squares[i]);
    if (idx < 32) lo = (lo | (1 << idx)) | 0;
    else hi = (hi | (1 << (idx - 32))) | 0;
  }
  return { lo, hi };
}

export function maskToIndices(lo: number, hi: number): number[] {
  'worklet';
  const out: number[] = [];
  for (let i = 0; i < 32; i++) if ((lo >>> i) & 1) out.push(i);
  for (let i = 0; i < 32; i++) if ((hi >>> i) & 1) out.push(i + 32);
  return out;
}

export function maskCount(lo: number, hi: number): number {
  'worklet';
  let n = 0;
  for (let i = 0; i < 32; i++) n += ((lo >>> i) & 1) + ((hi >>> i) & 1);
  return n;
}

export function maskIsEmpty(lo: number, hi: number): boolean {
  'worklet';
  return lo === 0 && hi === 0;
}

/**
 * Per-origin legal-target table for the side to move: 128 numbers,
 * [2*from] = lo, [2*from+1] = hi. Built on JS from chess.js
 * `moves({verbose:true})` at each FEN change.
 */
export function legalTable(moves: readonly { from: string; to: string }[]): number[] {
  'worklet';
  const t: number[] = new Array(128).fill(0);
  for (let i = 0; i < moves.length; i++) {
    const f = squareIndex(moves[i].from) * 2;
    const to = squareIndex(moves[i].to);
    if (to < 32) t[f] = (t[f] | (1 << to)) | 0;
    else t[f + 1] = (t[f + 1] | (1 << (to - 32))) | 0;
  }
  return t;
}

export function legalTargets(table: readonly number[], from: string): Mask {
  'worklet';
  const f = squareIndex(from) * 2;
  return { lo: table[f] | 0, hi: table[f + 1] | 0 };
}

/** Squares that have at least one legal move (pieces that can be picked up). */
export function movableMask(table: readonly number[]): Mask {
  'worklet';
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < 64; i++) {
    if (table[i * 2] !== 0 || table[i * 2 + 1] !== 0) {
      if (i < 32) lo = (lo | (1 << i)) | 0;
      else hi = (hi | (1 << (i - 32))) | 0;
    }
  }
  return { lo, hi };
}

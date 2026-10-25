import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  SOLVED_PAUSE_MS, buildSolutionFens, initPuzzle, parseUci, uciFromMove, type ServerPuzzle,
} from '../src/puzzle';

// Real Lichess puzzle 00008: the opponent (black) sets up with f2g3,
// then the solver (white) plays the rest of the line.
const P1: ServerPuzzle = {
  id: '00008',
  fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
  moves: ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'],
  rating: 1913,
  themes: ['crushing', 'hangingPiece', 'long', 'middlegame'],
  gameUrl: 'https://lichess.org/787zsVup/black#47',
};

// Promotion in the line: white plays e7e8q after the setup move.
const PROMO: ServerPuzzle = {
  id: 'promo',
  fen: '8/4P3/8/8/8/8/k6p/4K3 b - - 0 1',
  moves: ['a2b2', 'e7e8q'],
  rating: 900,
  themes: ['promotion'],
  gameUrl: null,
};

describe('puzzle', () => {
  it('initPuzzle applies the setup move and hands the turn to the solver', () => {
    const init = initPuzzle(P1);
    expect(init.preFen).toBe(P1.fen);
    expect(init.setupMove).toEqual({ from: 'f2', to: 'g3', promotion: undefined });
    expect(init.remaining).toEqual(P1.moves.slice(1));
    expect(init.playerColor).toBe('w');
    const c = new Chess(P1.fen);
    c.move({ from: 'f2', to: 'g3' });
    expect(init.postFen).toBe(c.fen());
  });

  it('initPuzzle with no moves leaves the position', () => {
    const init = initPuzzle({ ...P1, moves: [] });
    expect(init.setupMove).toBeNull();
    expect(init.postFen).toBe(new Chess(P1.fen).fen());
    expect(init.playerColor).toBe('b');
  });

  it('UCI round-trips, including promotion', () => {
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(parseUci('f2g3')).toEqual({ from: 'f2', to: 'g3', promotion: undefined });
    for (const u of [...P1.moves, ...PROMO.moves]) expect(uciFromMove(parseUci(u))).toBe(u);
  });

  it('buildSolutionFens walks the full line', () => {
    const fens = buildSolutionFens(P1);
    expect(fens).toHaveLength(P1.moves.length + 1);
    expect(fens[0]).toBe(new Chess(P1.fen).fen());
    expect(fens[1]).toBe(initPuzzle(P1).postFen);
    // Last move is the solver's mate-ish capture; side to move flips each ply.
    expect(fens[fens.length - 1].split(' ')[1]).toBe('b');
    const promo = buildSolutionFens(PROMO);
    expect(promo[2].split(' ')[0]).toBe('4Q3/8/8/8/8/8/1k5p/4K3');
  });

  it('buildSolutionFens throws on an illegal line, like the web', () => {
    expect(() => buildSolutionFens({ fen: P1.fen, moves: ['a1a5'] })).toThrow();
  });

  it('solved pause', () => {
    expect(SOLVED_PAUSE_MS).toBe(1000);
  });
});

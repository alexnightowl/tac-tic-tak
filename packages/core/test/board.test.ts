import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import * as board from '../src/board';
import {
  arrowGeometry, boardSize, coordLabels, CLASSIC_FIT, cubicBezier, EMBER_FIT, gridPos,
  isLightSquare, isPromotionMove, legalTable, legalTargets, makeSparks, maskCount,
  maskFromSquares, maskHas, maskHasSquare, maskToIndices, normalizePieceSet,
  pieceFitTransform, promotionPick, promotionPlacement, sparkState, squareCenter,
  squareIndex, squareName, squareToXY, xyToSquare, type Orientation, type Square,
} from '../src/board';

const ALL: Square[] = Array.from({ length: 64 }, (_, i) => squareName(i));
const VIEWS: Array<[Orientation, boolean]> = [
  ['white', false], ['white', true], ['black', false], ['black', true],
];
const SIZE = 400;

describe('worklet directive', () => {
  it('every exported function starts with "worklet"', () => {
    for (const [name, v] of Object.entries(board)) {
      if (typeof v !== 'function') continue;
      expect(/^[^{]*\{\s*['"]worklet['"]/.test(v.toString()), name).toBe(true);
    }
  });
});

describe('squares', () => {
  it('index/name round-trip', () => {
    expect(squareIndex('a1')).toBe(0);
    expect(squareIndex('h8')).toBe(63);
    for (let i = 0; i < 64; i++) expect(squareIndex(squareName(i))).toBe(i);
  });

  it('a1 is dark', () => {
    expect(isLightSquare('a1')).toBe(false);
    expect(isLightSquare('h1')).toBe(true);
  });

  it('64 squares x 2 orientations x mirror round-trip through xy', () => {
    for (const [o, m] of VIEWS) {
      const seen = new Set<string>();
      for (const s of ALL) {
        const p = squareToXY(s, SIZE, o, m);
        const c = squareCenter(s, SIZE, o, m);
        expect(xyToSquare(p.x, p.y, SIZE, o, m)).toBe(s); // top-left corner
        expect(xyToSquare(c.x, c.y, SIZE, o, m)).toBe(s);
        expect(xyToSquare(p.x + SIZE / 8 - 0.001, p.y + SIZE / 8 - 0.001, SIZE, o, m)).toBe(s);
        seen.add(`${p.x},${p.y}`);
      }
      expect(seen.size).toBe(64);
    }
  });

  it('orientation and mirror match the web layout', () => {
    // white: a8 top-left, h1 bottom-right
    expect(gridPos('a8', 'white')).toEqual({ col: 0, row: 0 });
    expect(gridPos('h1', 'white')).toEqual({ col: 7, row: 7 });
    // black reverses both axes
    expect(gridPos('h1', 'black')).toEqual({ col: 0, row: 0 });
    // mirror flips whatever orientation was chosen
    for (const s of ALL) {
      expect(gridPos(s, 'white', true)).toEqual(gridPos(s, 'black'));
      expect(gridPos(s, 'black', true)).toEqual(gridPos(s, 'white'));
    }
  });

  it('hit test rejects points outside the board', () => {
    expect(xyToSquare(-1, 10, SIZE, 'white')).toBeNull();
    expect(xyToSquare(10, SIZE, SIZE, 'white')).toBeNull();
    expect(xyToSquare(10, 10, 0, 'white')).toBeNull();
  });

  it('coordinates sit on the left file and bottom rank', () => {
    expect(coordLabels('a1', 'white')).toEqual({ rank: '1', file: 'a' });
    expect(coordLabels('h8', 'black')).toEqual({ rank: '8', file: 'h' });
    expect(coordLabels('e4', 'white')).toEqual({ rank: null, file: null });
  });

  it('boardSize snaps to whole device pixels per square', () => {
    expect(boardSize(393, 700, 1 / 3)).toBeCloseTo(392, 6);
    expect((boardSize(393, 700, 1 / 3) / 8) * 3 % 1).toBeCloseTo(0, 6);
  });
});

describe('masks', () => {
  it('round-trips every square, including bit 31/63 sign bits', () => {
    const m = maskFromSquares(ALL);
    expect(maskCount(m.lo, m.hi)).toBe(64);
    expect(m.lo).toBe(-1);
    for (const s of ALL) {
      const one = maskFromSquares([s]);
      expect(maskToIndices(one.lo, one.hi)).toEqual([squareIndex(s)]);
      expect(maskHasSquare(one, s)).toBe(true);
      expect(Number.isInteger(one.lo) && Math.abs(one.lo) <= 2 ** 31).toBe(true);
    }
  });

  it('legal table matches chess.js', () => {
    const c = new Chess('r3k2r/pppq1ppp/2n2n2/3pp3/1b1PP3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 0 1');
    const moves = c.moves({ verbose: true });
    const t = legalTable(moves);
    for (const s of ALL) {
      const want = new Set(moves.filter((mv) => mv.from === s).map((mv) => squareIndex(mv.to)));
      const m = legalTargets(t, s);
      expect(new Set(maskToIndices(m.lo, m.hi))).toEqual(want);
      for (let i = 0; i < 64; i++) expect(maskHas(m.lo, m.hi, i)).toBe(want.has(i));
    }
  });
});

describe('arrows', () => {
  const sq = SIZE / 8;

  it('straight arrow: tip on the target, shaft shortened by headLen', () => {
    const g = arrowGeometry('e2', 'e4', SIZE, 'white');
    const to = squareCenter('e4', SIZE, 'white');
    expect(g.head[0]).toEqual(to);
    expect(g.shaft).toHaveLength(2);
    expect(g.shaft[1].x).toBeCloseTo(to.x);
    expect(g.shaft[1].y).toBeCloseTo(to.y + sq * 0.34);
    expect(g.strokeWidth).toBeCloseTo(sq * 0.18);
    expect(Math.hypot(g.head[1].x - g.head[2].x, g.head[1].y - g.head[2].y)).toBeCloseTo(sq * 0.58);
  });

  it('bent knight arrow goes along the long leg first', () => {
    const v = arrowGeometry('g1', 'f3', SIZE, 'white'); // vertical long leg
    const a = squareCenter('g1', SIZE, 'white');
    const b = squareCenter('f3', SIZE, 'white');
    expect(v.bent).toBe(true);
    expect(v.shaft[1]).toEqual({ x: a.x, y: b.y });
    expect(v.shaft[2].x).toBeCloseTo(b.x + sq * 0.34);
    const h = arrowGeometry('b1', 'd2', SIZE, 'black', true); // horizontal long leg
    const a2 = squareCenter('b1', SIZE, 'black', true);
    const b2 = squareCenter('d2', SIZE, 'black', true);
    expect(h.shaft[1]).toEqual({ x: b2.x, y: a2.y });
    expect(arrowGeometry('g1', 'f3', SIZE, 'white', false, 'straight').bent).toBe(false);
    expect(v.shaftPath.startsWith('M ')).toBe(true);
    expect(v.headPath.endsWith('Z')).toBe(true);
  });
});

describe('promotion', () => {
  it('detects pawn moves to the last ranks', () => {
    expect(isPromotionMove('p', 'e8')).toBe(true);
    expect(isPromotionMove('p', 'a1')).toBe(true);
    expect(isPromotionMove('q', 'e8')).toBe(false);
  });

  it('places the column with the queen nearest the target', () => {
    const sq = SIZE / 8;
    const top = promotionPlacement('e8', SIZE, 'white');
    expect(top).toMatchObject({ left: 4 * sq, top: 0, width: sq, height: 4 * sq, downward: true, order: ['q', 'n', 'r', 'b'] });
    // mirror view: white promotes at the bottom edge, so the column grows up
    const bottom = promotionPlacement('e8', SIZE, 'white', true);
    expect(bottom).toMatchObject({ left: 3 * sq, top: 4 * sq, downward: false, order: ['b', 'r', 'n', 'q'] });
    expect(promotionPick(bottom, 3.5 * sq, 7.5 * sq)).toBe('q');
    expect(promotionPick(top, 4.5 * sq, 0.5 * sq)).toBe('q');
    expect(promotionPick(top, 4.5 * sq, 3.5 * sq)).toBe('b');
    expect(promotionPick(top, 0, 0)).toBeNull();
  });
});

describe('sparks', () => {
  it('matches the web constant', () => {
    const s = makeSparks();
    expect(s).toHaveLength(14);
    expect(s[0]).toEqual({ dx: 34, dy: -10, size: 3, color: '#f9b786', ms: 520 });
    expect(s[1]).toEqual({ dx: 33, dy: 15, size: 4, color: '#d35e4a', ms: 580 });
    // verbatim web expression (Chessboard.tsx SPARKS)
    const web = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
      const d = 34 + ((i * 7) % 22);
      return {
        dx: Math.round(Math.cos(a) * d),
        dy: Math.round(Math.sin(a) * d) - 10,
        size: 3 + (i % 3),
        color: i % 3 === 0 ? '#f9b786' : i % 3 === 1 ? '#d35e4a' : '#fddcb1',
        ms: 520 + (i % 4) * 60,
      };
    });
    expect(s).toEqual(web);
    expect(Math.max(...s.map((x) => x.ms))).toBe(700);
    expect(makeSparks()).toEqual(s);
  });

  it('animates from the centre to (dx, dy) with fade and shrink', () => {
    const sp = makeSparks()[3];
    expect(sparkState(sp, 0)).toEqual({ x: 0, y: 0, scale: 1, opacity: 1 });
    const end = sparkState(sp, 10_000, 2);
    expect(end.x).toBeCloseTo(sp.dx * 2);
    expect(end.y).toBeCloseTo(sp.dy * 2);
    expect(end.scale).toBeCloseTo(0.3);
    expect(end.opacity).toBe(0);
  });

  it('cubicBezier solves known curves', () => {
    expect(cubicBezier(0, 0, 1, 1, 0.37)).toBeCloseTo(0.37, 5);
    // CSS ease at 0.5 ≈ 0.8024
    expect(cubicBezier(0.25, 0.1, 0.25, 1, 0.5)).toBeCloseTo(0.8024, 3);
    // overshoot curves exceed 1 mid-way
    let max = 0;
    for (let t = 0; t <= 1; t += 0.01) max = Math.max(max, cubicBezier(0.2, 1.3, 0.4, 1, t));
    expect(max).toBeGreaterThan(1);
  });
});

describe('pieces', () => {
  it('normalises legacy sets to classic', () => {
    expect(normalizePieceSet('ember')).toBe('ember');
    expect(normalizePieceSet('maestro')).toBe('classic');
    expect(normalizePieceSet(null)).toBe('classic');
  });

  it('fit tables mirror lib/pieces.ts (% → fraction)', () => {
    expect(EMBER_FIT.p).toEqual({ scale: 1.1, dx: 0, dy: -0.03 });
    expect(CLASSIC_FIT.n).toEqual({ scale: 1.05, dx: -0.01, dy: -0.03 });
  });

  it('centre-origin transform keeps the base line of the web transform', () => {
    // web: p' = o + t + s(p - o) with o = (0.5, 0.94) * sq
    const sq = 60;
    for (const set of ['ember', 'classic'] as const) {
      for (const type of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
        const f = set === 'ember' ? EMBER_FIT[type] : CLASSIC_FIT[type];
        const tr = pieceFitTransform(set, type, sq);
        for (const [px, py] of [[0, 0], [sq, sq], [0.3 * sq, 0.8 * sq]]) {
          const webX = 0.5 * sq + f.dx * sq + f.scale * (px - 0.5 * sq);
          const webY = 0.94 * sq + f.dy * sq + f.scale * (py - 0.94 * sq);
          const rnX = 0.5 * sq + tr.translateX + tr.scale * (px - 0.5 * sq);
          const rnY = 0.5 * sq + tr.translateY + tr.scale * (py - 0.5 * sq);
          expect(rnX).toBeCloseTo(webX, 9);
          expect(rnY).toBeCloseTo(webY, 9);
        }
      }
    }
  });
});

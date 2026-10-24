import { EMBER_FIT, type PieceType } from '@/lib/pieces';

/**
 * Static hero board: marble + slate squares, Ember pieces and a knight-fork
 * arrow (Ne5→f7, forking king and queen). Decorative only.
 */
const FEN = 'r2q3k/ppp3pp/8/4N3/8/8/PPP2PPP/R2Q2K1';
const POS = ['0% 0%', '100% 0%', '0% 100%', '100% 100%', '50% 50%', '30% 70%', '70% 30%'];

function parse(fen: string) {
  const board: Record<string, string> = {};
  fen.split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      board['abcdefgh'[f] + (8 - i)] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
      f++;
    }
  });
  return board;
}

const BOARD = parse(FEN);

export function LandingBoard() {
  const cells = [];
  for (let r = 8; r >= 1; r--) {
    for (let f = 0; f < 8; f++) {
      const file = 'abcdefgh'[f];
      const sq = file + r;
      const light = (f + r) % 2 === 0;
      const p = BOARD[sq];
      const type = p ? (p[1].toLowerCase() as PieceType) : null;
      const fit = type ? EMBER_FIT[type] : null;
      const coord = light ? '#505059' : '#cdcfd5';
      cells.push(
        <div
          key={sq}
          className={light ? 'sq-marble' : 'sq-slate'}
          style={{ position: 'relative', backgroundPosition: POS[(f * 3 + r * 5) % 7] }}
        >
          {sq === 'e5' && <div className="absolute inset-0" style={{ background: 'rgba(81,123,181,0.38)' }} />}
          {sq === 'f7' && <div className="absolute inset-0" style={{ background: 'rgba(81,123,181,0.22)' }} />}
          {f === 0 && <span className="absolute left-[3px] top-px text-[9px] font-extrabold md:text-[11px]" style={{ color: coord }}>{r}</span>}
          {r === 1 && <span className="absolute bottom-px right-[3px] text-[9px] font-extrabold md:text-[11px]" style={{ color: coord }}>{file}</span>}
          {p && fit && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/design/pieces/${p}.png`}
              alt=""
              draggable={false}
              className="relative block h-full w-full select-none"
              style={{ transform: `translateY(${fit.y}%) scale(${fit.scale})`, transformOrigin: '50% 94%' }}
            />
          )}
        </div>,
      );
    }
  }
  return (
    <div className="relative aspect-square w-full">
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">{cells}</div>
      <svg viewBox="0 0 8 8" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <marker id="lb-ah" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto">
            <path d="M0 0 L4 2 L0 4 z" fill="rgba(82,132,199,0.85)" />
          </marker>
        </defs>
        <path
          d="M4.5 3.2 L4.5 1.5 L5.18 1.5"
          fill="none"
          stroke="rgba(82,132,199,0.85)"
          strokeWidth="0.19"
          strokeLinejoin="round"
          markerEnd="url(#lb-ah)"
        />
      </svg>
    </div>
  );
}

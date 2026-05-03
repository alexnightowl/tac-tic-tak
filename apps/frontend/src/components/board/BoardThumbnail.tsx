'use client';

import { Chess } from 'chess.js';
import { useMemo } from 'react';
import { BOARD_THEMES, BoardTheme } from '@/lib/themes';
import { pieceUrl } from '@/lib/pieces';

type Props = {
  fen: string;
  /** first move (UCI) to apply before rendering — usually the puzzle's setup move */
  setupMove?: string | null;
  /** orientation determined by whose turn it is after the setup move */
  autoOrient?: boolean;
  size?: number;
  theme?: BoardTheme;
  pieceSet?: string;
  className?: string;
};

/**
 * Small static preview of a FEN position. Renders an 8×8 grid of coloured
 * squares with piece sprites overlaid — no interactivity, safe to render
 * many of on a list page.
 */
export function BoardThumbnail({ fen, setupMove, autoOrient = true, size = 120, theme = 'green', pieceSet = 'maestro', className }: Props) {
  const { board, orientation } = useMemo(() => {
    const chess = new Chess(fen);
    if (setupMove) {
      try { chess.move({ from: setupMove.slice(0, 2), to: setupMove.slice(2, 4), promotion: setupMove.length > 4 ? setupMove.slice(4) : undefined }); } catch {}
    }
    const playerColor = chess.turn();
    return { board: chess.board(), orientation: autoOrient && playerColor === 'b' ? 'black' : 'white' as 'white' | 'black' };
  }, [fen, setupMove, autoOrient]);

  const colors = BOARD_THEMES[theme] ?? BOARD_THEMES.green;
  const rows = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const cols = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div
      className={className}
      style={{ width: size, height: size, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)', borderRadius: 8, overflow: 'hidden' }}
    >
      {rows.map((r) =>
        cols.map((c) => {
          const cell = board[r]?.[c];
          const isLight = (r + c) % 2 === 0;
          return (
            <div key={`${r}-${c}`} style={{ background: isLight ? colors.light : colors.dark, position: 'relative' }}>
              {cell && (
                <img
                  src={pieceUrl(pieceSet, cell.color, cell.type as any)}
                  alt=""
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4%' }}
                />
              )}
            </div>
          );
        }),
      )}
    </div>
  );
}

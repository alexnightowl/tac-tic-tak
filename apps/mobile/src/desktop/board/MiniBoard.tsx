import type { AppPieceSet } from '@tac/core/board';
import { initPuzzle, type ServerPuzzle } from '@tac/core/puzzle';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BOARD_IMAGE, PIECE_IMAGES, type PieceCode } from '@/board/assets';

// A static board picture (DXSessionSummary's session puzzles): the board
// art and the pieces of the position the player was given (after the
// opponent's setup move), from the player's side. No interaction.

type Placed = { code: PieceCode; col: number; row: number };

function placementOf(fen: string, flip: boolean): Placed[] {
  const out: Placed[] = [];
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((r, rank) => {
    let file = 0;
    for (const ch of r) {
      const n = Number(ch);
      if (n) {
        file += n;
        continue;
      }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      const code = `${color}${ch.toUpperCase()}` as PieceCode;
      out.push({ code, col: flip ? 7 - file : file, row: flip ? 7 - rank : rank });
      file += 1;
    }
  });
  return out;
}

export function MiniBoard({ puzzle, size, pieceSet }: { puzzle: ServerPuzzle; size: number; pieceSet: AppPieceSet }) {
  const pieces = useMemo(() => {
    try {
      const init = initPuzzle(puzzle);
      return placementOf(init.postFen, init.playerColor === 'b');
    } catch {
      return placementOf(puzzle.fen, false);
    }
  }, [puzzle]);
  const sq = size / 8;
  return (
    <View style={[styles.board, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={BOARD_IMAGE} style={StyleSheet.absoluteFill} contentFit="fill" transition={null} />
      {pieces.map((p, i) => (
        <Image
          key={i}
          source={PIECE_IMAGES[pieceSet][p.code]}
          style={{ position: 'absolute', left: p.col * sq, top: p.row * sq, width: sq, height: sq }}
          contentFit="contain"
          transition={null}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { overflow: 'hidden', borderRadius: 4 },
});

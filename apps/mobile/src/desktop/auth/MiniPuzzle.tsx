import { alpha, black, white } from '@tac/core/tokens';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Board, type BoardHandle, type BoardMove } from '@/board';
import { feel } from '@/feel';

/** The phone onboarding's back-rank mate (TrainingBoard), now playable: Rd8#. */
export const MINI_PUZZLE_FEN = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
const SOLUTION = 'Rd8#';

export type MiniPuzzleState = { kind: 'idle' } | { kind: 'wrong' } | { kind: 'solved'; seconds: number };

/**
 * DXOnb2's board as a real one-move puzzle on the app's Board: the right
 * move flashes, sparks and locks the board; any other legal move is taken
 * back with the runner's mistake feedback. Remount (a new `key`) for a
 * fresh try.
 */
export function MiniPuzzle({
  size,
  label,
  onState,
}: {
  size: number;
  label: string;
  onState: (s: MiniPuzzleState) => void;
}) {
  const ref = useRef<BoardHandle>(null);
  const [startedAt] = useState(() => Date.now());
  const onMove = (m: BoardMove) => {
    const board = ref.current;
    if (m.san === SOLUTION) {
      board?.setInteractive(false);
      feel.emit('correct');
      void board?.flash(m.to, true);
      void board?.sparks(m.to);
      onState({ kind: 'solved', seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)) });
      return true;
    }
    feel.emit('mistake');
    void board?.flash(m.to, false);
    void board?.shake(m.from);
    onState({ kind: 'wrong' });
    return false;
  };
  return (
    <View style={[styles.frame, { width: size, height: size }]} accessibilityLabel={label} testID="onboarding-puzzle">
      <Board ref={ref} initialFen={MINI_PUZZLE_FEN} moveFeel="caller" onMove={onMove} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 8,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(white, 0.06) },
      { offsetX: 0, offsetY: 24, blurRadius: 60, spreadDistance: 0, color: alpha(black, 0.6) },
    ],
  },
});

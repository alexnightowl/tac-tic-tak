import { alpha, eos } from '@tac/core/tokens';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';

import { useRawWindow } from '@/platform/webFrame';
import { dx, dxSize } from '../tokens';

// The board screens' desktop stage (DXSession, DXStormRun, DXReviewDrill,
// DXChapterSolve): the board on the left, a 400 px panel on the right,
// both centred in the space beside the compact rail. The board's side comes
// from the stage's own size (onLayout), so it fits 1024 × 768 without a
// scroll and reaches the artboard's 720 px on 1440 × 900.

/** Artboard board side (1440 × 900). */
const BOARD_MAX = 720;
const PANEL = 400;
const PANEL_NARROW = 340;
const GAP = 36;
const PAD_X = 40;
/** Space kept above and below the board. */
const PAD_Y = 40;

export type StageSize = { board: number; panel: number };

function fit(w: number, h: number): StageSize {
  const panel = w >= 1180 ? PANEL : PANEL_NARROW;
  const side = Math.min(BOARD_MAX, h - PAD_Y * 2, w - PAD_X * 2 - GAP - panel);
  // Whole-pixel squares: a multiple of 8.
  return { board: Math.max(240, Math.floor(side / 8) * 8), panel };
}

/**
 * `board(size)` draws the board at `size` px; `panel` is the right column
 * (stretched to the board's height, a flex column with gap 14).
 */
export function BoardStage({
  board,
  panel,
  panelGap = 14,
  testID,
}: {
  board: (size: number) => ReactNode;
  panel: ReactNode;
  panelGap?: number;
  testID: string;
}) {
  // First guess from the window (the board must mount at once: a runner
  // that starts before the Board's ref attaches would lose its first
  // position), then the stage's own size.
  const win = useRawWindow();
  const [size, setSize] = useState<StageSize>(() => fit(win.width - dxSize.sidebarCompact, win.height));
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const next = fit(width, height);
    if (next.board !== size.board || next.panel !== size.panel) setSize(next);
  };
  return (
    <View style={styles.root} onLayout={onLayout} testID={testID}>
      <View style={[styles.board, { width: size.board, height: size.board }]}>{board(size.board)}</View>
      <View style={[styles.panel, { width: size.panel, minHeight: size.board, gap: panelGap }]}>{panel}</View>
    </View>
  );
}

/** The board's frame: 8 px corners, a hairline and the drop shadow under it. */
export const boardFrame: ViewStyle = {
  borderRadius: 8,
  overflow: 'hidden',
  boxShadow: [
    { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.06) },
    { offsetX: 0, offsetY: 24, blurRadius: 60, spreadDistance: 0, color: dx.popShadow },
  ],
};

/** A centred block in the stage (loading, errors, a finished drill). */
export function StageMessage({ children, testID }: { children: ReactNode; testID: string }) {
  return (
    <View style={styles.message} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GAP,
    paddingHorizontal: PAD_X,
    backgroundColor: eos.ink,
  },
  board: { flexShrink: 0, ...boardFrame },
  panel: { flexShrink: 0 },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40, backgroundColor: eos.ink },
});

// User-drawn arrows and square marks (the web's right-click drawing,
// apps/frontend Chessboard onRightDown / arrowDrag / highlights). A small
// per-board store: the input (useMouseDrawing, web only) writes it and the
// two layers below subscribe, so drawing never re-renders the Board.
import { squareToXY, type KnightArrowMode, type Orientation, type Square } from '@tac/core/board';
import { board as BOARD } from '@tac/core/tokens';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { Arrows, type ArrowSpec } from './Layers';

type Geo = { size: number; orientation: Orientation; mirror: boolean };

export type DrawingState = {
  arrows: readonly ArrowSpec[];
  marks: readonly Square[];
  /** The arrow being dragged out (not yet committed). */
  pending: ArrowSpec | null;
};

const EMPTY: DrawingState = { arrows: [], marks: [], pending: null };

export type Drawing = ReturnType<typeof createDrawing>;

export function createDrawing() {
  let state = EMPTY;
  const subs = new Set<() => void>();
  const set = (next: DrawingState) => {
    state = next;
    for (const f of subs) f();
  };
  return {
    get: () => state,
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    setPending: (pending: ArrowSpec | null) => {
      const p = state.pending;
      if (p === pending || (p && pending && p.from === pending.from && p.to === pending.to)) return;
      set({ ...state, pending });
    },
    /** Adds the arrow, or removes it when the same one is already drawn. */
    toggleArrow: (from: Square, to: Square) => {
      const has = state.arrows.some((a) => a.from === from && a.to === to);
      set({
        ...state,
        pending: null,
        arrows: has ? state.arrows.filter((a) => a.from !== from || a.to !== to) : [...state.arrows, { from, to }],
      });
    },
    toggleMark: (sq: Square) => {
      const has = state.marks.includes(sq);
      set({ ...state, pending: null, marks: has ? state.marks.filter((m) => m !== sq) : [...state.marks, sq] });
    },
    /** Left click and every position change wipe the drawing (web parity). */
    clear: () => {
      if (state !== EMPTY) set(EMPTY);
    },
  };
}

function useDrawing(drawing: Drawing): DrawingState {
  return useSyncExternalStore(drawing.subscribe, drawing.get, drawing.get);
}

/** Marked squares, under the pieces. */
export function UserMarks({ drawing, size, orientation, mirror }: Geo & { drawing: Drawing }) {
  const { marks } = useDrawing(drawing);
  if (marks.length === 0) return null;
  const s = size / 8;
  return (
    <>
      {marks.map((sq) => {
        const p = squareToXY(sq, size, orientation, mirror);
        return (
          <View
            key={sq}
            pointerEvents="none"
            testID={`board-mark-${sq}`}
            style={[styles.mark, { width: s, height: s, transform: [{ translateX: p.x }, { translateY: p.y }] }]}
          />
        );
      })}
    </>
  );
}

/** Drawn arrows plus the one being dragged out, above the pieces. */
export function UserArrows({ drawing, knightArrow, ...g }: Geo & { drawing: Drawing; knightArrow: KnightArrowMode }) {
  const { arrows, pending } = useDrawing(drawing);
  return <Arrows arrows={pending ? [...arrows, pending] : arrows} knightArrow={knightArrow} testID="board-user-arrows" {...g} />;
}

const styles = StyleSheet.create({
  mark: { position: 'absolute', left: 0, top: 0, backgroundColor: BOARD.userHighlight },
});

import type { Orientation } from '@tac/core/board';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * The board's UI-thread state. Gestures write it, layers read it in
 * useAnimatedStyle; JS writes it only on position changes and imperative
 * calls. Squares are indices (a1 = 0), -1 = none.
 */
export type BoardShared = {
  /** Geometry mirrored from React state so gesture worklets stay stable. */
  size: SharedValue<number>;
  orientation: SharedValue<Orientation>;
  mirror: SharedValue<boolean>;
  interactive: SharedValue<boolean>;
  /** True while animateMove slides (the opponent is moving): input blocked (PLAN §2.6). */
  locked: SharedValue<boolean>;
  /** 128 numbers: legal targets per origin as int32 lo/hi (legalTable). */
  legal: SharedValue<number[]>;
  /** 64 code indices (PIECE_CODES order), -1 = empty. */
  codes: SharedValue<number[]>;
  /** 0 = white to move, 1 = black. */
  turn: SharedValue<number>;
  selected: SharedValue<number>;
  selLo: SharedValue<number>;
  selHi: SharedValue<number>;
  lastFrom: SharedValue<number>;
  lastTo: SharedValue<number>;
  /** Legal square under the finger while dragging. */
  hover: SharedValue<number>;
  hintFrom: SharedValue<number>;
  hintTo: SharedValue<number>;
  hintPulse: SharedValue<number>;
  flashSq: SharedValue<number>;
  flashOk: SharedValue<boolean>;
  flashOpacity: SharedValue<number>;
  shakeSq: SharedValue<number>;
  shakeX: SharedValue<number>;
  sparkSq: SharedValue<number>;
  sparkClock: SharedValue<number>;
  // drag
  dragSq: SharedValue<number>;
  dragCode: SharedValue<number>;
  dragVisible: SharedValue<number>;
  dragScale: SharedValue<number>;
  fingerX: SharedValue<number>;
  fingerY: SharedValue<number>;
  offX: SharedValue<number>;
  offY: SharedValue<number>;
  // gesture bookkeeping
  downSq: SharedValue<number>;
  prevSel: SharedValue<number>;
  dragging: SharedValue<boolean>;
  pickupSent: SharedValue<boolean>;
  lastHoverAt: SharedValue<number>;
  /** Animation clock for animateMove / setPosition promises. */
  clock: SharedValue<number>;
};

export function useBoardShared(codes: number[], legal: number[], turn: number): BoardShared {
  return {
    size: useSharedValue(0),
    orientation: useSharedValue<Orientation>('white'),
    mirror: useSharedValue(false),
    interactive: useSharedValue(true),
    locked: useSharedValue(false),
    legal: useSharedValue<number[]>(legal),
    codes: useSharedValue<number[]>(codes),
    turn: useSharedValue(turn),
    selected: useSharedValue(-1),
    selLo: useSharedValue(0),
    selHi: useSharedValue(0),
    lastFrom: useSharedValue(-1),
    lastTo: useSharedValue(-1),
    hover: useSharedValue(-1),
    hintFrom: useSharedValue(-1),
    hintTo: useSharedValue(-1),
    hintPulse: useSharedValue(0),
    flashSq: useSharedValue(-1),
    flashOk: useSharedValue(true),
    flashOpacity: useSharedValue(0),
    shakeSq: useSharedValue(-1),
    shakeX: useSharedValue(0),
    sparkSq: useSharedValue(-1),
    sparkClock: useSharedValue(0),
    dragSq: useSharedValue(-1),
    dragCode: useSharedValue(-1),
    dragVisible: useSharedValue(0),
    dragScale: useSharedValue(1),
    fingerX: useSharedValue(0),
    fingerY: useSharedValue(0),
    offX: useSharedValue(0),
    offY: useSharedValue(0),
    downSq: useSharedValue(-1),
    prevSel: useSharedValue(-1),
    dragging: useSharedValue(false),
    pickupSent: useSharedValue(false),
    lastHoverAt: useSharedValue(0),
    clock: useSharedValue(0),
  };
}

import type { Orientation } from '@tac/core/board';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { PieceCode } from './assets';

/**
 * One mounted piece view's UI-thread state. The board's plans write it on the
 * UI thread (slides, captures, cover); React only mounts / unmounts the view
 * and keeps its testID current.
 */
export type PieceHandle = {
  /** The code the view renders (its sprite): a plan may only move it if unchanged. */
  code: PieceCode;
  x: SharedValue<number>;
  y: SharedValue<number>;
  fade: SharedValue<number>;
  scale: SharedValue<number>;
  /** Square index the piece stands on (or slides to); drag-hide and shake key on it. */
  at: SharedValue<number>;
  /** 1 while the slide cover draws this piece above the others. */
  hide: SharedValue<number>;
  /** 1 once captured (fading out, ignored by drag-hide and shake). */
  dead: SharedValue<number>;
};

/** Mounted piece views by id, filled by the pieces' layout effects. */
export type PieceRegistry = Map<number, PieceHandle>;

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
  /** Occupied squares (int32 lo/hi): splits the selection's targets into dots and rings. */
  occLo: SharedValue<number>;
  occHi: SharedValue<number>;
  /** 0 = white to move, 1 = black. */
  turn: SharedValue<number>;
  selected: SharedValue<number>;
  selLo: SharedValue<number>;
  selHi: SharedValue<number>;
  /** selLo/selHi split into empty targets (dots) and occupied ones (rings). */
  dotLo: SharedValue<number>;
  dotHi: SharedValue<number>;
  ringLo: SharedValue<number>;
  ringHi: SharedValue<number>;
  /** Checked king's square, -1 = none. */
  checkSq: SharedValue<number>;
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
  /** 0 none, 1 drop settling, 2 settled, 3 committed while settling (handoff at settle end). */
  dropPhase: SharedValue<number>;
  /** Animation clock for animateMove / setPosition promises. */
  clock: SharedValue<number>;
  /** True while the clock runs: the deferred React reconcile waits for it. */
  slideBusy: SharedValue<boolean>;
  /** Idle probe after the last slide; its end reconciles React. */
  idle: SharedValue<number>;
  // slide cover: the main mover drawn above every piece while it slides
  coverCode: SharedValue<number>;
  coverX: SharedValue<number>;
  coverY: SharedValue<number>;
  /** The cover's target square: hidden while a drop settles onto it (the drag overlay draws it). */
  coverSq: SharedValue<number>;
  /** Bumped whenever the cover changes hands; a stale hold timer then does nothing. */
  coverToken: SharedValue<number>;
  coverHold: SharedValue<number>;
};

export function useBoardShared(
  codes: number[],
  legal: number[],
  turn: number,
  occ: [number, number],
  checkSq: number,
): BoardShared {
  return {
    size: useSharedValue(0),
    orientation: useSharedValue<Orientation>('white'),
    mirror: useSharedValue(false),
    interactive: useSharedValue(true),
    locked: useSharedValue(false),
    legal: useSharedValue<number[]>(legal),
    codes: useSharedValue<number[]>(codes),
    occLo: useSharedValue(occ[0]),
    occHi: useSharedValue(occ[1]),
    turn: useSharedValue(turn),
    selected: useSharedValue(-1),
    selLo: useSharedValue(0),
    selHi: useSharedValue(0),
    dotLo: useSharedValue(0),
    dotHi: useSharedValue(0),
    ringLo: useSharedValue(0),
    ringHi: useSharedValue(0),
    checkSq: useSharedValue(checkSq),
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
    dropPhase: useSharedValue(0),
    clock: useSharedValue(0),
    slideBusy: useSharedValue(false),
    idle: useSharedValue(0),
    coverCode: useSharedValue(-1),
    coverX: useSharedValue(0),
    coverY: useSharedValue(0),
    coverSq: useSharedValue(-1),
    coverToken: useSharedValue(0),
    coverHold: useSharedValue(0),
  };
}

import { pieceFitTransform, squareIndex, squareToXY, type AppPieceSet, type Orientation, type PieceType, type Square } from '@tac/core/board';
import { easing as EASE } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { memo, useLayoutEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { useRenderCount } from '@/dev/renderCount';
import { PIECE_IMAGES, type PieceCode } from './assets';
import { CAPTURE_END_SCALE, CAPTURE_FADE_MS } from './constants';

const slideEasing = Easing.bezier(...EASE.slide);

export type PieceProps = {
  /** Stable piece id (dev render counter key). */
  id: number;
  code: PieceCode;
  sq: Square;
  size: number;
  orientation: Orientation;
  mirror: boolean;
  set: AppPieceSet;
  /** Slide duration for this commit (0 = jump). Read only when the square changes. */
  ms: number;
  /** Captured on this commit: fade/scale out where it stands. */
  dying: boolean;
  z: number;
  /** Square index whose piece is hidden because the drag overlay shows it. */
  dragSq: SharedValue<number>;
  shakeSq: SharedValue<number>;
  /** Shake offset in squares. */
  shakeX: SharedValue<number>;
};

/**
 * One piece view. Its position lives in SharedValues; React only re-renders
 * it when its square/code changes (a committed move), never during a drag.
 */
function PieceImpl({ id, code, sq, size, orientation, mirror, set, ms, dying, z, dragSq, shakeSq, shakeX }: PieceProps) {
  // Per-instance key: the lab sums 'Piece:*' for a total.
  useRenderCount(`Piece:${id}`);
  const s = size / 8;
  const target = squareToXY(sq, size, orientation, mirror);
  const x = useSharedValue(target.x);
  const y = useSharedValue(target.y);
  const fade = useSharedValue(1);
  const scale = useSharedValue(1);
  const idx = squareIndex(sq);

  // Animate only when the square changes: a later commit that leaves this
  // piece alone (ms back to 0) must not cut its running slide short, and a
  // flip / mirror / resize jumps (`ms` is the last commit's, stale here).
  const placed = useRef({ sq, x: target.x, y: target.y });
  useLayoutEffect(() => {
    const prev = placed.current;
    if (prev.x === target.x && prev.y === target.y) return;
    placed.current = { sq, x: target.x, y: target.y };
    if (ms > 0 && prev.sq !== sq) {
      x.set(withTiming(target.x, { duration: ms, easing: slideEasing }));
      y.set(withTiming(target.y, { duration: ms, easing: slideEasing }));
    } else {
      x.set(target.x);
      y.set(target.y);
    }
  }, [sq, target, ms, x, y]);

  useLayoutEffect(() => {
    if (!dying) return;
    // The capturer covers the square first, then the victim fades under it.
    const delay = Math.round(ms * 0.55);
    fade.set(withDelay(delay, withTiming(0, { duration: CAPTURE_FADE_MS })));
    scale.set(withDelay(delay, withTiming(CAPTURE_END_SCALE, { duration: CAPTURE_FADE_MS })));
  }, [dying, ms, fade, scale]);

  const style = useAnimatedStyle(() => {
    const hidden = !dying && dragSq.get() === idx;
    const dx = shakeSq.get() === idx && !dying ? shakeX.get() * s : 0;
    return {
      opacity: hidden ? 0 : fade.get(),
      transform: [{ translateX: x.get() + dx }, { translateY: y.get() }, { scale: scale.get() }],
    };
  });

  const fit = pieceFitTransform(set, code[1].toLowerCase() as PieceType, s);
  return (
    <Animated.View
      pointerEvents="none"
      testID={dying ? undefined : `piece-${sq}-${code}`}
      style={[styles.piece, { width: s, height: s, zIndex: z }, style]}
    >
      <Image
        source={PIECE_IMAGES[set][code]}
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: fit.translateX }, { translateY: fit.translateY }, { scale: fit.scale }] }]}
        contentFit="contain"
        cachePolicy="memory"
        transition={null}
      />
    </Animated.View>
  );
}

/** memo: a commit re-renders only the pieces whose props changed. */
export const Piece = memo(PieceImpl);

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0 },
});

import { pieceFitTransform, squareIndex, squareToXY, type AppPieceSet, type Orientation, type PieceType, type Square } from '@tac/core/board';
import { Image } from 'expo-image';
import { memo, useLayoutEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useRenderCount } from '@/dev/renderCount';
import { PIECE_IMAGES, type PieceCode } from './assets';
import type { PieceRegistry } from './shared';

export type PieceProps = {
  /** Stable piece id (registry key, dev render counter key). */
  id: number;
  code: PieceCode;
  /** Square as React last saw it: the testID, and the mount-time placement. */
  sq: Square;
  size: number;
  orientation: Orientation;
  mirror: boolean;
  set: AppPieceSet;
  /** Captured (React side): drops the testID. The fade itself runs on the UI thread. */
  dying: boolean;
  registry: PieceRegistry;
  /** Square index whose piece is hidden because the drag overlay shows it. */
  dragSq: SharedValue<number>;
  shakeSq: SharedValue<number>;
  /** Shake offset in squares. */
  shakeX: SharedValue<number>;
};

/**
 * One piece view. After mount its position, square, fade and visibility
 * live in SharedValues that the board's plans drive on the UI thread, so a
 * move starts sliding without a React commit and the later reconcile (new
 * testID) never moves it again. React re-renders it only for that reconcile.
 */
function PieceImpl({ id, code, sq, size, orientation, mirror, set, dying, registry, dragSq, shakeSq, shakeX }: PieceProps) {
  // Per-instance key: the lab sums 'Piece:*' for a total.
  useRenderCount(`Piece:${id}`);
  const s = size / 8;
  // Initial values only (useSharedValue ignores later ones).
  const start = squareToXY(sq, size, orientation, mirror);
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const fade = useSharedValue(1);
  const scale = useSharedValue(1);
  const at = useSharedValue(squareIndex(sq));
  const hide = useSharedValue(0);
  const dead = useSharedValue(0);

  // Child layout effects run before the board's, so a plan queued behind
  // this commit finds the handle.
  useLayoutEffect(() => {
    const handle = { code, x, y, fade, scale, at, hide, dead };
    registry.set(id, handle);
    return () => {
      if (registry.get(id) === handle) registry.delete(id);
    };
  }, [registry, id, code, x, y, fade, scale, at, hide, dead]);

  const style = useAnimatedStyle(() => {
    const a = at.get();
    const live = dead.get() === 0;
    const hidden = hide.get() === 1 || (live && dragSq.get() === a);
    const dx = live && shakeSq.get() === a ? shakeX.get() * s : 0;
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
      style={[styles.piece, { width: s, height: s }, style]}
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

/** memo: a reconcile re-renders only the pieces whose square/code/fate changed. */
export const Piece = memo(PieceImpl);

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0 },
});

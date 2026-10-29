import { normalizePieceSet } from '@tac/core/board';
import { eos } from '@tac/core/tokens';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Board, type BoardHandle, type BoardMove } from '@/board';
import { useAppStore } from '@/stores/appStore';
import { crossfadeTiming } from '../motion';
import type { PracticeController } from './PracticeController';

/**
 * The practice board slot: the memoised Board (stable props only), the
 * in-place cross-fade between puzzles (an opacity SharedValue the
 * controller drives through its fader), a spinner while nothing is loaded,
 * and an optional overlay (the viewer's step-swipe surface).
 */
export function PracticeBoard({
  controller,
  boardRef,
  onMove,
  loading,
  overlay,
}: {
  controller: PracticeController;
  boardRef: (h: BoardHandle | null) => void;
  onMove: (m: BoardMove) => boolean;
  loading: boolean;
  overlay?: ReactNode;
}) {
  const pieceSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const mirror = useAppStore((s) => s.settings.mirrorView);
  const opacity = useSharedValue(1);
  // Yoga drops aspectRatio on a stretched child: the square comes from the window width.
  const { width } = useWindowDimensions();

  useEffect(() => {
    controller.setFader((to, done) => {
      opacity.set(
        // Fires on interruption too: the swap must never stall.
        withTiming(to, crossfadeTiming, () => {
          'worklet';
          if (done) scheduleOnRN(done);
        }),
      );
    });
    return () => controller.setFader(null);
  }, [controller, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View style={[styles.slot, { height: width }]}>
      <Animated.View style={[styles.fill, fade]}>
        <Board
          ref={boardRef}
          onMove={onMove}
          moveFeel="caller"
          pieceSet={pieceSet}
          mirror={mirror}
          style={styles.board}
        />
      </Animated.View>
      {overlay}
      {loading && (
        <View style={styles.spinner} pointerEvents="none">
          <ActivityIndicator color={eos.ember} size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Square, so the controls below sit right under the board (design: 12 pt
  // gap); on a short phone it shrinks and the board centres in it.
  slot: { alignSelf: 'stretch', flexShrink: 1, minHeight: 0 },
  fill: { flex: 1 },
  // Top-aligned so the board sits at the same y on every board screen.
  board: { flex: 1, alignSelf: 'stretch', justifyContent: 'flex-start' },
  spinner: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});

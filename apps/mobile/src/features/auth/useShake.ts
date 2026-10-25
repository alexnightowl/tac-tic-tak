import { keyframes, keyframeStops } from '@tac/core/tokens';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { bezier } from '@/ui/motion';

/** Form-shake amplitude: pieceShakeX stops are fractions; ±0.06 → ±7 pt. */
const AMPLITUDE_PT = 120;

/**
 * Error shake for a form block, reusing the piece-shake keyframes so the
 * two read as one gesture. UI thread only; off under reduced motion.
 */
export function useShake() {
  const x = useSharedValue(0);
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  const shake = () => {
    if (reduced) return;
    const d = keyframes.pieceShake.duration;
    const easing = bezier(keyframes.pieceShake.easing);
    const stops = keyframeStops.pieceShakeX;
    x.set(0);
    x.set(
      withSequence(
        ...stops.slice(1).map(([at, v], i) =>
          withTiming(v * AMPLITUDE_PT, { duration: d * (at - stops[i][0]), easing }),
        ),
      ),
    );
  };

  return { style, shake };
}

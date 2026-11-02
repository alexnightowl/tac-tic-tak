import { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { ease, kf, useTrack, type Stops } from '@/features/onboarding/motion';

// Course screens' motion (canvas LearnChapterDone / LearnCourseDone
// keyframes), on the onboarding track helpers: each CSS animation is a
// 0→1 SharedValue re-eased per keyframe segment. Belongs in
// src/feel/motion.ts once that module exists (as onboarding's does).
// Reduced motion: the glow holds still, the sparks are off, the
// certificate and medal appear in place.

/** `glow 3s ease-in-out infinite`: opacity .6 → 1 → .6. */
export const GLOW = { duration: 3000, loop: true, stops: [[0, 0.6], [0.5, 1], [1, 0.6]] as Stops, still: 0.8 } as const;

/** `rise 4s ease-out infinite`: 0 → −120 pt, opacity 0 → .9 (15 %) → 0. Lefts in canvas pt of 402 wide, bottom 260. */
export const SPARKS = {
  duration: 4000,
  rise: 120,
  opacity: [[0, 0], [0.15, 0.9], [1, 0]] as Stops,
  sparks: [
    { left: 60, delay: 0 },
    { left: 120, delay: 1300 },
    { left: 200, delay: 600 },
    { left: 280, delay: 2000 },
    { left: 330, delay: 1000 },
  ],
  bottom: 260,
  size: 4,
} as const;

/** App-only entrance (the canvas draws the end state): the medal / certificate settle in. */
export const SETTLE = { duration: 700, delay: 120, rise: 14, from: 0.94 } as const;

const easeOut = ease.out;
const easeInOut = ease.inOut;
const outSoft = ease.outSoft;

export function useGlowStyle() {
  const p = useTrack({ duration: GLOW.duration, loop: true }, 0.5);
  const reduced = useReducedMotion();
  return useAnimatedStyle(() => ({ opacity: reduced ? GLOW.still : kf(p.get(), GLOW.stops, easeInOut) }));
}

export function useSparkStyle(delay: number) {
  const p = useTrack({ duration: SPARKS.duration, delay, loop: true }, 0);
  return useAnimatedStyle(() => {
    const v = p.get();
    return { opacity: kf(v, SPARKS.opacity, easeOut), transform: [{ translateY: -SPARKS.rise * easeOut(v) }] };
  });
}

/** Rises 14 pt and scales from .94 while fading in; still under reduced motion. */
export function useSettleStyle(delay: number = SETTLE.delay) {
  const p = useTrack({ duration: SETTLE.duration, delay }, 1);
  return useAnimatedStyle(() => {
    const v = outSoft(p.get());
    return { opacity: v, transform: [{ translateY: (1 - v) * SETTLE.rise }, { scale: SETTLE.from + (1 - SETTLE.from) * v }] };
  });
}

/** Whether decorative loops (the sparks) run at all. */
export const useSparksOn = () => !useReducedMotion();

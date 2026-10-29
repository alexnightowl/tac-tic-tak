import { easing, type Bezier } from '@tac/core/tokens';
import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

// Onboarding motion (MobOnboarding1–4 keyframes), in one place. The canvas
// writes CSS animations; each one here is a 0→1 progress SharedValue that
// runs linearly, and the keyframe stops are re-eased per segment by
// `kf()` — exactly how CSS applies `animation-timing-function` between
// keyframes. Belongs in src/feel/motion.ts once that module exists.

export type Stops = readonly (readonly [number, number])[];
type EaseFn = (t: number) => number;

/** cubic-bezier(.2,.8,.2,1): every entrance on these screens. */
export const EASE_OUT_SOFT: Bezier = [0.2, 0.8, 0.2, 1];

function fn(b: Bezier): EaseFn {
  return Easing.bezierFn(b[0], b[1], b[2], b[3]);
}

export const ease = {
  outSoft: fn(EASE_OUT_SOFT),
  inOut: fn(easing.easeInOut),
  out: fn(easing.easeOut),
  linear: (t: number) => {
    'worklet';
    return t;
  },
  /** The demo-board loop: cubic-bezier(.45,0,.25,1). */
  board: fn([0.45, 0, 0.25, 1]),
  /** Logo ripples: cubic-bezier(.2,.6,.3,1). */
  ripple: fn([0.2, 0.6, 0.3, 1]),
  /** Rank path trail: cubic-bezier(.4,0,.2,1). */
  trail: fn([0.4, 0, 0.2, 1]),
} as const;

/**
 * Value of a CSS keyframe track at progress `p` (0…1): stops are
 * `[offset, value]`, the easing applies within each segment.
 */
export function kf(p: number, stops: Stops, e: EaseFn): number {
  'worklet';
  if (p <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const t1 = stops[i][0];
    if (p <= t1) {
      const t0 = stops[i - 1][0];
      const v0 = stops[i - 1][1];
      const u = t1 === t0 ? 1 : (p - t0) / (t1 - t0);
      return v0 + (stops[i][1] - v0) * e(u);
    }
  }
  return stops[stops.length - 1][1];
}

/** One CSS animation: duration and delay in ms, run once or forever. */
export type Track = { duration: number; delay?: number; loop?: boolean };

/**
 * Progress 0→1 for a CSS animation with `fill-mode: both` (holds 0 during
 * the delay, then 0→1 linearly; loops restart at 0). Under reduced motion
 * it parks at `still` (the frame the canvas would show without motion).
 */
export function useTrack({ duration, delay = 0, loop = false }: Track, still = 1): SharedValue<number> {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? still : 0);
  useEffect(() => {
    if (reduced) {
      p.set(still);
      return;
    }
    p.set(0);
    const run = withTiming(1, { duration, easing: Easing.linear });
    p.set(withDelay(delay, loop ? withRepeat(run, -1, false) : run));
    return () => cancelAnimation(p);
  }, [p, reduced, duration, delay, loop, still]);
  return p;
}

// ---- The canvas values -------------------------------------------------

/** `.in1`–`.in4`: `up .7s cubic-bezier(.2,.8,.2,1)` from translateY(14px). */
export const ENTRANCE = { duration: 700, rise: 14, delays: [150, 280, 410, 600] } as const;

/** MobOnboarding1 hero. */
export const WELCOME = {
  breathe: { duration: 4800, loop: true },
  ripple: { duration: 3600, loop: true, delays: [0, 1200, 2400] },
  logoIn: { duration: 1100 },
  float: { duration: 6000, delay: 1000, loop: true },
} as const;

/** MobOnboarding2 board: one 5.2 s loop after 0.6 s; boardIn .8s. */
export const TRAINING = {
  boardIn: { duration: 800 },
  loop: { duration: 5200, delay: 600, loop: true },
  /** Reduced motion: the mate frame (rook on d8, glow and pill shown). */
  stillAt: 0.75,
} as const;

/** MobOnboarding3 rank path. */
export const PATH = {
  trail: { duration: 1800, delay: 200 },
  pop: { duration: 700, delays: [250, 430, 610, 790, 970] },
  glow: { duration: 3200, loop: true },
  spin: { duration: 14000, loop: true },
  drift: { duration: 3600, loop: true, delays: [1200, 2300, 3200, 4100] },
} as const;

/** MobOnboarding4 habit card. */
export const HABIT = {
  cardIn: { duration: 700, delays: [100, 1400] },
  heat: { duration: 2400, loop: true },
  flick: { duration: 1600, loop: true },
  dayIn: { duration: 500, delays: [450, 570, 690, 810, 930, 1050, 1170] },
  check: { duration: 350, delays: [700, 820, null, 1060, 1180, null, null] },
  today: { duration: 1800, delay: 1530, loop: true },
} as const;

import { Easing, type WithTimingConfig } from 'react-native-reanimated';

// Storm motion (folds into src/feel/motion.ts once it exists). The time bar
// drains linearly towards the deadline; a combo bonus floats a "+3 s" chip
// up from the clock and fades it. Reduced motion: the chip fades in place.

/** The bar's step when the deadline moves (a bonus or a penalty). */
export const BAR_JUMP: WithTimingConfig = { duration: 220, easing: Easing.out(Easing.cubic) };

/** Bonus chip: rises this far while fading over FLOAT_MS. */
export const BONUS_FLOAT = { rise: 18, inMs: 140, holdMs: 520, outMs: 360 } as const;

/** The pause between a run's end and the result (lets the last reveal / gong land). */
export const END_HOLD_MS = { quit: 0, time: 700, lives: 1300, stream: 600 } as const;

/** Clock turns ember at or below this (STORM.md "≤ 20 s"). */
export const LOW_TIME_MS = 20_000;
/** Warning haptic once below this, then a tick per second in the last 5 s. */
export const WARN_TIME_MS = 10_000;
export const TICK_LAST_S = 5;

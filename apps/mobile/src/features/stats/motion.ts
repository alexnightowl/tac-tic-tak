import { countTo, easing, keyframes, transitions } from '@tac/core/tokens';
import { Easing, type WithTimingConfig } from 'react-native-reanimated';

import { bezier } from '@/ui/motion';

// Chart motion (Phase 7). The web charts are static; these are the native
// additions the inventory proposes, timed from existing tokens so the
// catalogue stays the single source. Fold into src/feel/motion.ts once it
// exists. Reduced motion: callers jump to the end state.

/** Rating line draw-in: the catalogue's stroke-grow (900 ms). */
export const drawIn: WithTimingConfig = {
  duration: keyframes.strokeGrow.duration,
  easing: bezier(keyframes.strokeGrow.easing),
};

/** Radar polygon morph between style filters, and dim/undim of series. */
export const morph: WithTimingConfig = {
  duration: transitions.turnCardStreak.duration,
  easing: bezier(transitions.turnCardStreak.easing),
};

/** Series dim on filter change: Tailwind transition-opacity 150 ms (web legend). */
export const fade: WithTimingConfig = {
  duration: transitions.colors.duration,
  easing: bezier(transitions.colors.easing),
};

/** Lifetime count-up: CountTo's 900 ms ease-out cubic, without its summary delay. */
export const countUp: WithTimingConfig = {
  duration: countTo.duration,
  easing: Easing.out(Easing.cubic),
};

/** Weakness bars grow in (inventory: ~400 ms; the reveal curve). */
export const barGrow: WithTimingConfig = {
  duration: transitions.reveal.duration,
  easing: bezier(easing.reveal),
};

/** Scrub tooltip / crosshair appear. */
export const scrubIn: WithTimingConfig = {
  duration: transitions.colors.duration,
  easing: bezier(transitions.colors.easing),
};

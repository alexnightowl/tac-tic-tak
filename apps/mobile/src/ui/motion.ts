import { transitions, type Bezier } from '@tac/core/tokens';
import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

// UI-primitive motion. Durations/easings come from @tac/core/tokens; this
// module is the src/ui slice of the policy CLAUDE.md assigns to
// src/feel/motion.ts (which does not exist yet) and should fold into it.

export function bezier(b: Bezier) {
  return Easing.bezier(b[0], b[1], b[2], b[3]);
}

/** Plate press: 100 ms ease, both directions (web transform .1s ease). */
export const platePressTiming: WithTimingConfig = {
  duration: transitions.platePress.duration,
  easing: bezier(transitions.platePress.easing),
};

/** Toggle thumb + track: 200 ms Tailwind ease-out. */
export const toggleTiming: WithTimingConfig = {
  duration: transitions.toggle.duration,
  easing: bezier(transitions.toggle.easing),
};

/** Focus ring colour: Tailwind transition-colors 150 ms. */
export const colorsTiming: WithTimingConfig = {
  duration: transitions.colors.duration,
  easing: bezier(transitions.colors.easing),
};

/**
 * Segmented indicator. The web swaps instantly; native slides (inventory:
 * withSpring, damping ~20). Critically-damped enough to never overshoot
 * past a neighbour, so two tabs never look half-lit.
 */
export const segmentedSpring: WithSpringConfig = { damping: 22, stiffness: 320, mass: 1 };

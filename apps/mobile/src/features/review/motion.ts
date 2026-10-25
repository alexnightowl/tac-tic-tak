import { keyframes, transitions } from '@tac/core/tokens';
import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

import { bezier } from '@/ui/motion';

// Review / history motion, from @tac/core/tokens (the src/ui slice of the
// motion policy; folds into src/feel/motion.ts once it exists).

/** Next puzzle cross-fade, each way. No web counterpart (it pushed a route): the colours fade. */
export const crossfadeTiming: WithTimingConfig = {
  duration: transitions.colors.duration,
  easing: bezier(transitions.colors.easing),
};

/** .review-solved-pop: 320 ms, scale .9 → 1 with the pop overshoot; off under reduced motion. */
export const solvedPopTiming: WithTimingConfig = {
  duration: keyframes.reviewSolvedPop.duration,
  easing: bezier(keyframes.reviewSolvedPop.easing),
};

/** Skeleton breathing: the streak-badge breath cycle (1.6 s ease-in-out); static under reduced motion. */
export const skeletonTiming: WithTimingConfig = {
  duration: keyframes.streakBreath.duration / 2,
  easing: bezier(keyframes.streakBreath.easing),
};

/** Swipe-row snap. Web: 200 ms ease; native settles on a critically damped spring. */
export const swipeSpring: WithSpringConfig = { damping: 26, stiffness: 320, mass: 1 };

/** Progress bar width (web had a text pill): the colours transition. */
export const progressTiming: WithTimingConfig = {
  duration: transitions.turnCardStreak.duration,
  easing: bezier(transitions.turnCardStreak.easing),
};

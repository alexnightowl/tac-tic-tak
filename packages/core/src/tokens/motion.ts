// Motion constants. Durations in ms; easings as cubic-bezier tuples for
// Reanimated's Easing.bezier(...tuple). Sources: lib/store.ts, lib/puzzle.ts,
// play/[id], review pages, RankCeremony, Toast, Chessboard and the
// keyframes in globals.css.

export type Bezier = readonly [number, number, number, number];

export type AnimationSpeed = 'instant' | 'fast' | 'normal' | 'slow';

/** Piece slide duration per settings.animationSpeed (lib/store.ts). */
export const ANIMATION_MS: Record<AnimationSpeed, number> = {
  instant: 0,
  fast: 160,
  normal: 280,
  slow: 460,
};

/** CSS keyword easings, plus Tailwind's class variants (which differ). */
export const easing = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  /** Tailwind `ease-out` class (Toggle) and default transition curve. */
  twEaseOut: [0, 0, 0.2, 1],
  twDefault: [0.4, 0, 0.2, 1],
  /** Piece slide (Chessboard slide-piece; PLAN §2.6 animateMove). */
  slide: [0.4, 0, 0.2, 1],
  /** Landing .reveal. */
  reveal: [0.22, 1, 0.36, 1],
  /** Overshoot used by rank-pop and review-solved-pop. */
  pop: [0.2, 1.3, 0.4, 1],
  spark: [0.15, 0.7, 0.3, 1],
} as const satisfies Record<string, Bezier>;

/** Runner / board timings. */
export const timing = {
  /** Square flash on attempt (and when the parent clears feedbackSquare). */
  feedback: 500,
  /** Next puzzle after an attempt in the play runner. */
  nextAfterCorrect: 220,
  nextAfterWrong: 360,
  /** Review drill: wrong move → reset to the puzzle start. */
  reset: 520,
  /** Review drill: solved → advance (lib/puzzle.ts SOLVED_PAUSE_MS). */
  solvedPause: 1000,
  /** Web swapped the post-move FEN at animMs + 20 (removed by promise API). */
  slideSwapSlack: 20,
  /** Opponent reply: setTimeout(max(animMs, 80)). */
  opponentReplyMin: 80,
  /** Broken-streak chip shown for 700ms. */
  streakBroken: 700,
  /** /next retry backoff before the session gives up. */
  nextRetryBackoff: 1500,
  /** PromotionPicker ignores backdrop taps for 250ms after mount. */
  promotionGuard: 250,
  /** Toast auto-dismiss. */
  toastDismiss: 4500,
  /** Reduced-motion slide floor (PLAN §2.6: slides kept at 120ms). */
  reducedMotionSlide: 120,
} as const;

/** CountTo on the session summary: ease-out cubic e = 1 - (1 - k)^3. */
export const countTo = {
  delay: 350,
  duration: 900,
} as const;

/** RankCeremony timeline. */
export const rankCeremony = {
  stage1At: 40,
  stage2AtUp: 950,
  stage2AtDown: 750,
  stage2AtReduced: 200,
  /** Norm counter ticks normFrom → normTo in 14 steps over 600ms after stage 2. */
  counterSteps: 14,
  counterMs: 600,
  glowTransition: 500,
  oldEyeFade: 200,
  /** Text block: 500ms, delay 150 (translateY 14 → 0). */
  textIn: { duration: 500, delay: 150, fromY: 14 },
  /** Continue button: 500ms, delay 500. */
  continueIn: { duration: 500, delay: 500 },
  /** stopLongClip fade on Continue. */
  closeFade: 500,
} as const;

export type Keyframe = {
  duration: number;
  delay?: number;
  /**
   * CSS applies this per keyframe segment, not across the whole timeline:
   * with stops (keyframeStops) ease each segment separately, e.g.
   * withSequence of withTiming(stop, {duration: Δoffset * duration, easing}).
   */
  easing: Bezier;
  iterations?: 'infinite';
  /** True when the web disabled it under prefers-reduced-motion. */
  reducedMotionOff?: boolean;
};

/**
 * The motion catalogue (design-system inventory). Keyframe values that
 * matter for a port are spelled out alongside; % offsets are fractions.
 */
export const keyframes = {
  /** Opacity 0 → 1 @15% → hold @70% → 0. */
  squareFeedback: { duration: 500, easing: easing.easeOut },
  /** Per-spark durations override this default (see board sparks). */
  emberSpark: { duration: 560, easing: easing.spark, reducedMotionOff: true },
  /** translateX in fractions of the square. */
  pieceShake: { duration: 340, easing: easing.ease, reducedMotionOff: true },
  /** rotate 0 → 900° scale 1.08 @80% → 1080° scale 1.15 opacity 0. */
  rankSpin: { duration: 1000, easing: [0.5, 0, 0.2, 1], reducedMotionOff: true },
  /** scale 0.6 → 1, rotate -120° → 0, opacity 0 → 1. */
  rankPop: { duration: 900, easing: easing.pop, reducedMotionOff: true },
  /** opacity 0 → 0.55 @15% → 0. */
  rankFlash: { duration: 700, easing: easing.easeOut, reducedMotionOff: true },
  /** scale 0.9 → 1 with fade. */
  reviewSolvedPop: { duration: 320, easing: easing.pop, reducedMotionOff: true },
  /** y -14 → 3 @30%, shake x -7/6/-4/2/0 @42/54/66/78/100%, ember ring 0 → 14px. */
  normDrop: { duration: 900, easing: [0.2, 0.8, 0.3, 1], reducedMotionOff: true },
  /** y -10 → 0 with fade. */
  normIconDrop: { duration: 900, delay: 250, easing: [0.3, 1.4, 0.5, 1], reducedMotionOff: true },
  /** scale 0.92 → 1, y 10 → 0, gold glow peaks @40%. */
  normRise: { duration: 900, easing: [0.2, 1.25, 0.4, 1], reducedMotionOff: true },
  /** scale 0.3 → 1, rotate -90° → 0. */
  normIconRise: { duration: 1100, delay: 200, easing: [0.2, 1.4, 0.4, 1], reducedMotionOff: true },
  /** opacity 1 → 0.55 → 1. */
  streakBreath: { duration: 1600, easing: easing.easeInOut, iterations: 'infinite' },
  /** red ring 0 → 10px fading. */
  pulseRed: { duration: 1200, easing: easing.easeInOut, iterations: 'infinite' },
  /** inset 4px amber ring + glow 0 → 14px @60% fading. */
  hintPulse: { duration: 1200, easing: easing.easeOut, iterations: 'infinite' },
  /** Duration comes from ANIMATION_MS. */
  slidePiece: { duration: ANIMATION_MS.normal, easing: easing.slide },
  /** Toast: translateX 110% → 0 with fade. */
  slideInRight: { duration: 220, easing: easing.easeOut },
  // Landing-only (unused on web).
  heroPan: { duration: 18000, easing: easing.easeInOut, iterations: 'infinite' },
  floatY: { duration: 6000, easing: easing.easeInOut, iterations: 'infinite' },
  strokeGrow: { duration: 900, easing: [0.2, 0.8, 0.2, 1] },
  ringPulse: { duration: 2400, easing: easing.easeOut, iterations: 'infinite' },
} as const satisfies Record<string, Keyframe>;

/** Keyframe stops, as [offset, value] pairs. */
export const keyframeStops = {
  squareFeedbackOpacity: [[0, 0], [0.15, 1], [0.7, 1], [1, 0]],
  pieceShakeX: [[0, 0], [0.2, -0.06], [0.4, 0.06], [0.6, -0.04], [0.8, 0.03], [1, 0]],
  rankFlashOpacity: [[0, 0], [0.15, 0.55], [1, 0]],
  rankSpinRotate: [[0, 0], [0.8, 900], [1, 1080]],
  rankSpinScale: [[0, 1], [0.8, 1.08], [1, 1.15]],
  rankSpinOpacity: [[0, 1], [0.8, 1], [1, 0]],
  normDropY: [[0, -14], [0.3, 3], [0.42, 3], [0.54, 2], [0.66, 1], [0.78, 0], [1, 0]],
  normDropX: [[0, 0], [0.3, 0], [0.42, -7], [0.54, 6], [0.66, -4], [0.78, 2], [1, 0]],
  streakBreathOpacity: [[0, 1], [0.5, 0.55], [1, 1]],
  hintPulseGlow: [[0, 0], [0.6, 14], [1, 0]],
} as const;

/** UI transitions. */
export const transitions = {
  plateFilter: { duration: 150, easing: easing.ease },
  platePress: { duration: 100, easing: easing.ease },
  toggle: { duration: 200, easing: easing.twEaseOut },
  /** Tailwind transition-colors default. */
  colors: { duration: 150, easing: easing.twDefault },
  chevron: { duration: 150, easing: easing.twDefault },
  turnCardStreak: { duration: 500, easing: easing.twDefault },
  reveal: { duration: 700, easing: easing.reveal, stagger: 80, fromY: 24 },
} as const;

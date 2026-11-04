// Board feel knobs (apps/mobile/src/board/constants.ts). Durations and
// easings that exist as tokens come from @tac/core/tokens; the rest are the
// app's tunables, with its springs rewritten as timed curves for the web
// Animations API.
import { ANIMATION_MS, easing, type Bezier } from '@tac/core/tokens';

/** Pointer travel that turns a press into a drag (CSS px). The app's tap maxDistance. */
export const DRAG_THRESHOLD = 4;
/** Dragged piece sits this many squares above the pointer. */
export const DRAG_LIFT_SQ = 0.6;
/** Scale of the lifted piece. */
export const DRAG_SCALE = 1.1;
/**
 * Lift: the app's spring { duration: 110, dampingRatio: 0.7 } settles in
 * ~1.5× its perceptual duration and overshoots a little: the pop curve.
 */
export const LIFT_MS = 165;
export const LIFT_EASING: Bezier = easing.pop;
/** Snap-back: the app's { duration: 120, dampingRatio: 0.85 } spring, ~180 ms, no visible overshoot. */
export const SNAP_BACK_MS = 180;
export const SNAP_BACK_EASING: Bezier = easing.slide;
/** Legal drop: the overlay settles onto the target while the move commits. */
export const DROP_SETTLE_MS = 70;
/** Tap-to-move slide (the app's TAP_MOVE_MS): the 'fast' speed. */
export const TAP_MOVE_MS = ANIMATION_MS.fast;
/** Other pieces that move on a drop (castling rook) slide this long. */
export const SECONDARY_MOVE_MS = ANIMATION_MS.fast;
/** Minimum gap between hoverLegal feel events (ms). */
export const HOVER_THROTTLE_MS = 45;
/** Captured piece: fade/scale out after the capturer has mostly arrived. */
export const CAPTURE_FADE_MS = 140;
export const CAPTURE_END_SCALE = 0.6;
/** Share of the slide after which the victim starts to fade. */
export const CAPTURE_FADE_AT = 0.55;
/**
 * Quiet time after the last slide before React catches up with the board
 * (test ids, labels, unmounting captured pieces). Back-to-back moves start
 * inside it and skip the reconcile.
 */
export const RECONCILE_IDLE_MS = 50;
/** Promotion picker fade-in (the app's FadeIn.duration(120)). */
export const PROMOTION_FADE_MS = 120;

export const bezier = (b: Bezier) => `cubic-bezier(${b.join(',')})`;

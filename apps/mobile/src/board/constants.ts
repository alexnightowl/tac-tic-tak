// Board feel knobs that have no token yet (PLAN §2.6 "tunable"). Durations
// and easings that exist on the web come from @tac/core/tokens instead.
// TODO(feel): move into src/feel/motion.ts once it exists.

/** Finger travel that turns a press into a drag (pt). Tap maxDistance. */
export const DRAG_THRESHOLD = 4;
/** Dragged piece sits this many squares above the finger. */
export const DRAG_LIFT_SQ = 0.6;
/** Spring scale of the lifted piece. */
export const DRAG_SCALE = 1.1;
/**
 * Snap-back spring. Reanimated's duration-based spring settles in 1.5×
 * the perceptual duration, so 120 here gives the planned ~180 ms.
 */
export const SNAP_BACK_SPRING = { duration: 120, dampingRatio: 0.85 } as const;
/** Lift (offset + scale) spring. */
export const LIFT_SPRING = { duration: 110, dampingRatio: 0.7 } as const;
/** Legal drop: the overlay settles onto the target while JS commits. */
export const DROP_SETTLE_MS = 70;
/** Tap-to-move slide (PLAN: "tap-move settle"); web 'fast' speed. */
export const TAP_MOVE_MS = 160;
/** Other pieces that move on a drop (castling rook, promotion) slide this long. */
export const SECONDARY_MOVE_MS = 160;
/** Minimum gap between hoverLegal ticks (ms). */
export const HOVER_THROTTLE_MS = 45;
/** Captured piece: fade/scale out after the capturer has mostly arrived. */
export const CAPTURE_FADE_MS = 140;
export const CAPTURE_END_SCALE = 0.6;

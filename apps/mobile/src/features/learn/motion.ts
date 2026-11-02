import { Easing } from 'react-native-reanimated';

// Learn tab motion (canvas LearnOpenBook; its 4 s CSS loop re-timed from
// the tap: 1 % of the loop = 40 ms). One clock `t` (ms since the tap)
// drives every layer; each segment eases on its own curve. Reduced
// motion: no overlay, the book page fades in (BookScreen's push).

export const OPEN_BOOK = {
  /** The whole overlay, tap → unmount. */
  total: 1260,
  /** Cover pressed (scale 0.95) and released. */
  press: [0, 80, 160] as const,
  pressScale: 0.95,
  /** The book rises: spine to the screen's centre line, 35.5 % down, 47 % of the width wide. */
  rise: [160, 560] as const,
  riseTop: 0.355,
  riseWidth: 0.473,
  /** The background darkens (to 68 % black) and blurs. */
  dim: [120, 480] as const,
  dimTo: 0.68,
  /** Gold glow behind the book. */
  glowIn: [320, 720] as const,
  glowOut: [920, 1200] as const,
  /** The cover swings open around the spine. */
  open: [360, 840] as const,
  openDeg: -172,
  perspective: 1100,
  /** The page zooms (×2 of the closed book: 86 % of the width) and fades into the book screen. */
  zoom: [840, 1200] as const,
  zoomTop: 0.235,
  zoomWidth: 0.86,
  /** The book page is pushed (fade) under the overlay; the dim lifts over it. */
  push: 880,
  reveal: [900, 1240] as const,
  /** Curves (canvas: moveBook, openCover, the stage dim). */
  moveEase: Easing.bezierFn(0.3, 0, 0.2, 1),
  coverEase: Easing.bezierFn(0.5, 0, 0.25, 1),
  stageEase: Easing.bezierFn(0.4, 0, 0.2, 1),
} as const;

// Radii, spacing and fixed layout sizes (tailwind.config.ts + recurring
// arbitrary values in the web components), in dp.

export const radii = {
  /** tailwind borderRadius.control: buttons, inputs, segmented tabs. */
  control: 6,
  /** tailwind borderRadius.card (theme token). */
  card: 10,
  /** tailwind borderRadius.sheet. */
  sheet: 16,
  /** <Card> renders rounded-[12px], not rounded-card. */
  cardComponent: 12,
  board: 6,
  /** Drop / hint rings inside a square. */
  squareRing: 2,
  sm: 2,
  md: 6,
  lg: 8, // segmented track
  xl: 12, // theme tiles
  '2xl': 16, // glass panels, toasts, sheets
  featureTile: 14,
  full: 9999,
} as const;

/** Tailwind spacing scale (1 unit = 4px). */
export const space = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
} as const;

export const layout = {
  /** Side gutter on phone screens. */
  gutter: 16,
  /** Runner page padding: max(12, safe-area). */
  runnerPadding: 12,
  cardPadding: 16,
  heroCardPadding: 20,
  /** Fixed slot above the board so it lands at the same y on every board screen. */
  boardTopSlot: 218,
  /** lg+ runner side panel (tablet). */
  sidePanel: 320,
  /** Phone landscape lock threshold (short side). */
  phoneMaxShortSide: 500,
  inputHeight: 48,
  inputPaddingX: 14,
  plateHeight: { sm: 36, md: 44, lg: 52 },
  /** Plate 9-slice border widths [vertical, horizontal] per size. */
  plateBorder: { sm: [10, 11], md: [12, 13], lg: [14, 15] },
  plateSlice: [55, 60, 55, 60],
  segmentedHeight: { sm: 32, md: 38 },
  segmentedTrackPadding: 4,
  toggle: { width: 48, height: 28, thumb: 24, inset: 2, travel: 20 },
  turnCardDisc: 44,
  turnCardKing: 36,
  toastIcon: 40,
  themeTile: 40,
  /** Theme glyphs render at round(size * 1.2) (Lichess glyphs carry less padding). */
  themeIconScale: 1.2,
} as const;

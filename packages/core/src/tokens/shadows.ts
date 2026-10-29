// Shadows as plain objects shaped like RN's New-Architecture BoxShadowValue
// ({offsetX, offsetY, blurRadius, spreadDistance, color, inset}), so a list
// can be passed straight to `boxShadow`. Values are the web box-shadows.

export type Shadow = {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadDistance: number;
  color: string;
  inset?: boolean;
};

function s(
  offsetX: number, offsetY: number, blurRadius: number, spreadDistance: number,
  color: string, inset = false,
): Shadow {
  return inset
    ? { offsetX, offsetY, blurRadius, spreadDistance, color, inset }
    : { offsetX, offsetY, blurRadius, spreadDistance, color };
}

export const shadows = {
  /** .glass card. */
  card: [
    s(0, 1, 0, 0, 'rgba(255,255,254,0.04)', true),
    s(0, 12, 28, -14, 'rgba(17,15,17,0.6)'),
  ],
  /** <Card hero>. */
  heroCard: [
    s(0, 0, 0, 1, 'rgba(255,255,254,0.06)', true),
    s(0, 14, 30, 0, 'rgba(17,15,17,0.5)'),
  ],
  /** .eos-well carved inputs / tracks. */
  well: [s(0, 2, 4, 0, 'rgba(17,15,17,0.55)', true)],
  /** Segmented active tab. */
  segmentedActive: [
    s(0, 1, 0, 0, 'rgba(255,255,254,0.18)', true),
    s(0, -2, 0, 0, 'rgba(17,15,17,0.25)', true),
  ],
  /** Toggle track when on. */
  toggleOn: [s(0, 1, 0, 0, 'rgba(255,255,254,0.18)', true)],
  toggleThumb: [s(0, 1, 2, 0, 'rgba(17,15,17,0.6)')],
  /** `.av` avatar disc (design v2: 4 layers; the web's 2 px bone ring is gone). */
  avatar: [
    s(0, 1, 0, 0, 'rgba(255,255,254,0.16)', true),
    s(0, -2, 4, 0, 'rgba(17,15,17,0.55)', true),
    s(0, 0, 0, 1, 'rgba(17,15,17,0.65)'),
    s(0, 3, 8, 0, 'rgba(17,15,17,0.45)'),
  ],
  /** Chessboard frame. */
  board: [
    s(0, 0, 0, 1, 'rgba(255,255,254,0.08)'),
    s(0, 24, 60, 0, 'rgba(17,15,17,0.5)'),
  ],
  /** Dragged piece: drop-shadow(0 10px 18px …). */
  dragPiece: [s(0, 10, 18, 0, 'rgba(17,15,17,0.35)')],
  /** Section divider rule. */
  sectionRule: [s(0, 1, 0, 0, '#2c2a31', true)],
  /** Logo at size ≥ 64: drop-shadow(0 8px 14px …). */
  logo: [s(0, 8, 14, 0, 'rgba(17,15,17,0.55)')],
  /** Landing FloatCard / .hero-chip. */
  floatCard: [
    s(0, 1, 0, 0, 'rgba(255,255,254,0.06)', true),
    s(0, 14, 40, -14, 'rgba(17,15,17,0.85)'),
    s(0, 4, 12, -6, 'rgba(17,15,17,0.6)'),
  ],
  // --- Design v2 ("Mobile app" page) ---------------------------------
  /** `.well` inside a grouped list (settings language / board segments). */
  wellSoft: [
    s(0, 2, 3, 0, 'rgba(17,15,17,0.6)', true),
    s(0, 0, 0, 1, 'rgba(255,255,254,0.03)', true),
  ],
  /** Active segment inside a `wellSoft` track: top highlight + small drop. */
  segmentedActiveSoft: [
    s(0, 1, 0, 0, 'rgba(255,255,254,0.18)', true),
    s(0, 1, 2, 0, 'rgba(17,15,17,0.5)'),
  ],
  /** `.tg` switch: off track, on track, thumb. */
  toggleTrackOff: [s(0, 2, 3, 0, 'rgba(17,15,17,0.6)', true)],
  toggleTrackOn: [s(0, 1, 2, 0, 'rgba(17,15,17,0.35)', true)],
  toggleKnob: [s(0, 1, 3, 0, 'rgba(17,15,17,0.5)')],
  /** `.glass` round button. */
  glass: [s(0, 4, 12, 0, 'rgba(17,15,17,0.35)')],
  /** `.back` button ring (inset 1 px). */
  backRing: [s(0, 0, 0, 1, 'rgba(255,255,254,0.08)', true)],
  /** Bottom sheet lifted off the page (theme picker). */
  sheet: [s(0, -12, 30, 0, 'rgba(10,8,12,0.45)')],
  /** Top rule of a sheet without a border (achievement sheet). */
  sheetRule: [s(0, -1, 0, 0, 'rgba(255,255,254,0.06)')],
  /** `.note` unlock callout: gold halo. */
  noteGlow: [s(0, 0, 22, 2, 'rgba(215,183,119,0.25)')],
  /** Preview boards in settings: hairline + drop. */
  boardPreview: [
    s(0, 0, 0, 1, 'rgba(255,255,254,0.08)'),
    s(0, 10, 24, 0, 'rgba(17,15,17,0.5)'),
  ],
  /** input[type=range].ticks thumb (ui/slider, unused on web). */
  sliderThumb: [s(0, 4, 10, -2, 'rgba(17,15,17,0.5)'), s(0, 0, 0, 6, 'rgba(142,69,66,0.08)')],
} as const satisfies Record<string, readonly Shadow[]>;

/** RN supports a single text shadow; the first listed is the one to keep. */
export type TextShadow = { offsetX: number; offsetY: number; radius: number; color: string };

export const textShadows = {
  /** .btn-ember: 0 1px 1px is the main layer (PLAN keeps it). */
  plateEmber: [
    { offsetX: 0, offsetY: 1, radius: 1, color: 'rgba(17,15,17,0.75)' },
    { offsetX: 0, offsetY: -1, radius: 0, color: 'rgba(255,255,254,0.22)' },
    { offsetX: 0, offsetY: 2, radius: 4, color: 'rgba(40,16,18,0.6)' },
  ],
  plateSlate: [
    { offsetX: 0, offsetY: 1, radius: 1, color: 'rgba(17,15,17,0.8)' },
    { offsetX: 0, offsetY: -1, radius: 0, color: 'rgba(255,255,254,0.18)' },
    { offsetX: 0, offsetY: 2, radius: 4, color: 'rgba(17,15,17,0.5)' },
  ],
  avatar: [
    { offsetX: 0, offsetY: 1, radius: 1, color: 'rgba(17,15,17,0.8)' },
    { offsetX: 0, offsetY: -1, radius: 0, color: 'rgba(255,255,254,0.18)' },
  ],
} as const satisfies Record<string, readonly TextShadow[]>;

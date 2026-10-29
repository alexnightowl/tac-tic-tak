// "Ember on stone" palette. Sources: apps/frontend/src/app/globals.css :root,
// tailwind.config.ts, lib/levels.ts, components/board/*. Every value is
// already fade-baked (scripts/bake-fade.py): never apply a fade on top, and
// run any new colour through the bake script first.

/** --eos-* core tokens. */
export const eos = {
  ink: '#1d1b20', // app ground
  shade: '#222025', // bars, sheets
  slate: '#29282d', // cards
  rise: '#353339', // pressed, chips
  seam: '#413f46', // borders
  well: '#1a181c', // carved inputs, segmented track
  bone: '#e7e0d7', // text
  ash: '#a5a0a4', // secondary text
  dust: '#736f74', // disabled / faint
  ember: '#8e4542', // the one accent (design v2 "Mobile app" page; web #a64241)
  embers: '#592628', // pressed / tint
  rose: '#d8847c', // negative numbers
  sage: '#afc0a9', // positive numbers
  // The CSS var; the board actually paints rgb(47,95,158) (Chessboard HL),
  // which PLAN §2.5 makes authoritative — see board.highlight below.
  hl: '#3a6296',
} as const;

/** Tailwind black/white remap (fade baked into pure black/white). */
export const black = '#110f11';
export const white = '#fffffe';

/** Warm graphite ramp (tailwind zinc-* remap). */
export const graphite = {
  50: '#f9f4ed',
  100: '#f2ebe2',
  200: '#e7e0d7',
  300: '#cbc5bf',
  400: '#a5a0a4',
  500: '#807c81',
  600: '#615e64',
  700: '#413f46',
  800: '#2f2d32',
  900: '#222025',
  950: '#1d1b20',
} as const;

/** Legacy app aliases from :root, with every color-mix() pre-baked. */
export const semantic = {
  accent: eos.ember,
  accentSoft: 'rgba(142,69,66,0.18)', // color-mix(ember 18%, transparent)
  accentWeak: 'rgba(142,69,66,0.08)', // color-mix(ember 8%, transparent)
  accentContrast: '#f5eee5',
  bgBase: eos.ink,
  bgCard: 'rgba(41,40,45,0.86)',
  bgCardSolid: eos.slate,
  bgSoft: eos.shade,
  bgSofter: eos.rise,
  borderSoft: 'rgba(255,255,254,0.05)',
  border: eos.seam,
  borderStrong: 'rgba(255,255,254,0.16)',
  text: eos.bone,
  textDim: eos.ash,
  textFaint: eos.dust,
  danger: '#d07771',
} as const;

/** Every other color-mix() in the web app, pre-baked. */
export const mixed = {
  /** .app-shell top glow: color-mix(ember 7%, transparent), fades out at 62%. */
  shellGlow: 'rgba(142,69,66,0.07)',
  /** .app-glow (unused on web): color-mix(accent 8%, transparent). */
  pointerGlow: 'rgba(142,69,66,0.08)',
  /** play setup sticky CTA gradient (bottom → top). */
  ctaDockBottom: '#2b1f23', // color-mix(accent 10%, bg-base)
  ctaDockMid: '#251d22', // color-mix(accent 6%, bg-base) @55%
  ctaDockFade: 'rgba(29,27,32,0.75)', // color-mix(bg-base 75%, transparent) @80%
  /** ActivityHeatmap levels 0..4. */
  heat0: 'rgba(255,255,254,0.04)', // bg-white/[0.04] (+ same-colour border)
  heat1: 'rgba(142,69,66,0.22)',
  heat2: 'rgba(142,69,66,0.45)',
  heat3: 'rgba(142,69,66,0.7)',
  heat4: eos.ember,
  /** .ring-pulse (landing, unused) start/end. */
  ringPulseFrom: 'rgba(142,69,66,0.55)',
  ringPulseTo: 'rgba(142,69,66,0)',
  /** .hero-gradient (landing, unused) layers. */
  heroAccent18: 'rgba(142,69,66,0.18)',
  heroViolet22: 'rgba(106,107,224,0.22)',
  heroAccent14: 'rgba(142,69,66,0.14)',
} as const;

/** Surface fills that recur as literals. */
export const surface = {
  /** .glass card. */
  card: eos.slate,
  cardBorder: 'rgba(255,255,254,0.04)',
  /** .tx-slate veil over the slate texture (top → bottom). */
  heroVeilTop: 'rgba(32,30,35,0.74)',
  heroVeilBottom: 'rgba(32,30,35,0.86)',
  heroRing: 'rgba(255,255,254,0.06)',
  /** Opaque stand-in for backdrop-blur surfaces (PLAN §2.5: 92% fills). */
  floatCard: 'rgba(34,32,37,0.92)',
  /** Pause overlay on Android (92% ink instead of blur). */
  inkVeil92: 'rgba(29,27,32,0.92)',
  /** Modal backdrop (bg-black/70). */
  backdrop: 'rgba(17,15,17,0.7)',
  /** .app-shell vignette outer stop (transparent at 55%). */
  vignette: 'rgba(10,8,12,0.23)',
  /** Section dividers: inset 0 1px 0. */
  sectionRule: '#2c2a31',
  inputBorder: '#312f34',
  inputBorderFocus: 'rgba(142,69,66,0.7)', // ember/70
  /** Avatar disc layers. */
  avatarHighlight: 'rgba(255,255,254,0.12)',
  avatarVeilTop: 'rgba(74,72,80,0.35)',
  avatarVeilBottom: 'rgba(23,21,25,0.35)',
  /** .hero-chip (landing, unused) gradient. */
  heroChipTop: '#24272d',
  heroChipBottom: '#1e1f24',
  // --- Design v2 ("Mobile app" page) ---------------------------------
  /** `.float`: overlay chrome over boards (runner pills, viewer, drill). */
  float: 'rgba(34,32,37,0.92)',
  floatBorder: 'rgba(255,255,254,0.05)',
  floatBorderSubtle: 'rgba(255,255,254,0.04)',
  /** `.glass`: round header buttons over hero content (profile, friends). */
  glass: 'rgba(43,41,46,0.9)',
  glassBorder: 'rgba(255,255,254,0.08)',
  /** `.back`: nested-screen back button (faint bone fill + 1 px ring). */
  backFill: 'rgba(255,255,254,0.06)',
  backRing: 'rgba(255,255,254,0.08)',
  /** `.well` inside a grouped list: extra 1 px inner highlight. */
  wellRing: 'rgba(255,255,254,0.03)',
  /** Bottom sheets: shade ground, faint top rule. */
  sheet: '#222025',
  sheetBorder: 'rgba(255,255,254,0.04)',
  /** Sheet grabbers (36 × 5) per artboard. */
  grabber: '#413f46',
  grabberAsh: 'rgba(165,160,164,0.45)',
  grabberGlass: 'rgba(255,255,254,0.22)',
  grabberLight: 'rgba(255,255,254,0.28)',
  grabberIron: '#535058',
  /** Sheet shadow (theme picker): 0 -12px 30px. */
  sheetShadow: 'rgba(10,8,12,0.45)',
  /** `.note` neutral callout fill (Summary). */
  noteNeutral: 'rgba(17,15,17,0.2)',
  /** Multiline field border (profile bio). */
  textareaBorder: '#2f2d32',
} as const;

/** Controls. */
export const control = {
  plateTextEmber: '#eee5d8',
  plateTextSlate: eos.bone,
  /** Press overlays standing in for CSS brightness(0.8 / 0.86). */
  platePressEmber: 'rgba(17,15,17,0.2)',
  platePressSlate: 'rgba(17,15,17,0.14)',
  segmentedActiveBg: eos.ember,
  segmentedActiveText: '#f5eee5',
  segmentedInactiveText: eos.ash,
  toggleOn: eos.ember,
  toggleOff: eos.well,
  toggleThumb: eos.bone,
  dangerBorder: 'rgba(142,69,66,0.7)',
  dangerText: '#d07771',
  dangerPressBg: 'rgba(142,69,66,0.1)',
  ghostPressBg: 'rgba(255,255,254,0.05)',
  emberTint14: 'rgba(142,69,66,0.14)',
  emberTint16: 'rgba(142,69,66,0.16)',
  sageTint16: 'rgba(148,165,142,0.16)',
  /** Streak chip on TurnCard. */
  streakChipBg: 'rgba(142,69,66,0.16)',
  streakChipText: '#d8847c',
  /** Gradients (start → end). */
  rankProgress: ['#683231', '#8e4542'] as const,
  gateBar: ['#64765f', '#94a58e'] as const,
  // --- Design v2 ("Mobile app" page) ---------------------------------
  /** `.mini-ghost`: 1 px seam border on a faint bone fill. */
  miniGhostBg: 'rgba(255,255,254,0.05)',
  miniGhostBorder: '#413f46',
  /** `.chip` / `.chip-on` (achievement filters). */
  chipBg: eos.slate,
  chipText: eos.ash,
  chipRing: 'rgba(255,255,254,0.05)',
  chipOnBg: eos.bone,
  chipOnText: eos.ink,
  /** Danger outline buttons: ember/70 border, ember/10 fill when filled. */
  dangerFill: 'rgba(142,69,66,0.1)',
  dangerBorderSoft: 'rgba(142,69,66,0.55)',
  /** Segmented option badge (`?2/5` calibration pill). */
  badgeOnActiveBg: 'rgba(17,15,17,0.2)',
  badgeGoldBg: 'rgba(215,183,119,0.20)',
  /** Gold callouts / pills. */
  goldTint16: 'rgba(215,183,119,0.16)',
  goldTint20: 'rgba(215,183,119,0.20)',
  goldBorder: 'rgba(215,183,119,0.45)',
  /** Icon tiles and small square buttons (`#353339`). */
  tile: eos.rise,
  /** Thin progress bars: track and fill gradients. */
  progressTrack: eos.rise,
  progressCopper: ['#8a5a3a', '#c98c55'] as const,
  progressEmberCopper: ['#8e4542', '#c98c55'] as const,
  progressFlame: ['#7a3634', '#c64a44'] as const,
  progressIdle: ['#413f46', '#736f74'] as const,
} as const;

/**
 * Named solids from the design v2 artboards that the eos ramp lacks. Each
 * comes straight from the canvas (already fade-baked there); the comment
 * says where it is used.
 */
export const tone = {
  /** Text on ember fills (seg-on, mini-ember, count badges). */
  onEmber: '#f5eee5',
  /** Plate (btn-ember) label ink. */
  plateInk: '#eee5d8',
  /** Destructive text / icons, error copy. */
  danger: '#d07771',
  /** Negative deltas, kicker, log out. */
  rose: '#d8847c',
  roseSoft: '#e39b93', // ember chip text (onboarding)
  blush: '#f0c9bf', // glyph on an ember disc (onboarding)
  cream: '#f3e9df', // numerals on an ember disc
  /** Positive deltas, solved. */
  sage: '#afc0a9',
  sageDeep: '#94a58e', // dots, gate bar end
  moss: '#6d7a68', // offline "Mate patterns" pack swatch
  /** Streak flame, rank gold, calibration pills. */
  gold: '#d7b777',
  copper: '#c98c55', // achievement progress / XP
  copperDeep: '#8a5a3a',
  copperLight: '#d9ad84',
  amberLight: '#e1b48b', // XP amounts
  flame: '#c64a44', // streak disc
  spark: '#e1866f', // onboarding sparks
  emberDeep: '#683231', // ember progress start
  /** Neutral greys between ash and seam. */
  mist: '#8f8a8f', // achievement meta
  smoke: '#928e94', // bullet series
  stone: '#6b6870', // engraved medal numerals
  pewter: '#5a575e', // locked glyphs
  iron: '#535058',
  ringTrack: '#2c2a30', // progress ring track
  /** Blue accents (onboarding, achievements "new"). */
  sky: '#9cc0e6',
  skyDeep: '#2f3a4a',
  /** Achievement glyph light / sand ring. */
  parchment: '#f3e6d6',
  sand: '#cbbfae',
  /** Tinted sheet / card grounds (achievement sheet, onboarding cards). */
  warmTop: '#2b2326',
  warmBottom: '#242227',
  warmCardTop: '#2c2124',
  warmCardBottom: '#25222a',
  warmGlow: '#2a2023', // onboarding radial centre
  /** Medal discs: radial at 34% 28% (hi 0% → mid 48/55% → lo 100%). */
  medalEmber: ['#a5524b', '#7a3634', '#4d2426'] as const,
  medalStone: ['#36343a', '#262429', '#1b191d'] as const,
  medalStoneRing: '#3a383e',
  /** Hot core of the ember glows (onboarding hero glow, rank glow, mate square); the logo glow's first stop. */
  emberGlow: '#c95146',
  /** Onboarding demo board: the target-square ring (rgba(144,143,142,.42)). */
  legalGrey: '#908f8e',
} as const;

/**
 * `rgba()` of a `#rrggbb` token at an alpha, for the design's own tints of a
 * token (e.g. `alpha(tone.gold, 0.16)`). The canvas values are already
 * baked, so this is a spelling helper, not a fade.
 */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Board colours (Chessboard.tsx, Arrows.tsx, tailwind board.*). */
export const board = {
  /** Fallback fills under the baked marble / slate tiles. a1 is dark. */
  light: '#cdcfd5',
  dark: '#505059',
  /** Coordinates use the opposite square colour. */
  coordOnLight: '#505059',
  coordOnDark: '#cdcfd5',
  /** Highlight blue as rendered: rgb(47,95,158) (HL in Chessboard.tsx). */
  highlight: 'rgb(47,95,158)',
  selected: 'rgba(47,95,158,0.45)',
  selectedRing: 'rgb(47,95,158)', // inset 3px
  lastMove: 'rgba(47,95,158,0.35)',
  dropRing: 'rgba(47,95,158,0.85)', // inset 4px, radius 2
  legal: 'rgba(144,143,142,0.32)', // dot 26% / capture ring inset 4%, 6px
  userHighlight: 'rgba(142,69,66,0.6)',
  /** Check glow: radial-gradient(circle, c0 10%, c1 55%, transparent 80%). */
  check: ['rgba(223,78,77,0.85)', 'rgba(223,78,77,0.35)'] as const,
  checkStops: [0.1, 0.55, 0.8] as const,
  arrow: 'rgba(89,123,167,0.78)',
  frameRing: 'rgba(255,255,254,0.08)',
  promotionBackdrop: 'rgba(17,15,17,0.35)',
  promotionPicker: 'rgba(255,254,252,0.98)',
  promotionPress: 'rgba(17,15,17,0.2)', // active:bg-black/20
  /** Landing hero board tints (e5 / f7) and its arrow. */
  landingTintStrong: 'rgba(81,123,181,0.38)',
  landingTintSoft: 'rgba(81,123,181,0.22)',
  landingArrow: 'rgba(82,132,199,0.85)',
} as const;

/** Per-attempt and runner feedback. */
export const feedback = {
  correct: 'rgba(94,218,137,0.7)',
  fail: 'rgba(223,78,77,0.7)',
  hint: 'rgba(236,162,38,0.95)', // inset 4px ring
  hintGlow: 'rgba(236,162,38,0.55)', // outer glow 0 → 14px, fades to 0
  sparkGlow: 'rgba(242,127,75,0.9)',
  sparks: ['#f9b786', '#d35e4a', '#fddcb1'] as const,
  timerPulse: 'rgba(223,78,77,0.55)', // pulse-red ring 0 → 10px
  normGold: 'rgba(215,183,119,0.45)', // norm-rise glow
  normDropRing: 'rgba(142,69,66,0.55)', // norm-drop ring 0 → 14px
} as const;

export type RankBand = 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

/** Rank band colours (lib/levels.ts LEVEL_BANDS). */
export const rank: Record<RankBand, { color: string; glow: string }> = {
  novice: { color: '#a5a0a4', glow: 'rgba(165,160,164,0.18)' },
  beginner: { color: '#cbc5bf', glow: 'rgba(203,197,191,0.18)' },
  intermediate: { color: '#d7b777', glow: 'rgba(215,183,119,0.20)' },
  advanced: { color: '#ba7058', glow: 'rgba(186,112,88,0.22)' },
  expert: { color: '#a64241', glow: 'rgba(166,66,65,0.25)' },
};

/** RankCeremony.tsx. */
export const ceremony = {
  /** New eye drop-shadow(0 0 26px …) on rank up. */
  finalGlowExpert: 'rgba(149,98,206,0.6)',
  finalGlow: 'rgba(201,81,70,0.55)',
  /** Backdrop: radial-gradient(circle at 50% 38%, glowRgb@alpha 0%,
   *  glowMid 35%, glowEnd 65%); alpha per stage below, 500ms transition. */
  glowRgb: [176, 58, 58] as const,
  glowMid: 'rgba(114,38,41,0.12)',
  glowEnd: 'rgba(29,27,32,0)',
  glowCenter: [0.5, 0.38] as const,
  /** Down: new eye grayscale(0.85) brightness(0.75). */
  downFilter: { grayscale: 0.85, brightness: 0.75 },
  /** Glow alpha per stage 0/1/2. */
  upAlpha: [0.08, 0.22, 0.34] as const,
  /** Down: stages 0–1 vs stage 2. */
  downAlpha: [0.14, 0.14, 0.04] as const,
  flashPeak: 0.55,
} as const;

/** Logo glow radial stops (offset, colour) and blur = max(4, round(size*0.11)). */
export const logoGlow = [
  [0, 'rgba(201,81,70,0.42)'],
  [0.18, 'rgba(142,69,66,0.26)'],
  [0.36, 'rgba(133,48,49,0.14)'],
  [0.54, 'rgba(96,35,39,0.06)'],
  [0.72, 'rgba(96,35,39,0)'],
] as const;

/** System chrome: app.json / expo-system-ui / status bar. */
export const system = {
  background: eos.ink,
  statusBar: 'light',
} as const;

export const colors = {
  eos,
  black,
  white,
  graphite,
  semantic,
  mixed,
  surface,
  control,
  board,
  feedback,
  tone,
  rank,
  ceremony,
  logoGlow,
  system,
} as const;

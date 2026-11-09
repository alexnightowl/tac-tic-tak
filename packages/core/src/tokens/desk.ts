// Desktop web palette (apps/mobile src/desktop) and sizes (canvas page "Desktop — redesign", DX*
// artboards, 1440 × 900). The phone tokens stay the source for colour
// names; these are the few desktop-only surfaces the artboards add.
import { eos } from './colors';

export const desk = {
  /** Sidebar ground and its right border. */
  side: '#19171b',
  sideBorder: '#2a282d',
  /** Header bottom rule. */
  headerRule: '#26242a',
  /** .card: the main panel. */
  card: '#252328',
  cardEdge: '#333137',
  /** .card2 / tile row inside a card. */
  card2: '#2b292f',
  /** Sidebar streak + user cards. */
  sideCard: '#221f25',
  sideCardEdge: '#2f2c32',
  /** Selected nav row. */
  navOn: '#2b292f',
  navOnText: '#f1e7da',
  navIcon: '#8f8a8f',
  /** Ghost button (.btn-g) and icon squares. */
  ghost: '#2f2d33',
  /** Segmented / chip track (.seg). */
  track: '#1a181c',
  trackEdge: '#2e2c31',
  /** Inputs (.inp). */
  input: '#18161a',
  inputEdge: '#34323a',
  /** Row separators inside cards. */
  rowRule: '#2e2c31',
  /** Selected tile / option (ember outline + warm tint). */
  pickedBg: '#2a2326',
  /** Kbd cap. */
  kbdEdge: '#3a383e',
  /** Progress bar empty / streak segment off. */
  barOff: '#3a373d',
  barFrom: '#683231',
  barTo: '#a8524d',
  /** Accent text (.lbl in ember) and positive / negative numbers. */
  rose: eos.rose,
  sage: '#94a58e',
  gold: '#e1866f',
  scrim: 'rgba(12,10,14,0.62)',
  /** Text on the ember segment thumb. */
  segOnText: '#f6ece2',
  segOnLip: 'rgba(255,236,220,0.18)',
  ghostHover: '#36343a',
  chipHover: '#333139',
  kbdLip: 'rgba(255,255,255,0.08)',
  shadow: 'rgba(0,0,0,0.35)',
  sideCardHover: '#262329',
  /** Popover / dialog drop shadow. */
  popShadow: 'rgba(8,6,10,0.6)',
  // ── rivals: league, stats, achievements (DXLeague, DXStats, DXAchievements) ──
  /** Gold progress bar: deep end (the light end is tone.gold). */
  goldFrom: '#8a6e3a',
  /** Activity heatmap levels 0..4. */
  heat0: '#2a282d',
  heat1: '#4a2a2b',
  heat2: '#6d3434',
  heat3: '#8e4542',
  heat4: '#c26a5f',
  /** Theme accuracy bars: strong / middling / weak. */
  accHigh: '#5f7458',
  accMid: '#a8524d',
  accLow: '#c9514a',
  /** Modal card ground and edge (DXAchievementModal). */
  modal: '#232126',
  modalEdge: '#37343b',
  // ── end rivals ──
  // ── account (profile, experience, friends, settings) ──
  /** XP bar start (gold run to tone.gold): DXProfile, DXXP. */
  xpFrom: '#8a6e3a',
  /** The rank piece's ember tile (DXXP, DXProfile XP card). */
  rankTile: '#5a2c2a',
  /** Current rank card ground (DXXP). */
  rankOn: '#2d2427',
  // ── end account ──
  // ── board screens (runner, storm run, drills, chapter solve) ──
  /** Solved mark: session dots, summary marks, chapter dashes. */
  dotOk: '#5f7458',
  /** Pause veil over the board (DXSessionPaused). */
  pauseScrim: 'rgba(12,10,14,0.78)',
  /** Course theme glyph tile (DXChapterSolve). */
  themeTile: '#3a2628',
  /** Summary XP card: icon tile and the bar's deep end (DXSessionSummary). */
  xpTile: '#5a2c2a',
  xpBarFrom: '#8a6e3a',
  // ── end board ──
  /** Text tones. */
  bone: eos.bone,
  ash: eos.ash,
  dust: eos.dust,
  ember: eos.ember,
} as const;

export const deskSize = {
  sidebar: 248,
  /** Focus routes (board screens): the icon-only sidebar. */
  sidebarCompact: 64,
  header: 84,
  padX: 40,
  padTop: 28,
  /** Right column of two-column pages. */
  aside: 340,
  gap: 20,
  /** Content stops growing here on very wide windows. */
  maxContent: 1240,
} as const;

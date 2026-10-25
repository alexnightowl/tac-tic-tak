// FEEL_TABLE: PLAN.md §2.8 defaults, one row per feel event. `feel.emit`
// in apps/mobile is the only reader. Tunable; record changes in
// docs/mobile/FEEL.md.
import { moveSoundEvent, type SoundEvent } from './catalog';

export type HapticKind =
  | 'selection'
  | 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
  | 'success' | 'warning' | 'error';

export type HapticStep = {
  haptic: HapticKind;
  /** ms after the emit. */
  at: number;
  /** 0..1 for engines that support it (impact styles only); default 1. */
  intensity?: number;
};

/** One haptic now, or a timed pattern. */
export type HapticSpec = HapticKind | readonly HapticStep[];

/**
 * Sound for a feel event: a fixed catalogue event, or resolved at emit time:
 * `byMove` → moveSoundEvent(move), `byRank` → rankUpSound(band).
 */
export type FeelSound = SoundEvent | 'byMove' | 'byRank';

export type FeelEntry = {
  sound?: FeelSound;
  haptic: HapticSpec;
  notes: string;
};

export type FeelEvent =
  | 'pickup' | 'hoverLegal' | 'drop' | 'capture' | 'check' | 'castle' | 'promote'
  | 'illegal' | 'opponentLanding'
  | 'correct' | 'mistake'
  | 'streakUp' | 'streakBroken'
  | 'timerWarning' | 'timerTick'
  | 'pause' | 'resume' | 'exitSheet' | 'discard'
  | 'normGateUp' | 'normRise' | 'normDrop'
  | 'rankUp' | 'rankDown'
  | 'segmented' | 'tabChange' | 'toggle'
  | 'sliderTick' | 'sliderDetent' | 'sliderCap'
  | 'sheetDetent' | 'refresh' | 'achievementToast' | 'formError';

/** Castle: two Light taps 80ms apart. */
export const CASTLE_GAP_MS = 80;
/** Promote: Medium then Light; the plan gives no gap, so it reuses the castle gap. */
export const PROMOTE_GAP_MS = 80;
/** RankCeremony up: ticks run until the stage-2 flash (motion.rankCeremony.stage2AtUp). */
export const RANK_UP_FLASH_MS = 950;
export const RANK_DOWN_SOFT_MS = 750;
export const RANK_UP_TICKS = 6;
/** Slider: one tick per 25 rating points. */
export const SLIDER_TICK_POINTS = 25;
/** Timer: Rigid ticks in the last 5 s. */
export const TIMER_TICK_LAST_S = 5;

/** Soft at 0, Light ticks rising in intensity and density, Heavy + Success at the flash. */
export function rankUpPattern(flashAt = RANK_UP_FLASH_MS, ticks = RANK_UP_TICKS): HapticStep[] {
  const steps: HapticStep[] = [{ haptic: 'soft', at: 0 }];
  for (let i = 1; i <= ticks; i++) {
    // sqrt spacing packs the ticks towards the flash: an accelerating build
    const k = Math.sqrt(i / (ticks + 1));
    steps.push({ haptic: 'light', at: Math.round(flashAt * k), intensity: Math.round((0.3 + 0.6 * (i / ticks)) * 100) / 100 });
  }
  steps.push({ haptic: 'heavy', at: flashAt }, { haptic: 'success', at: flashAt });
  return steps;
}

export const FEEL_TABLE: Record<FeelEvent, FeelEntry> = {
  pickup: { haptic: 'selection', notes: 'Piece lifted (drag start or tap-select).' },
  hoverLegal: { haptic: 'light', notes: 'Light tick when the hovered square changes onto a legal target; throttled.' },
  drop: { sound: 'move', haptic: 'light', notes: 'Own quiet move lands.' },
  capture: { sound: 'capture', haptic: 'medium', notes: 'Own capture.' },
  check: { sound: 'check', haptic: 'rigid', notes: 'Own move gives check.' },
  castle: {
    sound: 'castle',
    haptic: [{ haptic: 'light', at: 0 }, { haptic: 'light', at: CASTLE_GAP_MS }],
    notes: 'Light ×2, 80 ms apart (king, then rook).',
  },
  promote: {
    sound: 'promote',
    haptic: [{ haptic: 'medium', at: 0 }, { haptic: 'light', at: PROMOTE_GAP_MS }],
    notes: 'Medium, then Light. Gap not specified by the plan (uses 80 ms).',
  },
  illegal: { haptic: [{ haptic: 'rigid', at: 0, intensity: 0.5 }], notes: 'Soft Rigid on an illegal drop / snap-back; silent.' },
  opponentLanding: {
    sound: 'byMove',
    haptic: [{ haptic: 'soft', at: 0, intensity: 0.6 }],
    notes: 'Fires when the reply LANDS (web fired at start). Sound via moveSoundEvent, so check/castle also play on review replies.',
  },
  correct: { sound: 'correct', haptic: 'success', notes: 'Correct sting; the winning move click is suppressed.' },
  mistake: { sound: 'mistake', haptic: 'error', notes: 'Thud only (no click+thud overlap as on the web).' },
  streakUp: { haptic: 'light', notes: 'Streak ≥ 2. Light; Medium at 5, Heavy at 10 (see streakUpHaptic).' },
  streakBroken: { haptic: 'warning', notes: 'Streak of ≥ 2 broken.' },
  timerWarning: { haptic: 'warning', notes: 'Once, when the timer crosses the warning threshold.' },
  timerTick: { haptic: 'rigid', notes: 'One Rigid tick per second for the last 5 s.' },
  pause: { haptic: 'light', notes: 'Pause.' },
  resume: { haptic: 'light', notes: 'Resume.' },
  exitSheet: { haptic: 'warning', notes: 'Exit sheet opens.' },
  discard: { haptic: 'heavy', notes: 'Session discarded.' },
  normGateUp: {
    sound: 'gate',
    haptic: [{ haptic: 'soft', at: 0 }, { haptic: 'medium', at: 550 }],
    notes: 'Gong swell: Soft at 0, Medium when the bell enters (550 ms).',
  },
  normRise: {
    haptic: [{ haptic: 'success', at: 360 }],
    notes: 'Outcome card norm-rise. Sound is the gate clip, emitted by normGateUp.',
  },
  normDrop: {
    sound: 'rankDown',
    haptic: [{ haptic: 'warning', at: 270 }],
    notes: 'Outcome card norm-drop; plays the rankDown pick, as on the web.',
  },
  rankUp: {
    sound: 'byRank',
    haptic: rankUpPattern(),
    notes: 'Soft, a light-tick crescendo over 950 ms, then Heavy + Success at the flash. Sound via rankUpSound(band).',
  },
  rankDown: {
    sound: 'rankDown',
    haptic: [{ haptic: 'warning', at: 0 }, { haptic: 'soft', at: RANK_DOWN_SOFT_MS }],
    notes: 'Warning at 0, Soft at 750 ms (stage 2).',
  },
  segmented: { haptic: 'selection', notes: 'Segmented control change.' },
  tabChange: { haptic: 'selection', notes: 'Tab bar change.' },
  toggle: { haptic: 'light', notes: 'Toggle switch.' },
  sliderTick: { haptic: 'selection', notes: 'One tick per 25 rating points.' },
  sliderDetent: { haptic: 'medium', notes: 'Slider snaps to a magnet detent.' },
  sliderCap: { haptic: 'warning', notes: 'Locked cap reached; the thumb rubber-bands.' },
  sheetDetent: { haptic: 'soft', notes: 'Sheet settles on a detent.' },
  refresh: { haptic: 'light', notes: 'Pull-to-refresh triggers.' },
  achievementToast: { haptic: 'success', notes: 'Achievement toast; throttled (interval tunable).' },
  formError: { haptic: 'error', notes: 'Form error; the field also shakes.' },
};

/** Streak-up haptic by the new streak length (only emitted for n ≥ 2). */
export function streakUpHaptic(n: number): HapticKind {
  if (n >= 10) return 'heavy';
  if (n >= 5) return 'medium';
  return 'light';
}

/** Normalises a HapticSpec to timed steps. */
export function hapticSteps(spec: HapticSpec): readonly HapticStep[] {
  return typeof spec === 'string' ? [{ haptic: spec, at: 0 }] : spec;
}

/**
 * The player's own move as a feel event (board click / capture / check /
 * castle / promote). Shared by the board and the runner, which decides
 * whether a move plays it at all (a winning move plays only `correct`, a
 * wrong one only `mistake`).
 */
export function moveFeelEvent(
  m: { san?: string; flags?: string; captured?: unknown; promotion?: unknown } | null | undefined,
): Extract<FeelEvent, 'drop' | 'capture' | 'check' | 'castle' | 'promote'> {
  const e = moveSoundEvent(m);
  return e === 'promote' || e === 'castle' || e === 'check' || e === 'capture' ? e : 'drop';
}

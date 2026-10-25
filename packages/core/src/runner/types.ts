// Runner types (PLAN §2.7). The reducer is pure: every timestamp arrives on
// the event (`at`, ms since epoch), and everything it wants done in the world
// leaves as an Effect for usePuzzleRunner to interpret.
import type { FeelEvent } from '../feel';
import type { Orientation, PromotionPiece, Square } from '../board';
import type { ServerPuzzle } from '../puzzle';
import type { CriterionId, TrainingStyle } from '../rules';

// ─── Server shapes (today's /api/*; apps/backend/src/sessions) ──────────

export type SessionMode = 'mixed' | 'theme';

/** POST /sessions/:id/next, and POST /sessions `firstPuzzle` (same shape). */
export type NextResponse = {
  puzzle: ServerPuzzle;
  currentRating: number;
  session: { id: string; startedAt: string; durationSec: number; style?: string; mode?: SessionMode };
};

/** POST /sessions/:id/attempt. */
export type AttemptResponse = { newRating: number; step?: number; streak?: number };

/** POST /sessions/:id/finish (the web FinishResponse, plus the discard reply). */
export type FinishResponse = {
  discarded?: boolean;
  sessionId: string;
  solved: number;
  failed: number;
  accuracy: number;
  avgResponseMs: number;
  peakRating: number;
  durationSec?: number;
  early?: boolean;
  unlocked?: boolean;
  unlockCheck?: {
    met: boolean;
    solvedTarget: number;
    criteria: Array<{ id: CriterionId; met: boolean; current: number; target: number }>;
  };
  demoted?: boolean;
  demoteCheck?: {
    atPeak: boolean;
    weak: boolean;
    criteriaMet: number;
    streakAfter: number;
    threshold: number;
    penalty: number;
    unlockedStartRating: number;
  } | null;
  calibration?: {
    active: boolean;
    sessionsLeftBefore: number;
    sessionsLeftAfter: number;
    ceilingBefore: number;
    ceilingAfter: number;
    delta: number;
  } | null;
  streak?: {
    days: number;
    freezes: number;
    lastDay: string | null;
    freezeRegenAt: string | null;
    outcome: 'same-day' | 'continued' | 'frozen' | 'reset' | 'started' | 'skipped';
  } | null;
  achievementsUnlocked?: string[];
};

/** GET /sessions/:id: only the aggregates the boot fallback summary needs. */
export type SessionAggregates = Pick<FinishResponse, 'solved' | 'failed' | 'accuracy' | 'avgResponseMs' | 'peakRating'>;

// ─── Config ─────────────────────────────────────────────────────────────

export type RunnerMode = 'session' | 'drill' | 'mistakes' | 'viewer';
export type FixedColor = 'auto' | 'white' | 'black';

type CommonConfig = {
  /** ANIMATION_MS[settings.animationSpeed]: setup / reply slide length. */
  animMs: number;
  /** settings.fixedColor: orientation override (never decides whose turn it is). */
  fixedColor: FixedColor;
};

export type RunnerConfig =
  | (CommonConfig & { mode: 'session'; sessionId: string })
  // TODO(phase 6): review drills (theme queue, hints, reset on wrong).
  | (CommonConfig & { mode: 'drill'; puzzles: ServerPuzzle[] })
  // TODO(phase 6): mistakes runner (review items, resolve on solve).
  | (CommonConfig & { mode: 'mistakes'; puzzles: ServerPuzzle[] })
  // TODO(phase 6): read-only viewer (step through the solution line).
  | (CommonConfig & { mode: 'viewer'; puzzle: ServerPuzzle });

// ─── State ──────────────────────────────────────────────────────────────

export type RunnerPhase =
  | 'booting'
  | 'setupAnimating'
  | 'playerTurn'
  | 'opponentReplying'
  | 'resolving'
  | 'loadingNext'
  | 'finishing'
  | 'summary';

export type TimerId = 'timeUp' | 'opponentReply' | 'next' | 'nextRetry' | 'streakBroken';

/** A scheduled timer. Running: dueAt set. Paused: dueAt null, `ms` is what is left. */
export type TimerSlot = { ms: number; dueAt: number | null };

export type LastMove = { from: Square; to: Square };

/** chess.js move fields the feel layer resolves sounds from (moveSoundEvent). */
export type MoveFeel = { san: string; flags: string; captured?: string; promotion?: string };

/** The slide the board is running; its done event is matched by id. */
export type PendingAnim = {
  id: number;
  kind: 'setup' | 'opponent';
  fenAfter: string;
  lastMove: LastMove;
  move: MoveFeel;
  /** Landed while paused: the turn starts on resume. */
  landed: boolean;
};

export type PendingAttempt = {
  puzzleId: string;
  correct: boolean;
  responseMs: number;
  square: Square;
  /** In-flight request id; null when restored from a snapshot and not yet re-sent. */
  reqId: number | null;
};

export type RunnerCounters = {
  solved: number;
  failed: number;
  totalResponseMs: number;
  peakRating: number;
};

export type RunnerResult =
  | { kind: 'summary'; source: 'server' | 'client' | 'detail'; summary: FinishResponse }
  | { kind: 'discarded' };

export type RunnerState = {
  mode: RunnerMode;
  sessionId: string;
  phase: RunnerPhase;
  /** Orthogonal to phase: timers are parked, results are held until resume. */
  paused: boolean;
  pausedAt: number | null;
  animMs: number;
  fixedColor: FixedColor;

  // Session (from the server response, never from earlier state).
  durationSec: number;
  style: TrainingStyle | null;
  sessionMode: SessionMode;
  sessionStartRating: number | null;
  /** Latest serving rating (next.currentRating, then attempt.newRating). */
  rating: number | null;
  /** Wall-clock end while running; null while paused or before boot. */
  endsAt: number | null;
  /** Frozen remaining time while paused. */
  pausedRemainingMs: number | null;

  // Puzzle. FEN strings only: a Chess instance is rebuilt per transition.
  puzzle: ServerPuzzle | null;
  fen: string | null;
  orientation: Orientation;
  playerColor: 'w' | 'b';
  lastMove: LastMove | null;
  /** Solution moves still to be played (player first, unless a reply is pending). */
  remaining: string[];
  /** When the player's turn on this puzzle started (thinking time anchor). */
  turnStartedAt: number | null;
  anim: PendingAnim | null;

  counters: RunnerCounters;
  streak: number;
  /** Length of a just-broken streak (≥ 2), shown ~700 ms. */
  streakBroken: number | null;

  // Flow.
  timers: Partial<Record<TimerId, TimerSlot>>;
  seq: number;
  pendingAttempt: PendingAttempt | null;
  /** True after an attempt resolved and the next-puzzle delay was queued. */
  attemptDone: boolean;
  nextReqId: number | null;
  nextRetried: boolean;
  /** /next arrived while paused: loaded on resume. */
  heldNext: NextResponse | null;
  /** Boot fell back to GET /sessions/:id. */
  detailReqId: number | null;
  /** Time ran out while an attempt was in flight: finish once it lands. */
  finishQueued: { save: boolean } | null;
  finishReq: { reqId: number; save: boolean } | null;
  result: RunnerResult | null;
};

// ─── Events ─────────────────────────────────────────────────────────────

type At = { at: number };

export type ApiCall = 'next' | 'attempt' | 'finish' | 'detail';

export type ApiOk =
  | { type: 'apiOk'; call: 'next'; reqId: number; data: NextResponse }
  | { type: 'apiOk'; call: 'attempt'; reqId: number; data: AttemptResponse }
  | { type: 'apiOk'; call: 'finish'; reqId: number; data: FinishResponse }
  | { type: 'apiOk'; call: 'detail'; reqId: number; data: SessionAggregates };

export type ApiError = { type: 'apiError'; call: ApiCall; reqId: number; status?: number };

export type TimerEvent = { type: 'timer'; id: TimerId };
export type AnimationDoneEvent = { type: 'animationDone'; id: number };

export type RunnerEventInput =
  /** Mount. `stash` is POST /sessions' firstPuzzle (null → POST /next). */
  | { type: 'boot'; stash?: NextResponse | null }
  /** The player's move, from Board onMove (or the e2e buttons). */
  | { type: 'move'; from: Square; to: Square; promotion?: PromotionPiece | string }
  | AnimationDoneEvent
  | TimerEvent
  | ApiOk
  | ApiError
  | { type: 'pause'; source: 'user' | 'background' }
  | { type: 'resume'; source: 'user' | 'foreground' }
  /** Safety net for late JS timers (e.g. after background): finishes when time is up. */
  | { type: 'tick' }
  /** Exit button / hardware back / edge swipe. */
  | { type: 'requestExit' }
  /** ExitSheet choice (save) or discard. */
  | { type: 'finish'; save: boolean }
  /** Settings changed mid-session; applies from the next slide. */
  | { type: 'configure'; animMs?: number; fixedColor?: FixedColor };

export type RunnerEvent = RunnerEventInput & At;

// ─── Effects ────────────────────────────────────────────────────────────

export type ApiEffect =
  | { type: 'api'; call: 'next'; reqId: number; payload: { sessionId: string } }
  | { type: 'api'; call: 'attempt'; reqId: number; payload: { sessionId: string; puzzleId: string; correct: boolean; responseMs: number } }
  /** The interpreter appends localDate = formatLocalDate(new Date()) at send time. */
  | { type: 'api'; call: 'finish'; reqId: number; payload: { sessionId: string; save: boolean } }
  | { type: 'api'; call: 'detail'; reqId: number; payload: { sessionId: string } };

export type RunnerEffect =
  /** board.reset(fen, orientation): new puzzle, no slides. */
  | { type: 'reset'; fen: string; orientation: Orientation }
  /** board.setPosition(fen, lastMove, ms). */
  | { type: 'setPosition'; fen: string; lastMove: LastMove | null; ms: number }
  /** board.animateMove(from, to, ms, promotion), then dispatch `done`. */
  | { type: 'animate'; id: number; from: Square; to: Square; ms: number; promotion?: PromotionPiece; done: AnimationDoneEvent }
  | { type: 'interactive'; on: boolean }
  | { type: 'flash'; square: Square; ok: boolean }
  | { type: 'shake'; square: Square }
  | { type: 'sparks'; square: Square }
  /** Board onMove must return false: the board takes the move back. */
  | { type: 'rejectMove' }
  /** feel.emit(event, ctx). */
  | { type: 'feel'; event: FeelEvent; ctx?: { move?: MoveFeel; streak?: number } }
  | ApiEffect
  /** setTimeout(ms) then dispatch `event` (an existing id is replaced). */
  | { type: 'schedule'; id: TimerId; ms: number; event: TimerEvent }
  | { type: 'cancel'; id: TimerId }
  /** Store: patchStyleProgression(style, { currentPuzzleRating }). Never for theme sessions. */
  | { type: 'patchProgression'; style: TrainingStyle; currentPuzzleRating: number }
  /** Open the ExitSheet (≥ 1 attempt). */
  | { type: 'confirmExit' }
  /** Finish succeeded with a saved session: daily streak, toasts, invalidate ['me']. */
  | { type: 'finished'; response: FinishResponse }
  /** Discarded: leave the runner (router.replace home). */
  | { type: 'exit' }
  /** Write toSnapshot(state, now) to MMKV `session`. */
  | { type: 'persistSnapshot' }
  | { type: 'clearSnapshot' };

export type Transition = { state: RunnerState; effects: RunnerEffect[] };

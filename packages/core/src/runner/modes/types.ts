// Practice modes of the shared runner (PLAN §2.7, Phase 6): the theme
// drill, the session-mistakes runner and the read-only puzzle viewer. They
// share the session runner's board effects and its FEN-only state, but have
// no clock, no attempts and no snapshot, so they run on their own small
// reducer (practiceReducer) instead of growing the session state machine.
import type { FeelEvent } from '../../feel';
import type { Orientation, PromotionPiece, Square } from '../../board';
import type { ServerPuzzle } from '../../puzzle';
import type { AnimationDoneEvent, FixedColor, LastMove, MoveFeel } from '../types';

export type PracticeMode = 'drill' | 'mistakes' | 'viewer';

/** GET /sessions/:id/review-items reason. */
export type ReviewReason = 'failed' | 'slow';

export type PracticeItem = { puzzle: ServerPuzzle; reason?: ReviewReason };

export type PracticeConfig = {
  mode: PracticeMode;
  /** ANIMATION_MS[settings.animationSpeed]. */
  animMs: number;
  /** Q13 (PROVISIONAL): honoured in every mode; the web did it in the mistakes runner only. */
  fixedColor: FixedColor;
};

export type PracticePhase =
  /** Nothing on the board yet. */
  | 'idle'
  /** The previous puzzle is fading out; the next one loads on `faded`. */
  | 'swapping'
  | 'setupAnimating'
  | 'playerTurn'
  | 'opponentReplying'
  /** A wrong move is on the board; the rewind to the start is due. */
  | 'rewinding'
  /** Solved: the badge pops and holds (drill / mistakes advance after it). */
  | 'solved'
  /** Drill: POST resolve + the next puzzle are in flight. */
  | 'advancing'
  | 'advanceFailed'
  /** Viewer: stepping through the full line. */
  | 'solution'
  | 'done';

export type PracticeTimer = 'reply' | 'rewind' | 'advance';

export type PracticeAnim = {
  id: number;
  kind: 'setup' | 'opponent';
  fenAfter: string;
  lastMove: LastMove;
  move: MoveFeel;
};

export type PracticeState = {
  mode: PracticeMode;
  animMs: number;
  fixedColor: FixedColor;
  phase: PracticePhase;
  /** The puzzle on the board (mistakes: always the queue head). */
  item: PracticeItem | null;
  /** Waiting behind the fade-out. */
  incoming: PracticeItem | null;
  /** Position after the setup move: the rewind target. */
  start: { fen: string; lastMove: LastMove | null; remaining: string[] } | null;
  fen: string | null;
  lastMove: LastMove | null;
  orientation: Orientation;
  playerColor: 'w' | 'b';
  remaining: string[];
  hintLevel: 0 | 1 | 2;
  anim: PracticeAnim | null;
  seq: number;
  timers: Partial<Record<PracticeTimer, true>>;
  advanceReqId: number | null;
  /** The puzzle's line could not be played (corrupt data). */
  error: 'broken' | null;

  // Mistakes queue: local FIFO, nothing goes back to the server except Q14's resolve.
  queue: PracticeItem[];
  total: number;
  solvedCount: number;
  failedTries: number;
  /** Wrong-move rewinds on this screen (every mode; the e2e probe reads it). */
  rewinds: number;

  // Drill: ids of the first list fetch, frozen for the whole run (web sessionRef).
  counterIds: string[];
  /** Puzzles solved in this run. */
  drilled: number;

  // Viewer.
  fens: string[] | null;
  /** 1 … moves.length: positions after `ply` moves of the full line. */
  ply: number;
};

// ─── Events ─────────────────────────────────────────────────────────────

export type StepSource = 'tap' | 'repeat' | 'swipe';

export type PracticeEvent =
  /** Mount. Drill: [first puzzle] + the frozen counter ids; mistakes: the queue; viewer: [puzzle]. */
  | { type: 'start'; items: PracticeItem[]; counterIds?: string[] }
  /** Drill advance result; null when the theme is cleared. */
  | { type: 'loaded'; reqId: number; item: PracticeItem | null }
  | { type: 'loadFailed'; reqId: number }
  | { type: 'retry' }
  | { type: 'faded' }
  | { type: 'move'; from: Square; to: Square; promotion?: PromotionPiece | string }
  | AnimationDoneEvent
  | { type: 'timer'; id: PracticeTimer }
  | { type: 'hint' }
  /** Drill / mistakes: give up on the puzzle on the board and move on (offline runner Skip). */
  | { type: 'skip' }
  | { type: 'showSolution' }
  | { type: 'tryAgain' }
  | { type: 'step'; delta: number; source: StepSource }
  | { type: 'seek'; ply: number }
  | { type: 'configure'; animMs?: number; fixedColor?: FixedColor };

// ─── Effects ────────────────────────────────────────────────────────────

export type PracticeEffect =
  | { type: 'reset'; fen: string; orientation: Orientation }
  | { type: 'setPosition'; fen: string; lastMove: LastMove | null; ms: number }
  | { type: 'animate'; id: number; from: Square; to: Square; ms: number; promotion?: PromotionPiece; done: AnimationDoneEvent }
  | { type: 'interactive'; on: boolean }
  | { type: 'flash'; square: Square; ok: boolean }
  | { type: 'shake'; square: Square }
  | { type: 'sparks'; square: Square }
  | { type: 'rejectMove' }
  | { type: 'hint'; level: 0 | 1 | 2; from: Square | null; to: Square | null }
  | { type: 'feel'; event: FeelEvent; ctx?: { move?: MoveFeel } }
  | { type: 'schedule'; id: PracticeTimer; ms: number }
  | { type: 'cancel'; id: PracticeTimer }
  /** Fade the board out, then dispatch `faded`. */
  | { type: 'fadeOut' }
  | { type: 'fadeIn' }
  /** Drill: POST /review/:id/resolve (errors swallowed), fresh list, next puzzle → `loaded`. */
  | { type: 'advance'; reqId: number; puzzleId: string }
  /** Fire-and-forget POST /review/:id/resolve (Q14: mistakes solves clear the global queue). */
  | { type: 'resolve'; puzzleId: string };

export type PracticeTransition = { state: PracticeState; effects: PracticeEffect[] };

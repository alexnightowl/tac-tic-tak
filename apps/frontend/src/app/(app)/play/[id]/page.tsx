'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess, Square } from 'chess.js';
import { X, Check, XCircle, Loader2, Sparkles, TrendingDown, Pause, Play } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore, ANIMATION_MS } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { useToastStore } from '@/lib/toast';
import { Chessboard } from '@/components/board/Chessboard';
import { TurnCard } from '@/components/board/TurnCard';
import { Button } from '@/components/ui/button';
import { ServerPuzzle, initPuzzle, uciFromMove } from '@/lib/puzzle';
import { takeFirstPuzzle } from '@/lib/pending-puzzle';
import { playSound } from '@/lib/sound';
import { fmtDuration, cn, formatLocalDate } from '@/lib/utils';
import { BoardTheme } from '@/lib/themes';
import {
  computeUnlockProgress, CriterionProgress, CriterionId, UNLOCK_REWARD,
  TrainingStyle, DEFAULT_STYLE, isTrainingStyle, CALIBRATION_SESSIONS,
} from '@/lib/levels';

type NextResponse = {
  puzzle: ServerPuzzle;
  currentRating: number;
  session: { id: string; startedAt: string; durationSec: number; style?: string; mode?: 'mixed' | 'theme' };
};
type FinishResponse = {
  sessionId: string; solved: number; failed: number; accuracy: number;
  avgResponseMs: number; peakRating: number; durationSec?: number;
  // Server-set when the session was ended via the exit dialog instead
  // of running its full duration. Suppresses level-up/demote cards in
  // the summary — the player's stats are kept but progression doesn't
  // move.
  early?: boolean;
  unlocked?: boolean;
  unlockCheck?: {
    met: boolean;
    solvedTarget: number;
    criteria: Array<{
      id: CriterionId;
      met: boolean;
      current: number;
      target: number;
    }>;
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

export default function PlayRunner() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const settingsReady = useAppStore((s) => s.settingsReady);
  const progressions = useAppStore((s) => s.progressions);
  const patchStyleProgression = useAppStore((s) => s.patchStyleProgression);
  const setDailyStreak = useAppStore((s) => s.setStreak);
  const pushToast = useToastStore((s) => s.push);
  const t = useT();
  const focusMode = settings.focusMode;

  const [puzzle, setPuzzle] = useState<ServerPuzzle | null>(null);
  const [chess, setChess] = useState<Chess | null>(() => new Chess());
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [remaining, setRemaining] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [animateMove, setAnimateMove] = useState<{ from: Square; to: Square } | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [summary, setSummary] = useState<FinishResponse | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [opponentBusy, setOpponentBusy] = useState(false);
  const [sessionStartRating, setSessionStartRating] = useState<number | null>(null);
  const [sessionStyle, setSessionStyle] = useState<TrainingStyle>(DEFAULT_STYLE);
  const [sessionMode, setSessionMode] = useState<'mixed' | 'theme'>('mixed');
  const [peakRating, setPeakRating] = useState<number>(0);
  const [totalResponseMs, setTotalResponseMs] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  // If non-null, holds the streak length that just snapped — used to
  // render the "🔥 N ✗" broken-chip animation for ~700ms before the
  // chip disappears entirely.
  const [streakBroken, setStreakBroken] = useState<number | null>(null);
  // Transient per-attempt feedback shown as a colored ring around the
  // board. `id` is a timestamp so that consecutive same-correctness
  // attempts still retrigger the CSS animation via React's key reset.
  const [feedback, setFeedback] = useState<{ correct: boolean; id: number } | null>(null);
  const attemptStart = useRef<number>(Date.now());
  const loading = useRef(false);
  const finishing = useRef(false);

  // Pause state. While paused: the session timer stops counting, the
  // board ignores moves, and an overlay invites the player to resume.
  // On resume both endsAt and the per-puzzle attemptStart get bumped
  // forward by the pause duration so the user isn't penalised on
  // either the session timer or per-puzzle responseMs.
  const [paused, setPaused] = useState(false);
  const [pausedRemainingMs, setPausedRemainingMs] = useState<number | null>(null);
  const pauseStartedAt = useRef<number | null>(null);

  function pause() {
    if (paused || !endsAt || loadingFirst || finishing.current) return;
    const rem = Math.max(0, endsAt - Date.now());
    setPausedRemainingMs(rem);
    pauseStartedAt.current = Date.now();
    setPaused(true);
  }

  function resume() {
    if (!paused || pausedRemainingMs == null) return;
    const dur = Date.now() - (pauseStartedAt.current ?? Date.now());
    // Push the per-puzzle thinking-time anchor forward so responseMs
    // for the current puzzle reflects active time only, not wall time.
    attemptStart.current += dur;
    setEndsAt(Date.now() + pausedRemainingMs);
    setPausedRemainingMs(null);
    pauseStartedAt.current = null;
    setPaused(false);
  }

  // Lock html + body scroll for the runner's whole lifetime (regardless
  // of focus mode). iOS PWA sometimes reports a 100dvh taller than the
  // actual visible area, which otherwise causes the bottom of the board
  // to slip under the home indicator and a phantom scroll to appear.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('play-locked');
    document.body.classList.add('play-locked');
    return () => {
      html.classList.remove('play-locked');
      document.body.classList.remove('play-locked');
    };
  }, []);

  useEffect(() => {
    if (!focusMode) return;
    document.body.classList.add('focus-mode');
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => {});
    return () => {
      document.body.classList.remove('focus-mode');
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [focusMode]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (paused) return;
    if (endsAt && now >= endsAt && !finishing.current) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, endsAt, paused]);

  useEffect(() => {
    const applyNextResponse = (r: NextResponse) => {
      setDurationSec(r.session.durationSec);
      // Use the client's clock as the anchor so no seconds are lost to
      // network round-trips.
      setEndsAt(Date.now() + r.session.durationSec * 1000);
      setSessionStartRating(r.currentRating);
      setPeakRating(r.currentRating);
      if (r.session.style && isTrainingStyle(r.session.style)) {
        setSessionStyle(r.session.style);
      }
      if (r.session.mode === 'theme' || r.session.mode === 'mixed') {
        setSessionMode(r.session.mode);
      }
      loadPuzzle(r.puzzle, r.currentRating);
      setLoadingFirst(false);
    };

    // If POST /sessions already shipped us the first puzzle, use it and
    // skip the extra /next round-trip. This is the common path now —
    // avoids waiting on another Postgres trip before the board appears.
    const stashed = takeFirstPuzzle(sessionId);
    if (stashed) {
      applyNextResponse(stashed as NextResponse);
      return;
    }

    // Legacy / fallback path: no stashed puzzle (e.g. hard-refresh of
    // the runner URL, or the backend didn't send one back).
    (async () => {
      try {
        const r = await http.post<NextResponse>(`/sessions/${sessionId}/next`);
        applyNextResponse(r);
      } catch {
        setSummary({ sessionId, solved: 0, failed: 0, accuracy: 0, avgResponseMs: 0, peakRating: 0 });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  function loadPuzzle(p: ServerPuzzle, currentRating: number) {
    const init = initPuzzle(p);
    setPuzzle(p);
    setChess(new Chess(init.preFen));
    setRemaining(init.remaining);

    let side: 'white' | 'black' = init.playerColor === 'w' ? 'white' : 'black';
    if (settings.fixedColor === 'white') side = 'white';
    else if (settings.fixedColor === 'black') side = 'black';
    setOrientation(side);

    setLastMove(null);
    setAnimateMove(init.setupMove ? { from: init.setupMove.from, to: init.setupMove.to } : null);
    patchStyleProgression(sessionStyle, { currentPuzzleRating: currentRating });

    const animMs = ANIMATION_MS[settings.animationSpeed];
    // Let the setup piece slide, then swap in the post-setup position.
    if (init.setupMove) {
      const mv = init.setupMove;
      if (settings.soundEnabled) playSound(settings.soundPack, 'move');
      if (animMs === 0) {
        setChess(new Chess(init.postFen));
        setLastMove({ from: mv.from, to: mv.to });
        setAnimateMove(null);
        attemptStart.current = Date.now();
      } else {
        setTimeout(() => {
          setChess(new Chess(init.postFen));
          setLastMove({ from: mv.from, to: mv.to });
          setAnimateMove(null);
          attemptStart.current = Date.now();
        }, animMs + 20);
      }
    } else {
      attemptStart.current = Date.now();
    }
  }

  async function afterAttempt(correct: boolean) {
    if (!puzzle) return;
    const responseMs = Date.now() - attemptStart.current;
    setTotalResponseMs((t) => t + responseMs);
    if (correct) {
      setSolvedCount((c) => c + 1);
      setPeakRating((p) => Math.max(p, puzzle.rating));
    } else {
      setFailedCount((c) => c + 1);
    }
    if (settings.soundEnabled) playSound(settings.soundPack, correct ? 'correct' : 'fail');
    // Coloured ring-pulse around the board — binary visual answer the
    // user can read even with sound off. Auto-clears so the next puzzle
    // starts with a clean frame.
    setFeedback({ correct, id: Date.now() });
    setTimeout(() => setFeedback(null), 500);
    // Drive the visible streak from local state optimistically (so it
    // updates even if the attempt request is in-flight), then reconcile
    // with the server's canonical count when the response lands.
    if (!correct && streak >= 2) {
      const broken = streak;
      setStreakBroken(broken);
      setTimeout(() => setStreakBroken(null), 700);
    }
    setStreak((prev) => (correct ? prev + 1 : 0));
    try {
      const r = await http.post<{ newRating: number; streak?: number }>(`/sessions/${sessionId}/attempt`, {
        puzzleId: puzzle.id, correct, responseMs,
      });
      patchStyleProgression(sessionStyle, { currentPuzzleRating: r.newRating });
      if (typeof r.streak === 'number') setStreak(r.streak);
    } catch {}
    // No visual flash — sound carries the feedback, next puzzle loads right away.
    setTimeout(() => { nextPuzzle(); }, correct ? 220 : 360);
  }

  async function nextPuzzle() {
    if (loading.current) return;
    loading.current = true;
    try {
      const r = await http.post<NextResponse>(`/sessions/${sessionId}/next`);
      loadPuzzle(r.puzzle, r.currentRating);
    } catch {
      // One retry with backoff — covers brief backend restarts (rolling
      // deploys) and flaky network. Only end the session if the retry
      // fails too, so an in-progress session isn't nuked by a 30-second
      // container swap.
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const r = await http.post<NextResponse>(`/sessions/${sessionId}/next`);
        loadPuzzle(r.puzzle, r.currentRating);
      } catch {
        await finish();
      }
    } finally {
      loading.current = false;
    }
  }

  async function finish(opts: { save?: boolean } = {}) {
    if (finishing.current) return;
    finishing.current = true;
    const save = opts.save !== false;
    // The user's local 'YYYY-MM-DD' so the server can tick the
    // daily-streak in their TZ instead of UTC. Sent on every
    // finish — discarded calls ignore it server-side.
    const localDate = formatLocalDate(new Date());
    const params = new URLSearchParams();
    if (!save) params.set('save', 'false');
    params.set('localDate', localDate);
    try {
      const r = await http.post<FinishResponse & { discarded?: boolean }>(
        `/sessions/${sessionId}/finish?${params.toString()}`,
      );
      if ((r as any).discarded) {
        router.replace('/dashboard');
        return;
      }
      if (r.streak) {
        setDailyStreak({
          days: r.streak.days,
          freezes: r.streak.freezes,
          lastDay: r.streak.lastDay,
          freezeRegenAt: r.streak.freezeRegenAt,
        });
      }
      if (r.achievementsUnlocked && r.achievementsUnlocked.length > 0) {
        for (const slug of r.achievementsUnlocked) {
          pushToast({
            tone: 'achievement',
            title: t(`achv.${slug}.name`),
            description: t(`achv.${slug}.desc`),
            achievementSlug: slug,
          });
        }
      }
      setSummary(r);
    } catch {
      // Backend unreachable — don't gaslight the user with zeros, fall
      // back to the stats we've been tracking client-side throughout
      // the session.
      const attempts = solvedCount + failedCount;
      setSummary({
        sessionId,
        solved: solvedCount,
        failed: failedCount,
        accuracy: attempts > 0 ? solvedCount / attempts : 0,
        avgResponseMs: attempts > 0 ? totalResponseMs / attempts : 0,
        peakRating,
      });
    }
  }

  function requestExit() {
    // If the user has made at least one attempt, ask whether to save or discard.
    if (solvedCount + failedCount > 0) {
      setConfirmExit(true);
    } else {
      finish({ save: false });
    }
  }

  function handleMove(m: { from: Square; to: Square; promotion?: string }) {
    if (!chess || !puzzle || opponentBusy) return false;
    const candidate = uciFromMove(m);
    const expected = remaining[0];
    if (!expected) return false;

    const legal = chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    if (!legal) return false;

    setLastMove({ from: m.from, to: m.to });
    if (settings.soundEnabled) playSound(settings.soundPack, legal.captured ? 'capture' : 'move');

    if (candidate !== expected) {
      afterAttempt(false);
      return true;
    }

    const afterExpected = remaining.slice(1);
    if (afterExpected.length === 0) {
      afterAttempt(true);
      return true;
    }

    const opponentUci = afterExpected[0];
    const opFrom = opponentUci.slice(0, 2) as Square;
    const opTo = opponentUci.slice(2, 4) as Square;
    const opPromo = opponentUci.length > 4 ? opponentUci.slice(4) : undefined;
    setOpponentBusy(true);
    const animMs = ANIMATION_MS[settings.animationSpeed];
    setTimeout(() => {
      const move = chess.move({ from: opFrom, to: opTo, promotion: opPromo });
      setChess(new Chess(chess.fen()));
      setLastMove({ from: opFrom, to: opTo });
      if (settings.soundEnabled) playSound(settings.soundPack, move?.captured ? 'capture' : 'move');
      setRemaining(afterExpected.slice(1));
      setOpponentBusy(false);
    }, Math.max(animMs, 80));

    setChess(new Chess(chess.fen()));
    return true;
  }

  const totalAttempts = solvedCount + failedCount;
  const unlockProgress = useMemo(() => {
    if (sessionStartRating == null || durationSec === 0) return null;
    return computeUnlockProgress(sessionStyle, {
      solved: solvedCount,
      accuracy: totalAttempts === 0 ? 0 : solvedCount / totalAttempts,
      avgResponseMs: totalAttempts === 0 ? 0 : Math.round(totalResponseMs / totalAttempts),
      peakRating,
      startRating: sessionStartRating,
    }, durationSec);
  }, [sessionStyle, sessionStartRating, durationSec, solvedCount, totalAttempts, totalResponseMs, peakRating]);

  if (summary) return <SessionSummary s={summary} />;

  const remainingSec = paused
    ? Math.round((pausedRemainingMs ?? 0) / 1000)
    : endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0;
  const warnThreshold = Math.min(30, Math.max(10, Math.round(durationSec * 0.1)));
  // Don't pulse the timer red while paused — it's not running.
  const warning = !loadingFirst && !paused && remainingSec <= warnThreshold && remainingSec > 0;
  const isPlayerTurn = !!chess && ((orientation === 'white' && chess.turn() === 'w') || (orientation === 'black' && chess.turn() === 'b'));
  const styleProg = progressions[sessionStyle];
  const currentRating = styleProg?.currentPuzzleRating ?? null;
  const unlockCeiling = styleProg?.unlockedStartRating ?? null;
  // Level-up UI (criteria progress bar, level-up / demote / comfort
  // cards) only surfaces AFTER calibration finishes. During
  // calibration the player just plays — ratings move quietly and
  // mechanics are introduced only when calibration ends. After
  // calibration, eligibility additionally requires the session to
  // have STARTED within DEMOTE_PEAK_BAND (50) of the ceiling.
  const PEAK_BAND = 50;
  const isCalibrating = (styleProg?.calibrationSessionsLeft ?? 0) > 0;
  const sessionEligibleForUnlock =
    sessionMode !== 'theme' &&
    !isCalibrating &&
    sessionStartRating != null &&
    unlockCeiling != null &&
    sessionStartRating >= unlockCeiling - PEAK_BAND;

  const exitButton = (
    <Button
      variant="glass"
      size="sm"
      onClick={requestExit}
      className="!px-3"
      aria-label={t('play.exit')}
    >
      <X size={18} /> {t('play.exit')}
    </Button>
  );

  const pauseButton = (
    <Button
      variant="glass"
      size="sm"
      onClick={paused ? resume : pause}
      disabled={loadingFirst}
      className="!px-3"
      aria-label={paused ? t('play.resume') : t('play.pause')}
    >
      {paused ? <Play size={18} /> : <Pause size={18} />}
    </Button>
  );

  const timerPill = (
    <div className={cn(
      'font-mono text-xl tabular-nums px-4 py-1.5 rounded-full border transition-colors text-center',
      warning
        ? 'bg-red-500/15 border-red-400/60 text-red-300 pulse-red'
        : paused
          ? 'glass text-amber-300 border-amber-300/30'
          : 'glass text-white',
    )}>
      {loadingFirst ? '--:--' : fmtDuration(remainingSec)}
    </div>
  );

  const turnCard = (
    <TurnCard
      orientation={orientation}
      isPlayerTurn={isPlayerTurn}
      loading={loadingFirst}
      opponentBusy={opponentBusy}
      streak={streak}
      streakBroken={streakBroken}
    />
  );

  // Progress slot below the turn card. Three states:
  //   1. calibrating  → CalibrationProgressBar (X / N sessions). The
  //      level-up gate isn't live yet, so we show calibration progress
  //      in the same slot — same outer shape so the position doesn't
  //      shift when calibration finishes and the unlock bar replaces
  //      this one.
  //   2. eligible     → UnlockProgressBar (criteria + cap arrow).
  //   3. otherwise    → nothing (theme mode / comfort-zone session,
  //      where the cap can't move).
  const calibrationLeft = styleProg?.calibrationSessionsLeft ?? 0;
  const progressBar = isCalibrating && sessionMode !== 'theme' ? (
    <CalibrationProgressBar
      done={CALIBRATION_SESSIONS - calibrationLeft}
      total={CALIBRATION_SESSIONS}
      style={sessionStyle}
    />
  ) : !sessionEligibleForUnlock || !unlockProgress || unlockCeiling == null
    ? null
    : (
      <UnlockProgressBar
        progress={unlockProgress}
        unlockedTo={unlockCeiling}
      />
    );

  const statsRow = (
    <div className="grid grid-cols-3 gap-2">
      <StatPill icon={<Check size={14} />} value={solvedCount} tone="good" />
      {sessionMode === 'theme'
        ? <RatingPill rating={sessionStartRating} label={t('play.drill')} />
        : <RatingPill rating={currentRating} label={t('play.rating')} />}
      <StatPill icon={<XCircle size={14} />} value={failedCount} tone="bad" align="right" />
    </div>
  );

  const boardBlock = (
    <div className="relative w-full aspect-square">
      {chess && settingsReady && (
        <Chessboard
          fen={chess.fen()}
          orientation={orientation}
          onMove={handleMove}
          lastMove={lastMove}
          animateMove={animateMove}
          animationMs={ANIMATION_MS[settings.animationSpeed]}
          allowMoves={!animateMove && !loadingFirst && !paused}
          theme={settings.boardTheme as BoardTheme}
          pieceSet={settings.pieceSet}
        />
      )}
      {(loadingFirst || !settingsReady) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-full h-14 w-14 flex items-center justify-center shadow-lg">
            <Loader2 size={28} className="text-[var(--accent)] animate-spin" />
          </div>
        </div>
      )}
      {/* Correct/incorrect ring-pulse around the board. `key` on the id
          forces React to remount the element so the CSS animation
          replays on every attempt, even two corrects in a row. */}
      {feedback && (
        <div
          key={feedback.id}
          className={cn(
            'absolute inset-0 pointer-events-none rounded-xl board-feedback-ring',
            feedback.correct ? 'is-correct' : 'is-fail',
          )}
          aria-hidden
        />
      )}
    </div>
  );

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden px-2 lg:px-6"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        // iOS PWA: without this the stats row + board's bottom edge
        // slide under the home indicator and a phantom scroll appears.
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Phone & tablet: stacked. Desktop (lg+): board on the left,
          all controls on a fixed right-hand panel. The whole row is
          capped at 2xl (1536px) and centred via mx-auto so on wide
          monitors the board+panel group doesn't drift to the left
          edge with a sea of empty space beside it. */}
      <div className="flex flex-col lg:flex-row items-stretch flex-1 min-h-0 w-full gap-2 lg:gap-6 lg:max-w-screen-2xl lg:mx-auto">
        {/* Mobile-only top stack — duplicates the controls into the
            stacked phone layout. Hidden on desktop so the right panel
            is the single source of truth. */}
        <div className="lg:hidden w-full mx-auto max-w-[min(calc(100vh-240px),880px)] flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            {exitButton}
            {timerPill}
            {pauseButton}
          </div>
          {turnCard}
          {progressBar}
        </div>

        {/* Board column. `container-type: size` lets the inner element
            sample its parent's resolved width AND height with cqw/cqh,
            so we can always render the largest square that fits. */}
        <div
          className="flex-1 grid place-items-center min-h-0 min-w-0 w-full"
          style={{ containerType: 'size' }}
        >
          <div
            className="aspect-square"
            style={{ width: 'min(100cqw, 100cqh)' }}
          >
            {boardBlock}
          </div>
        </div>

        {/* Mobile-only bottom stats. */}
        <div className="lg:hidden w-full mx-auto max-w-[min(calc(100vh-240px),880px)]">
          {statsRow}
        </div>

        {/* Desktop-only side panel — vertically centred next to the
            board so the controls read as a single coherent block
            instead of three orphan widgets pinned to corners. */}
        <aside className="hidden lg:flex w-[320px] shrink-0 self-center flex-col gap-3 max-h-full overflow-y-auto py-2">
          <div className="flex items-center justify-between gap-2">
            {exitButton}
            {timerPill}
            {pauseButton}
          </div>
          {turnCard}
          {progressBar}
          {statsRow}
        </aside>
      </div>

      {confirmExit && (
        <ExitDialog
          onSave={() => { setConfirmExit(false); finish({ save: true }); }}
          onDiscard={() => { setConfirmExit(false); finish({ save: false }); }}
          onCancel={() => setConfirmExit(false)}
          language={settings.language}
        />
      )}

      {paused && (
        <PauseOverlay
          remainingSec={remainingSec}
          onResume={resume}
          t={t}
        />
      )}
    </div>
  );
}

function PauseOverlay({ remainingSec, onResume, t }: {
  remainingSec: number;
  onResume: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm">
        <div className="font-mono text-4xl tabular-nums text-amber-300">
          {fmtDuration(remainingSec)}
        </div>
        <div className="text-2xl font-semibold text-white">{t('play.paused')}</div>
        <div className="text-sm text-zinc-300 max-w-[280px]">{t('play.paused_hint')}</div>
        <Button onClick={onResume} size="lg" className="mt-2 min-w-[200px]">
          <Play size={18} /> {t('play.resume')}
        </Button>
      </div>
    </div>
  );
}

function ExitDialog({ onSave, onDiscard, onCancel, language }: {
  onSave: () => void; onDiscard: () => void; onCancel: () => void; language: string;
}) {
  const uk = language === 'uk';
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4" onClick={onCancel}>
      <div className="glass rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-base font-medium">
          {uk ? 'Завершити сесію?' : 'End session?'}
        </div>
        <div className="text-xs text-zinc-400 mt-1">
          {uk
            ? 'Ви виходите достроково. «Зберегти» запише статистику, але левел-ап не зарахується — або відкиньте сесію.'
            : 'Leaving early. Save records the stats but won\'t count toward level-up — or discard the session.'}
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <button onClick={onSave} className="h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold text-sm">
            {uk ? 'Зберегти' : 'Save'}
          </button>
          <button onClick={onDiscard} className="h-11 rounded-xl border border-rose-500/40 text-rose-300 text-sm">
            {uk ? 'Відкинути' : 'Discard'}
          </button>
          <button onClick={onCancel} className="h-11 rounded-xl border border-[var(--border)] text-zinc-300 text-sm">
            {uk ? 'Продовжити' : 'Keep playing'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, value, tone, align }: { icon: React.ReactNode; value: number; tone: 'good' | 'bad'; align?: 'right' }) {
  return (
    <div className={cn(
      'glass rounded-xl py-2 px-3 flex items-center gap-1.5 text-sm',
      align === 'right' ? 'justify-end' : 'justify-start',
      tone === 'good' ? 'text-emerald-300' : 'text-rose-300',
    )}>
      {icon}
      <span className="tabular-nums font-semibold">{value}</span>
    </div>
  );
}

function RatingPill({ rating, label }: { rating: number | null; label: string }) {
  return (
    <div className="glass rounded-xl py-2 px-3 flex items-center justify-center gap-2 text-sm">
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="tabular-nums font-semibold text-white">{rating ?? '—'}</span>
    </div>
  );
}

function UnlockProgressBar({
  progress, unlockedTo,
}: { progress: { criteria: CriterionProgress[]; ratio: number; met: boolean }; unlockedTo: number }) {
  const t = useT();
  const pct = Math.round(progress.ratio * 100);
  const met = progress.met;

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2',
        met
          ? 'border-[var(--accent)]/60 bg-[var(--accent)]/10'
          : 'border-[var(--border-soft)] bg-black/20',
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          {met && <Sparkles size={12} className="text-[var(--accent)]" />}
          {met ? t('unlock.met') : t('unlock.progress')}
        </span>
        <span className="tabular-nums text-xs text-zinc-300">
          <span className="text-zinc-500">{unlockedTo}</span>
          <span className="mx-1 text-zinc-600">→</span>
          <span className={met ? 'text-[var(--accent)] font-semibold' : 'text-zinc-400'}>
            {unlockedTo + UNLOCK_REWARD}
          </span>
        </span>
      </div>

      <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-300',
            met ? 'bg-[var(--accent)]' : 'bg-emerald-400/80',
          )}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-1.5 mt-2">
        {progress.criteria.map((c) => (
          <CriterionTick key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}

/**
 * Calibration twin of UnlockProgressBar — same outer shell so the slot
 * doesn't change shape when calibration ends and the level-up bar
 * takes over. No criteria grid (the level-up criteria are hidden
 * during calibration), just a "X / N sessions" counter and a hint.
 */
function CalibrationProgressBar({ done, total, style }: {
  done: number; total: number; style: TrainingStyle;
}) {
  const t = useT();
  const pct = Math.round((done / total) * 100);
  const styleName = t(`style.${style}.name`).toLowerCase();
  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-amber-200/90">
          {t('calibration.bar_label')}
        </span>
        <span className="tabular-nums text-xs">
          <span className="text-amber-200 font-semibold">{done}</span>
          <span className="mx-1 text-amber-200/50">/</span>
          <span className="text-amber-200/70">{total}</span>
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-amber-400/80 transition-[width] duration-300"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <p className="text-[10px] text-amber-200/70 mt-2 leading-snug">
        {t('calibration.bar_hint').replace('{style}', styleName)}
      </p>
    </div>
  );
}

function CriterionTick({ c }: { c: CriterionProgress }) {
  const t = useT();
  const label = {
    solved: t('unlock.req_solved'),
    accuracy: t('unlock.req_accuracy'),
    speed: t('unlock.req_speed'),
    peak: t('unlock.req_peak'),
  }[c.id];

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-md py-1 text-[10px] border',
        c.met
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-[var(--border-soft)] bg-transparent text-zinc-500',
      )}
      title={label}
    >
      <span className="leading-none">{label}</span>
      <span className="tabular-nums font-semibold leading-none">
        {Math.round(c.ratio * 100)}%
      </span>
    </div>
  );
}

function SessionSummary({ s }: { s: FinishResponse }) {
  const t = useT();
  // Three branches for the level-up area at the top of the summary.
  //
  //   1. wasCalibrating + final session → LevelUpExplainer that
  //      introduces the level-up / demote mechanics now that the
  //      player has a settled rating.
  //   2. wasCalibrating + not final     → nothing. Calibration is
  //      meant to be invisible; the player just sees their stats.
  //   3. stable mode                    → existing UnlockOutcome /
  //      DemoteOutcome / ComfortSessionNote logic. ComfortSession
  //      kicks in for sub-peak-band sessions where the cap can't
  //      move regardless of criteria-met.
  const wasCalibrating = !!s.calibration?.active;
  const finalCalibrationSession =
    wasCalibrating && s.calibration!.sessionsLeftAfter === 0;
  const isComfortSession =
    !wasCalibrating && s.demoteCheck && s.demoteCheck.atPeak === false;
  return (
    <div
      className="max-w-md mx-auto space-y-4 px-4"
      // Body has play-locked here (the runner mounts both the
      // playing and summary screens), which strips .app-shell's
      // safe-area-inset-top — without explicit padding the title
      // butts against the iPhone dynamic island in installed PWA.
      style={{ paddingTop: 'calc(2.5rem + env(safe-area-inset-top))' }}
    >
      <h1 className="text-2xl font-semibold text-center">{t('play.session_complete')}</h1>

      {s.early ? (
        <EarlyExitNote />
      ) : (
        <>
          {finalCalibrationSession && (
            <LevelUpExplainer ceiling={s.calibration!.ceilingAfter} />
          )}
          {!wasCalibrating && (
            isComfortSession ? (
              <ComfortSessionNote ceiling={s.demoteCheck!.unlockedStartRating} />
            ) : (
              <>
                {s.unlockCheck && <UnlockOutcome check={s.unlockCheck} unlocked={!!s.unlocked} />}
                {s.demoteCheck && !s.unlocked && (
                  <DemoteOutcome check={s.demoteCheck} demoted={!!s.demoted} />
                )}
              </>
            )
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('play.solved')} v={s.solved} />
        <Stat label={t('play.failed')} v={s.failed} />
        <Stat label={t('play.accuracy')} v={`${Math.round(s.accuracy * 100)}%`} />
        <Stat label={t('play.avg')} v={`${(s.avgResponseMs / 1000).toFixed(1)}s`} />
        <Stat label={t('play.peak')} v={s.peakRating} />
      </div>

      <ReviewThisSession sessionId={s.sessionId} />

      <div className="flex gap-2">
        <a href="/dashboard" className="flex-1"><Button variant="outline" className="w-full">Home</Button></a>
        <a href="/play" className="flex-1"><Button className="w-full">{t('play.play_again')}</Button></a>
      </div>
    </div>
  );
}

/**
 * Pulls the list of puzzles worth reviewing from this specific session
 * (failed + slow-solved), and offers a one-tap CTA into the session-
 * scoped review runner. Renders nothing if there's nothing to drill.
 */
function ReviewThisSession({ sessionId }: { sessionId: string }) {
  const t = useT();
  const [count, setCount] = useState<{ failed: number; slow: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    http.get<{ items: Array<{ reason: 'failed' | 'slow' }> }>(`/sessions/${sessionId}/review-items`)
      .then((r) => {
        if (cancelled) return;
        const failed = r.items.filter((i) => i.reason === 'failed').length;
        const slow = r.items.filter((i) => i.reason === 'slow').length;
        setCount({ failed, slow });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sessionId]);

  if (!count || (count.failed === 0 && count.slow === 0)) return null;

  return (
    <a
      href={`/sessions/${sessionId}/review`}
      className="block rounded-2xl p-4 border border-[var(--border-soft)] bg-black/20 hover:bg-black/30 transition-colors"
    >
      <div className="text-sm font-semibold">{t('review.session_heading')}</div>
      <div className="text-xs text-zinc-400 mt-0.5">
        {t('review.session_hint')
          .replace('{failed}', String(count.failed))
          .replace('{slow}', String(count.slow))}
      </div>
      <div className="mt-3 inline-flex items-center h-9 px-4 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold">
        {t('review.session_cta')}
      </div>
    </a>
  );
}

/**
 * Shown once on the summary of a player's FINAL calibration session.
 * Calibration runs without level-up UI so the new player can just
 * play; this card introduces the level-up / demote mechanics that
 * kick in starting next session, plus locks in their starting cap.
 */
function LevelUpExplainer({ ceiling }: { ceiling: number }) {
  const t = useT();
  const PEAK_BAND = 50;
  const peakFloor = ceiling - PEAK_BAND;
  return (
    <div className="rounded-2xl p-4 border border-[var(--accent)]/60 bg-[var(--accent)]/10 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-[var(--accent)] shrink-0" />
        <div className="font-semibold text-[var(--accent)]">
          {t('calibration.complete_title')}
        </div>
      </div>
      <div className="text-sm text-zinc-100">
        {t('calibration.complete_summary').replace('{ceiling}', String(ceiling))}
      </div>
      <ul className="text-xs text-zinc-300 space-y-1 pt-1 leading-snug list-none">
        <li>
          <span className="text-emerald-300 font-semibold">+50</span>{' '}
          {t('calibration.intro_unlock').replace('{floor}', String(peakFloor))}
        </li>
        <li>
          <span className="text-rose-300 font-semibold">−25</span>{' '}
          {t('calibration.intro_demote')}
        </li>
      </ul>
    </div>
  );
}

/**
 * Shown in place of the unlock/demote cards when the session was
 * ended via the exit dialog before the timer ran out. Stats are still
 * recorded but the session doesn't move the rating cap in either
 * direction — so neither the "you levelled up" nor the "you nearly
 * did" framing fits.
 */
function EarlyExitNote() {
  const t = useT();
  return (
    <div className="rounded-2xl p-4 border border-[var(--border-soft)] bg-black/20">
      <div className="text-sm font-semibold">{t('play.early_exit_title')}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{t('play.early_exit_hint')}</div>
    </div>
  );
}

/**
 * Calm caption for sessions started below the peak band — i.e. not
 * eligible for level-up. Avoids the all-green "near miss" UI of
 * UnlockOutcome which reads as "you nearly leveled up" when the
 * session was never going to count toward the cap.
 */
function ComfortSessionNote({ ceiling }: { ceiling: number }) {
  const t = useT();
  const PEAK_BAND = 50;
  const floor = ceiling - PEAK_BAND;
  return (
    <div className="rounded-2xl p-4 border border-[var(--border-soft)] bg-black/20">
      <div className="text-sm font-semibold">{t('play.comfort_summary_title')}</div>
      <div className="text-xs text-zinc-400 mt-0.5">
        {t('play.comfort_summary_hint').replace('{floor}', String(floor))}
      </div>
    </div>
  );
}

function DemoteOutcome({ check, demoted }: {
  check: NonNullable<FinishResponse['demoteCheck']>;
  demoted: boolean;
}) {
  const t = useT();

  // Player passed enough criteria — no warning to show.
  if (!check.weak && !demoted) return null;

  if (demoted) {
    return (
      <div className="rounded-2xl p-4 border border-rose-500/40 bg-rose-500/10 flex items-center gap-3">
        <TrendingDown size={22} className="text-rose-300 shrink-0" />
        <div>
          <div className="font-semibold text-rose-200">
            {t('demote.summary_demoted').replace('{penalty}', String(check.penalty))}
          </div>
          <div className="text-xs text-zinc-300 mt-0.5">
            {t('demote.summary_demoted_hint').replace('{ceiling}', String(check.unlockedStartRating))}
          </div>
        </div>
      </div>
    );
  }

  // Weak session at peak but streak hasn't crossed the threshold yet —
  // soft heads-up, deliberately calm tone so it reads as guidance not
  // punishment.
  return (
    <div className="rounded-2xl p-4 border border-amber-500/40 bg-amber-500/10 flex items-center gap-3">
      <TrendingDown size={20} className="text-amber-300 shrink-0" />
      <div>
        <div className="font-semibold text-amber-200">
          {t('demote.summary_weak')}
        </div>
        <div className="text-xs text-zinc-300 mt-0.5">
          {t('demote.summary_weak_hint')
            .replace('{remaining}', String(Math.max(0, check.threshold - check.streakAfter)))}
        </div>
      </div>
    </div>
  );
}

function UnlockOutcome({ check, unlocked }: {
  check: NonNullable<FinishResponse['unlockCheck']>;
  unlocked: boolean;
}) {
  const t = useT();

  if (unlocked) {
    return (
      <div className="rounded-2xl p-4 border border-[var(--accent)]/60 bg-[var(--accent)]/10 flex items-center gap-3">
        <Sparkles size={24} className="text-[var(--accent)] shrink-0" />
        <div>
          <div className="font-semibold text-[var(--accent)]">
            {t('unlock.summary_success')}
          </div>
          <div className="text-xs text-zinc-300 mt-0.5">
            {t('unlock.summary_success_hint').replace('{reward}', String(UNLOCK_REWARD))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 border border-[var(--border-soft)] bg-black/20">
      <div className="text-sm font-semibold">{t('unlock.summary_near')}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{t('unlock.summary_near_hint')}</div>
      <ul className="mt-3 space-y-1.5">
        {check.criteria.map((c) => (
          <CriterionRow key={c.id} c={c} />
        ))}
      </ul>
    </div>
  );
}

function CriterionRow({ c }: { c: FinishResponse['unlockCheck'] extends infer U ? (U extends { criteria: Array<infer C> } ? C : never) : never }) {
  const t = useT();
  const labels: Record<CriterionId, string> = {
    solved: t('unlock.req_solved'),
    accuracy: t('unlock.req_accuracy'),
    speed: t('unlock.req_speed'),
    peak: t('unlock.req_peak'),
  };
  const fmt = formatCriterion(c);
  return (
    <li className="flex items-center gap-2 text-xs">
      {c.met
        ? <Check size={14} className="text-emerald-400 shrink-0" />
        : <X size={14} className="text-rose-400 shrink-0" />}
      <span className="text-zinc-300 flex-1">{labels[c.id as CriterionId]}</span>
      <span className={cn('tabular-nums', c.met ? 'text-emerald-300' : 'text-zinc-400')}>
        {fmt.current}
        <span className="text-zinc-600 mx-1">/</span>
        <span className="text-zinc-500">{fmt.target}</span>
      </span>
    </li>
  );
}

function formatCriterion(c: { id: string; current: number; target: number }) {
  switch (c.id) {
    case 'accuracy':
      return { current: `${Math.round(c.current * 100)}%`, target: `${Math.round(c.target * 100)}%` };
    case 'speed':
      return { current: `${(c.current / 1000).toFixed(1)}s`, target: `${(c.target / 1000).toFixed(0)}s` };
    case 'peak':
      return { current: `+${c.current}`, target: `+${c.target}` };
    default:
      return { current: String(c.current), target: String(c.target) };
  }
}

function Stat({ label, v }: { label: string; v: string | number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="text-2xl font-semibold mt-1">{v}</div>
    </div>
  );
}

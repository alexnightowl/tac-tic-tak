'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess, Square } from 'chess.js';
import { X, Check, XCircle, Loader2, Crown, Sparkles } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore, ANIMATION_MS } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Chessboard } from '@/components/board/Chessboard';
import { Button } from '@/components/ui/button';
import { ServerPuzzle, initPuzzle, uciFromMove } from '@/lib/puzzle';
import { playSound } from '@/lib/sound';
import { fmtDuration, cn } from '@/lib/utils';
import { BoardTheme } from '@/lib/themes';
import {
  computeUnlockProgress, CriterionProgress, CriterionId, UNLOCK_REWARD,
  TrainingStyle, DEFAULT_STYLE, isTrainingStyle,
} from '@/lib/levels';

type NextResponse = {
  puzzle: ServerPuzzle;
  currentRating: number;
  session: { id: string; startedAt: string; durationSec: number; style?: string; mode?: 'mixed' | 'theme' };
};
type FinishResponse = {
  sessionId: string; solved: number; failed: number; accuracy: number;
  avgResponseMs: number; peakRating: number; durationSec?: number;
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
};

export default function PlayRunner() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const progressions = useAppStore((s) => s.progressions);
  const patchStyleProgression = useAppStore((s) => s.patchStyleProgression);
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
  const attemptStart = useRef<number>(Date.now());
  const loading = useRef(false);
  const finishing = useRef(false);

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
    if (endsAt && now >= endsAt && !finishing.current) finish();
  }, [now, endsAt]);

  useEffect(() => {
    (async () => {
      try {
        const r = await http.post<NextResponse>(`/sessions/${sessionId}/next`);
        setDurationSec(r.session.durationSec);
        // Use the client's clock as the anchor so no seconds are lost to
        // network round-trips.
        setEndsAt(Date.now() + r.session.durationSec * 1000);
        // First /next returns currentRating == session.startRating (no attempts yet).
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
      } catch (e: any) {
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
    try {
      const r = await http.post<{ newRating: number }>(`/sessions/${sessionId}/attempt`, {
        puzzleId: puzzle.id, correct, responseMs,
      });
      patchStyleProgression(sessionStyle, { currentPuzzleRating: r.newRating });
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
    } catch (e: any) {
      await finish();
    } finally {
      loading.current = false;
    }
  }

  async function finish(opts: { save?: boolean } = {}) {
    if (finishing.current) return;
    finishing.current = true;
    const save = opts.save !== false;
    try {
      const r = await http.post<FinishResponse & { discarded?: boolean }>(
        `/sessions/${sessionId}/finish${save ? '' : '?save=false'}`,
      );
      if ((r as any).discarded) {
        router.replace('/dashboard');
        return;
      }
      setSummary(r);
    } catch {
      setSummary({ sessionId, solved: 0, failed: 0, accuracy: 0, avgResponseMs: 0, peakRating: 0 });
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

  const remainingSec = endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0;
  const warnThreshold = Math.min(30, Math.max(10, Math.round(durationSec * 0.1)));
  const warning = !loadingFirst && remainingSec <= warnThreshold && remainingSec > 0;
  const isPlayerTurn = !!chess && ((orientation === 'white' && chess.turn() === 'w') || (orientation === 'black' && chess.turn() === 'b'));
  const styleProg = progressions[sessionStyle];
  const currentRating = styleProg?.currentPuzzleRating ?? null;
  const unlockCeiling = styleProg?.unlockedStartRating ?? null;

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

  const timerPill = (
    <div className={cn(
      'font-mono text-xl tabular-nums px-4 py-1.5 rounded-full border transition-colors text-center',
      warning
        ? 'bg-red-500/15 border-red-400/60 text-red-300 pulse-red'
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
    />
  );

  // Theme sessions are unrated practice — no unlock target to show.
  const progressBar = sessionMode !== 'theme' && unlockProgress && unlockCeiling != null ? (
    <UnlockProgressBar
      progress={unlockProgress}
      unlockedTo={unlockCeiling}
    />
  ) : null;

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
    <div className="relative w-full">
      {chess && (
        <Chessboard
          fen={chess.fen()}
          orientation={orientation}
          onMove={handleMove}
          lastMove={lastMove}
          animateMove={animateMove}
          animationMs={ANIMATION_MS[settings.animationSpeed]}
          allowMoves={!animateMove && !loadingFirst}
          theme={settings.boardTheme as BoardTheme}
          pieceSet={settings.pieceSet}
        />
      )}
      {loadingFirst && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="glass rounded-full h-14 w-14 flex items-center justify-center shadow-lg">
            <Loader2 size={28} className="text-[var(--accent)] animate-spin" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden px-2 pb-3 md:px-6 md:pb-6"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
    >
      {/* Mobile: stacked. Header → TurnCard → Progress → Board → Stats. */}
      <div className="md:hidden flex flex-col items-center flex-1 min-h-0 w-full gap-2">
        <div className="w-full max-w-[min(94vh,640px)] flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            {exitButton}
            {timerPill}
            <div className="w-[72px]" />
          </div>
          {turnCard}
          {progressBar}
        </div>

        <div className="flex-1 w-full max-w-[min(94vh,640px)] flex items-center justify-center min-h-0">
          {boardBlock}
        </div>

        <div className="w-full max-w-[min(94vh,640px)]">
          {statsRow}
        </div>
      </div>

      {/* Desktop: board on the left, meta sidebar on the right. */}
      <div className="hidden md:flex flex-1 items-center justify-center min-h-0">
        <div className="flex gap-6 w-full max-w-[1200px] items-stretch h-full py-2">
          <div className="flex-1 flex items-center justify-center min-w-0 min-h-0">
            <div
              className="w-full"
              style={{ maxWidth: 'min(calc(100vh - 64px), 720px)' }}
            >
              {boardBlock}
            </div>
          </div>

          <aside className="w-[320px] shrink-0 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              {exitButton}
              {timerPill}
            </div>
            {turnCard}
            {progressBar}
            {statsRow}
          </aside>
        </div>
      </div>

      {confirmExit && (
        <ExitDialog
          onSave={() => { setConfirmExit(false); finish({ save: true }); }}
          onDiscard={() => { setConfirmExit(false); finish({ save: false }); }}
          onCancel={() => setConfirmExit(false)}
          language={settings.language}
        />
      )}
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
            ? 'Ви вийшли достроково. Зберегти результат у статистику чи відкинути його?'
            : 'Leaving early. Save this session to your stats, or discard it?'}
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <button onClick={onSave} className="h-11 rounded-xl bg-[var(--accent)] text-black font-semibold text-sm">
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

function TurnCard({
  orientation, isPlayerTurn, loading, opponentBusy,
}: { orientation: 'white' | 'black'; isPlayerTurn: boolean; loading: boolean; opponentBusy: boolean }) {
  const t = useT();
  const isWhite = orientation === 'white';

  let title: string;
  let subtitle: string | null;
  if (loading) {
    title = t('play.loading_puzzle');
    subtitle = null;
  } else if (opponentBusy || !isPlayerTurn) {
    title = t('play.opponent_moving');
    subtitle = null;
  } else {
    title = t('play.your_turn');
    subtitle = isWhite ? t('play.find_best_white') : t('play.find_best_black');
  }

  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
      <div
        className={cn(
          'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border',
          isWhite
            ? 'bg-white text-zinc-900 border-white/70'
            : 'bg-zinc-900 text-zinc-100 border-zinc-700',
        )}
        aria-hidden
      >
        <Crown size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold leading-tight truncate">{title}</div>
        {subtitle && (
          <div className="text-xs text-zinc-400 mt-0.5 truncate">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

function SessionSummary({ s }: { s: FinishResponse }) {
  const t = useT();
  return (
    <div className="max-w-md mx-auto mt-10 space-y-4 px-4">
      <h1 className="text-2xl font-semibold text-center">{t('play.session_complete')}</h1>

      {s.unlockCheck && <UnlockOutcome check={s.unlockCheck} unlocked={!!s.unlocked} />}

      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('play.solved')} v={s.solved} />
        <Stat label={t('play.failed')} v={s.failed} />
        <Stat label={t('play.accuracy')} v={`${Math.round(s.accuracy * 100)}%`} />
        <Stat label={t('play.avg')} v={`${(s.avgResponseMs / 1000).toFixed(1)}s`} />
        <Stat label={t('play.peak')} v={s.peakRating} />
      </div>
      <div className="flex gap-2">
        <a href="/dashboard" className="flex-1"><Button variant="outline" className="w-full">Home</Button></a>
        <a href="/play" className="flex-1"><Button className="w-full">{t('play.play_again')}</Button></a>
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

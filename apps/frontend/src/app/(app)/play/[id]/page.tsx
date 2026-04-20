'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess, Square } from 'chess.js';
import { X, Check, XCircle, Loader2 } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore, ANIMATION_MS } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Chessboard } from '@/components/board/Chessboard';
import { Button } from '@/components/ui/button';
import { ServerPuzzle, initPuzzle, uciFromMove } from '@/lib/puzzle';
import { playSound } from '@/lib/sound';
import { fmtDuration, cn } from '@/lib/utils';
import { BoardTheme } from '@/lib/themes';

type NextResponse = {
  puzzle: ServerPuzzle;
  currentRating: number;
  session: { id: string; startedAt: string; durationSec: number };
};
type FinishResponse = {
  sessionId: string; solved: number; failed: number; accuracy: number;
  avgResponseMs: number; peakRating: number; unlocked?: boolean;
};

export default function PlayRunner() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const setProgression = useAppStore((s) => s.setProgression);
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
    setProgression((prev) => prev ? { ...prev, currentPuzzleRating: currentRating } : prev);

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
    if (correct) setSolvedCount((c) => c + 1); else setFailedCount((c) => c + 1);
    if (settings.soundEnabled) playSound(settings.soundPack, correct ? 'correct' : 'fail');
    try {
      const r = await http.post<{ newRating: number }>(`/sessions/${sessionId}/attempt`, {
        puzzleId: puzzle.id, correct, responseMs,
      });
      setProgression((prev) => prev ? { ...prev, currentPuzzleRating: r.newRating } : prev);
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

  if (summary) return <SessionSummary s={summary} />;

  const remainingSec = endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : 0;
  const warnThreshold = Math.min(30, Math.max(10, Math.round(durationSec * 0.1)));
  const warning = !loadingFirst && remainingSec <= warnThreshold && remainingSec > 0;
  const turn = chess?.turn() === 'w' ? 'White' : 'Black';
  const isPlayerTurn = chess && ((orientation === 'white' && chess.turn() === 'w') || (orientation === 'black' && chess.turn() === 'b'));

  return (
    <div className="min-h-dvh flex flex-col items-center justify-between gap-2 pt-3 pb-4 px-2"
         style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
      {/* Top header */}
      <div className="w-full max-w-[min(94vh,640px)] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={requestExit}
            className="!px-3"
            aria-label={t('play.exit')}
          >
            <X size={18} /> {t('play.exit')}
          </Button>

          <div className={cn(
            'font-mono text-xl tabular-nums px-4 py-1.5 rounded-full border transition-colors',
            warning
              ? 'bg-red-500/15 border-red-400/60 text-red-300 pulse-red'
              : 'glass text-white',
          )}>
            {loadingFirst ? '--:--' : fmtDuration(remainingSec)}
          </div>

          <div className="w-[72px]" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatPill icon={<Check size={14} />} value={solvedCount} tone="good" />
          <TurnPill turn={turn} you={!!isPlayerTurn} />
          <StatPill icon={<XCircle size={14} />} value={failedCount} tone="bad" align="right" />
        </div>
      </div>

      {/* Board */}
      <div className="relative w-full max-w-[min(94vh,640px)]">
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

      <div className="h-2" />

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

function TurnPill({ turn, you }: { turn: string; you: boolean }) {
  return (
    <div className="glass rounded-xl py-2 px-3 text-[12px] flex items-center justify-center gap-2">
      <span className={cn('inline-block h-2.5 w-2.5 rounded-full', turn === 'White' ? 'bg-white' : 'bg-zinc-900 border border-zinc-500')} />
      <span className="text-zinc-300">{turn}</span>
      {you && <span className="text-[var(--accent)] font-semibold">· you</span>}
    </div>
  );
}

function SessionSummary({ s }: { s: FinishResponse }) {
  const t = useT();
  return (
    <div className="max-w-md mx-auto mt-10 space-y-4 px-4">
      <h1 className="text-2xl font-semibold text-center">{t('play.session_complete')}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={t('play.solved')} v={s.solved} />
        <Stat label={t('play.failed')} v={s.failed} />
        <Stat label={t('play.accuracy')} v={`${Math.round(s.accuracy * 100)}%`} />
        <Stat label={t('play.avg')} v={`${Math.round(s.avgResponseMs)}ms`} />
        <Stat label={t('play.peak')} v={s.peakRating} />
        {s.unlocked && <Stat label={t('play.unlocked_reward')} v="+50" />}
      </div>
      <div className="flex gap-2">
        <a href="/dashboard" className="flex-1"><Button variant="outline" className="w-full">Home</Button></a>
        <a href="/play" className="flex-1"><Button className="w-full">{t('play.play_again')}</Button></a>
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string | number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="text-2xl font-semibold mt-1">{v}</div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Chess, Square } from 'chess.js';
import { ChevronLeft, ChevronRight, Lightbulb, Check, Eye, RotateCcw, Loader2 } from 'lucide-react';
import { http } from '@/lib/api';
import { Chessboard } from '@/components/board/Chessboard';
import { TurnCard } from '@/components/board/TurnCard';
import { Button } from '@/components/ui/button';
import { ServerPuzzle, initPuzzle, uciFromMove } from '@/lib/puzzle';
import { playSound, sfx, moveSoundEvent } from '@/lib/sound';
import { useAppStore, ANIMATION_MS } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { BoardTheme } from '@/lib/themes';
import { themeLabel, isMetaTheme } from '@/lib/theme-labels';

type Move = { from: Square; to: Square; promotion?: string };

function parseUci(uci: string): Move {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? uci.slice(4) : undefined,
  };
}

/**
 * Read-only view of a puzzle the player has already attempted, opened
 * from a session's attempt list. Two modes: solve it again (practice —
 * nothing is sent to the server, rating is untouched) or step through
 * the solution line move by move.
 */
export default function PuzzleView() {
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const settingsReady = useAppStore((s) => s.settingsReady);
  const t = useT();

  const { data: puzzle, isError } = useQuery({
    queryKey: ['puzzle', puzzleId],
    queryFn: () => http.get<ServerPuzzle>(`/puzzles/${puzzleId}`),
    staleTime: Infinity,
  });

  const [mode, setMode] = useState<'solve' | 'solution'>('solve');
  const [chess, setChess] = useState<Chess | null>(null);
  const [remaining, setRemaining] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [animateMove, setAnimateMove] = useState<{ from: Square; to: Square } | null>(null);
  const [opponentBusy, setOpponentBusy] = useState(false);
  const [feedbackSquare, setFeedbackSquare] = useState<{ square: Square; correct: boolean; id: number } | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [solved, setSolved] = useState(false);
  // Solution mode: number of moves of the full line (setup move
  // included) applied to the starting FEN.
  const [ply, setPly] = useState(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const animMs = ANIMATION_MS[settings.animationSpeed];

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }
  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }
  useEffect(() => clearTimers, []);

  // Same lock as the other board runners so iOS PWA doesn't push the
  // bottom controls under the home indicator.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('play-locked');
    document.body.classList.add('play-locked');
    return () => {
      html.classList.remove('play-locked');
      document.body.classList.remove('play-locked');
    };
  }, []);

  // Positions along the full solution line: fens[k] = after k moves.
  const fens = useMemo(() => {
    if (!puzzle) return [];
    const c = new Chess(puzzle.fen);
    const out = [c.fen()];
    for (const uci of puzzle.moves) {
      c.move(parseUci(uci));
      out.push(c.fen());
    }
    return out;
  }, [puzzle]);

  function startSolve(p: ServerPuzzle) {
    clearTimers();
    const init = initPuzzle(p);
    setMode('solve');
    setChess(new Chess(init.preFen));
    setRemaining(init.remaining);
    setOrientation(init.playerColor === 'w' ? 'white' : 'black');
    setLastMove(null);
    setOpponentBusy(false);
    setSolved(false);
    setHintLevel(0);
    setFeedbackSquare(null);
    if (!init.setupMove) return;
    const mv = init.setupMove;
    setAnimateMove({ from: mv.from, to: mv.to });
    if (settings.soundEnabled) playSound(settings.soundPack, 'move');
    const swap = () => {
      setChess(new Chess(init.postFen));
      setLastMove({ from: mv.from, to: mv.to });
      setAnimateMove(null);
    };
    if (animMs === 0) swap();
    else later(swap, animMs + 20);
  }

  useEffect(() => {
    if (puzzle) startSolve(puzzle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle]);

  // Jump the solution view to `target` moves into the line. A single
  // step forward slides the piece; anything else snaps.
  function goToPly(target: number) {
    if (!puzzle) return;
    const clamped = Math.max(1, Math.min(puzzle.moves.length, target));
    clearTimers();
    const mv = parseUci(puzzle.moves[clamped - 1]);
    const forwardStep = clamped === ply + 1;
    const land = () => {
      setChess(new Chess(fens[clamped]));
      setLastMove({ from: mv.from, to: mv.to });
      setAnimateMove(null);
    };
    setPly(clamped);
    if (forwardStep) {
      const pre = new Chess(fens[clamped - 1]);
      const played = pre.move(mv);
      if (settings.soundEnabled) sfx(moveSoundEvent(played));
      if (animMs > 0) {
        setChess(new Chess(fens[clamped - 1]));
        setAnimateMove({ from: mv.from, to: mv.to });
        later(land, animMs + 20);
        return;
      }
    }
    land();
  }

  function showSolution() {
    if (!puzzle) return;
    clearTimers();
    setMode('solution');
    setSolved(false);
    setHintLevel(0);
    setOpponentBusy(false);
    setFeedbackSquare(null);
    setPly(1);
    const setup = parseUci(puzzle.moves[0]);
    setChess(new Chess(fens[1]));
    setLastMove({ from: setup.from, to: setup.to });
    setAnimateMove(null);
  }

  // Arrow keys step through the solution.
  useEffect(() => {
    if (mode !== 'solution') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goToPly(ply + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goToPly(ply - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ply, fens]);

  function handleHint() {
    if (!chess || solved || !remaining[0]) return;
    setHintLevel((lvl) => (lvl >= 2 ? 2 : ((lvl + 1) as 0 | 1 | 2)));
  }

  const expectedMove = mode === 'solve' ? remaining[0] : undefined;
  const hintSquare: Square | null =
    hintLevel >= 1 && expectedMove ? (expectedMove.slice(0, 2) as Square) : null;
  const hintTargetSquare: Square | null =
    hintLevel >= 2 && expectedMove ? (expectedMove.slice(2, 4) as Square) : null;

  function handleMove(m: Move) {
    if (!chess || !puzzle || mode !== 'solve' || opponentBusy) return false;
    const expected = remaining[0];
    if (!expected) return false;
    const legal = chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    if (!legal) return false;

    setLastMove({ from: m.from, to: m.to });
    const uci = uciFromMove(m);
    const isWinning = uci === expected && remaining.length === 1;
    if (settings.soundEnabled && !isWinning) sfx(moveSoundEvent(legal));

    if (uci !== expected) {
      setFeedbackSquare({ square: m.to, correct: false, id: Date.now() });
      if (settings.soundEnabled) playSound(settings.soundPack, 'fail');
      setChess(new Chess(chess.fen()));
      later(() => startSolve(puzzle), 520);
      return true;
    }

    setHintLevel(0);
    const after = remaining.slice(1);
    if (after.length === 0) {
      setChess(new Chess(chess.fen()));
      setSolved(true);
      setFeedbackSquare({ square: m.to, correct: true, id: Date.now() });
      later(() => setFeedbackSquare(null), 500);
      if (settings.soundEnabled) playSound(settings.soundPack, 'correct');
      return true;
    }

    const op = parseUci(after[0]);
    setOpponentBusy(true);
    later(() => {
      const mv = chess.move(op);
      setChess(new Chess(chess.fen()));
      setLastMove({ from: op.from, to: op.to });
      if (settings.soundEnabled) sfx(moveSoundEvent(mv));
      setRemaining(after.slice(1));
      setOpponentBusy(false);
    }, Math.max(animMs, 80));
    setChess(new Chess(chess.fen()));
    return true;
  }

  if (isError) {
    return (
      <div className="max-w-md mx-auto mt-10 space-y-4 px-4 text-center">
        <h1 className="text-xl font-semibold">{t('puzzle.not_found')}</h1>
        <Button variant="outline" onClick={() => router.back()}>{t('review.back')}</Button>
      </div>
    );
  }

  if (!puzzle) {
    return <div className="p-8 flex items-center justify-center text-zinc-500"><Loader2 className="animate-spin" /></div>;
  }

  const themesLine = puzzle.themes
    .filter((s) => !isMetaTheme(s))
    .slice(0, 3)
    .map((s) => themeLabel(s, settings.language as 'en' | 'uk'))
    .join(', ');

  const headerRow = (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ChevronLeft size={16} /> {t('review.back')}
      </Button>
      <a
        href={`https://lichess.org/training/${puzzle.id}`}
        target="_blank"
        rel="noreferrer"
        className="text-sm tabular-nums text-zinc-400 hover:text-zinc-200 shrink-0"
      >
        {puzzle.rating} · Lichess ↗
      </a>
    </div>
  );

  const infoSlot = (
    <div className="-mt-1 px-1 min-h-[18px] flex items-center">
      {mode === 'solve' && feedbackSquare && !feedbackSquare.correct ? (
        <span className="text-xs text-eos-rose">{t('review.retry')}</span>
      ) : mode === 'solve' ? (
        <span className="text-xs text-zinc-500 truncate">
          {t('puzzle.practice_note')}{themesLine ? ` · ${themesLine}` : ''}
        </span>
      ) : (
        <span className="text-xs text-zinc-500 truncate">{themesLine}</span>
      )}
    </div>
  );

  const turnCardBlock = (
    <TurnCard
      orientation={orientation}
      loading={!chess}
      opponentBusy={!!animateMove || opponentBusy}
      override={
        mode === 'solution'
          ? {
            title: t('puzzle.show_solution'),
            subtitle: t('puzzle.solution_step')
              .replace('{n}', String(ply - 1))
              .replace('{total}', String(puzzle.moves.length - 1)),
          }
          : solved ? { title: t('review.solved') } : undefined
      }
      isPlayerTurn={
        mode === 'solve' && !!chess && !solved &&
        ((orientation === 'white' && chess.turn() === 'w') ||
          (orientation === 'black' && chess.turn() === 'b'))
      }
    />
  );

  const secondaryBtn = 'h-12 rounded-xl border border-[var(--border)] text-sm font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed';

  const solutionMoves = puzzle.moves.length - 1;
  const controls = mode === 'solution' ? (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button type="button" className={`${secondaryBtn} flex-1`} onClick={() => goToPly(ply - 1)} disabled={ply <= 1} aria-label="Previous move">
          <ChevronLeft size={18} />
        </button>
        <div className="h-12 px-3 flex items-center justify-center text-sm tabular-nums text-zinc-400">
          {ply - 1} / {solutionMoves}
        </div>
        <button type="button" className={`${secondaryBtn} flex-1`} onClick={() => goToPly(ply + 1)} disabled={ply >= puzzle.moves.length} aria-label="Next move">
          <ChevronRight size={18} />
        </button>
      </div>
      <button type="button" className={`${secondaryBtn} w-full`} onClick={() => startSolve(puzzle)}>
        <RotateCcw size={16} /> {t('puzzle.try_again')}
      </button>
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      {solved ? (
        <div role="status" className="h-12 w-full rounded-xl bg-[rgba(175,192,169,0.15)] text-eos-sage text-sm font-semibold flex items-center justify-center gap-2 review-solved-pop">
          <Check size={16} /> {t('review.solved')}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleHint}
          disabled={!chess || hintLevel >= 2 || opponentBusy}
          className="h-12 w-full rounded-xl bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 active:bg-amber-500/30 transition-colors text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Lightbulb size={16} /> {t('review.hint')}
        </button>
      )}
      <div className="flex gap-2">
        {solved && (
          <button type="button" className={`${secondaryBtn} flex-1`} onClick={() => startSolve(puzzle)}>
            <RotateCcw size={16} /> {t('puzzle.try_again')}
          </button>
        )}
        <button type="button" className={`${secondaryBtn} flex-1`} onClick={showSolution}>
          <Eye size={16} /> {t('puzzle.show_solution')}
        </button>
      </div>
    </div>
  );

  const boardBlock = (
    <div className="relative w-full aspect-square">
      {chess && settingsReady && (
        <Chessboard
          fen={chess.fen()}
          orientation={settings.mirrorView ? (orientation === 'white' ? 'black' : 'white') : orientation}
          onMove={handleMove}
          lastMove={lastMove}
          animateMove={animateMove}
          animationMs={animMs}
          allowMoves={mode === 'solve' && !animateMove && !opponentBusy && !solved}
          theme={settings.boardTheme as BoardTheme}
          pieceSet={settings.pieceSet}
          hintSquare={hintSquare}
          hintTargetSquare={hintTargetSquare}
          feedbackSquare={feedbackSquare}
        />
      )}
    </div>
  );

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden px-2 lg:px-6"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Same frame as the review runners: stacked on phone, board left
          + 320px panel on desktop. */}
      <div className="flex flex-col lg:flex-row items-stretch flex-1 min-h-0 w-full gap-2 lg:gap-6 lg:max-w-screen-2xl lg:mx-auto">
        <div className="board-top-slot lg:hidden w-full mx-auto max-w-[min(calc(100vh-240px),880px)] flex flex-col gap-2.5">
          {headerRow}
          {infoSlot}
          {turnCardBlock}
        </div>

        <div
          className="flex-1 grid justify-items-center items-start lg:items-center min-h-0 min-w-0 w-full"
          style={{ containerType: 'size' }}
        >
          <div className="aspect-square" style={{ width: 'min(100cqw, 100cqh)' }}>
            {boardBlock}
          </div>
        </div>

        <div className="lg:hidden w-full mx-auto max-w-[min(calc(100vh-240px),880px)] pt-2">
          {controls}
        </div>

        <aside className="hidden lg:flex w-[320px] shrink-0 self-center flex-col gap-3 max-h-full overflow-y-auto py-2">
          {headerRow}
          {infoSlot}
          {turnCardBlock}
          {controls}
        </aside>
      </div>
    </div>
  );
}

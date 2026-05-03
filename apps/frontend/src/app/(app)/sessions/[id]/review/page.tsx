'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess, Square } from 'chess.js';
import { X, Check, XCircle, Loader2, ArrowLeft, Lightbulb } from 'lucide-react';
import { http } from '@/lib/api';
import { useAppStore, ANIMATION_MS } from '@/lib/store';
import { useT, useTn } from '@/lib/i18n';
import { Chessboard } from '@/components/board/Chessboard';
import { TurnCard } from '@/components/board/TurnCard';
import { ServerPuzzle, initPuzzle, uciFromMove } from '@/lib/puzzle';
import { playSound } from '@/lib/sound';
import { BoardTheme } from '@/lib/themes';
import { cn } from '@/lib/utils';

type ReviewItem = {
  puzzleId: string;
  reason: 'failed' | 'slow';
  responseMs: number;
  rating: number;
  fen: string;
  moves: string;   // space-joined UCI list
  themes: string[];
};

type ReviewResponse = { items: ReviewItem[] };

// Convert the raw server item into the `ServerPuzzle` shape the existing
// initPuzzle / board logic expects (moves as array).
function toServerPuzzle(it: ReviewItem): ServerPuzzle {
  return {
    id: it.puzzleId,
    fen: it.fen,
    moves: it.moves.split(' ').filter(Boolean),
    rating: it.rating,
    themes: it.themes,
    gameUrl: null,
  };
}

export default function SessionReview() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const settingsReady = useAppStore((s) => s.settingsReady);
  const t = useT();
  const tn = useTn();

  // Review queue: FIFO list of items. Head = current puzzle. On fail the
  // head is rotated to the tail; on solve it's removed. Empty = done.
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [failedTries, setFailedTries] = useState(0);

  // Per-puzzle playback state.
  const [chess, setChess] = useState<Chess | null>(null);
  const [remaining, setRemaining] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [animateMove, setAnimateMove] = useState<{ from: Square; to: Square } | null>(null);
  const [opponentBusy, setOpponentBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; id: number } | null>(null);
  const [hintSquare, setHintSquare] = useState<Square | null>(null);
  const currentPuzzle = useRef<ServerPuzzle | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await http.get<ReviewResponse>(`/sessions/${sessionId}/review-items`);
        setQueue(r.items);
        setTotalCount(r.items.length);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  // Loads the queue head onto the board. Used both on queue change
  // (head puzzle ID changes ⇒ new puzzle) and on retry (same puzzle,
  // reset state after a wrong move).
  const loadHead = useCallback((head: ReviewItem | undefined) => {
    if (!head) {
      currentPuzzle.current = null;
      setChess(null);
      return;
    }
    const puzzle = toServerPuzzle(head);
    currentPuzzle.current = puzzle;
    const init = initPuzzle(puzzle);
    setChess(new Chess(init.preFen));
    setRemaining(init.remaining);
    let side: 'white' | 'black' = init.playerColor === 'w' ? 'white' : 'black';
    if (settings.fixedColor === 'white') side = 'white';
    else if (settings.fixedColor === 'black') side = 'black';
    setOrientation(side);
    setLastMove(null);
    setHintSquare(null);
    setAnimateMove(init.setupMove ? { from: init.setupMove.from, to: init.setupMove.to } : null);

    const animMs = ANIMATION_MS[settings.animationSpeed];
    if (init.setupMove) {
      const mv = init.setupMove;
      if (settings.soundEnabled) playSound(settings.soundPack, 'move');
      const swap = () => {
        const post = new Chess(init.preFen);
        post.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
        setChess(post);
        setLastMove({ from: mv.from, to: mv.to });
        setAnimateMove(null);
      };
      if (animMs === 0) swap();
      else setTimeout(swap, animMs + 20);
    }
  }, [settings.animationSpeed, settings.fixedColor, settings.soundEnabled, settings.soundPack]);

  useEffect(() => {
    loadHead(queue[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue[0]?.puzzleId]);

  function onSolved() {
    if (settings.soundEnabled) playSound(settings.soundPack, 'correct');
    setFeedback({ correct: true, id: Date.now() });
    setTimeout(() => setFeedback(null), 500);
    setSolvedCount((c) => c + 1);
    setTimeout(() => setQueue((q) => q.slice(1)), 280);
  }

  function onFailed() {
    if (settings.soundEnabled) playSound(settings.soundPack, 'fail');
    setFeedback({ correct: false, id: Date.now() });
    setTimeout(() => setFeedback(null), 500);
    setFailedTries((c) => c + 1);
    // Reset the SAME puzzle instead of rotating the queue — the user
    // has to actually solve each one before we move on, matching the
    // /review/[puzzleId] flow. Wait out the wrong-move flash first
    // so the board doesn't snap back mid-animation.
    setTimeout(() => loadHead(queue[0]), 520);
  }

  function handleHint() {
    if (!chess || opponentBusy || animateMove || hintSquare) return;
    const expected = remaining[0];
    if (!expected) return;
    // Highlight the source square of the next expected move and leave
    // it on. The user still has to play that move themselves to clear
    // the puzzle — the hint just shows which piece to look at.
    setHintSquare(expected.slice(0, 2) as Square);
  }

  function handleMove(m: { from: Square; to: Square; promotion?: string }) {
    if (!chess || opponentBusy) return false;
    const expected = remaining[0];
    if (!expected) return false;
    const legal = chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    if (!legal) return false;

    setLastMove({ from: m.from, to: m.to });
    if (settings.soundEnabled) playSound(settings.soundPack, legal.captured ? 'capture' : 'move');

    if (uciFromMove(m) !== expected) {
      setChess(new Chess(chess.fen()));
      onFailed();
      return true;
    }

    // Correct move played — the hint (if shown) was for this move and
    // is now stale; clear it so it doesn't leak into the next prompt
    // of a multi-move puzzle.
    setHintSquare(null);

    const afterExpected = remaining.slice(1);
    if (afterExpected.length === 0) {
      setChess(new Chess(chess.fen()));
      onSolved();
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

  const progressLabel = useMemo(() => {
    if (totalCount === 0) return '';
    return `${solvedCount} / ${totalCount}`;
  }, [solvedCount, totalCount]);

  if (loading) {
    return <div className="p-8 flex items-center justify-center text-zinc-500"><Loader2 className="animate-spin" /></div>;
  }

  if (totalCount === 0) {
    return (
      <div className="max-w-md mx-auto mt-10 space-y-4 px-4 text-center">
        <h1 className="text-2xl font-semibold">{t('review.nothing_title')}</h1>
        <p className="text-sm text-zinc-400">{t('review.nothing_hint')}</p>
        <button
          onClick={() => router.back()}
          className="h-11 px-6 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold"
        >
          {t('review.back')}
        </button>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-10 space-y-4 px-4 text-center">
        <h1 className="text-2xl font-semibold">{t('review.done_title')}</h1>
        <p className="text-sm text-zinc-400">
          {t('review.done_hint')
            .replace('{n}', String(totalCount))
            .replace('{noun}', tn('review.puzzle_word', totalCount))}
        </p>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => router.push(`/sessions/${sessionId}`)}
            className="flex-1 h-11 rounded-xl border border-[var(--border)] text-sm font-semibold"
          >
            {t('review.back_to_session')}
          </button>
          <button
            onClick={() => router.push('/play')}
            className="flex-1 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-sm font-semibold"
          >
            {t('review.new_session')}
          </button>
        </div>
      </div>
    );
  }

  const head = queue[0];

  return (
    <div className="flex flex-col items-center gap-3 pb-4">
      <div className="w-full max-w-[min(calc(100vh-240px),880px)] flex items-center justify-between gap-2">
        <button
          onClick={() => router.back()}
          className="glass rounded-xl py-2 px-3 flex items-center gap-1.5 text-sm"
          aria-label={t('review.back')}
        >
          <ArrowLeft size={16} /> {t('review.back')}
        </button>
        <div className="glass rounded-xl py-2 px-4 text-sm tabular-nums">
          {progressLabel}
        </div>
      </div>

      <div className="w-full max-w-[min(calc(100vh-240px),880px)] glass rounded-2xl px-4 py-3 flex items-center gap-3">
        <div className={cn(
          'h-9 px-2.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5',
          head.reason === 'failed' ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300',
        )}>
          {head.reason === 'failed' ? <XCircle size={14} /> : <Loader2 size={14} />}
          {head.reason === 'failed' ? t('review.reason_failed') : t('review.reason_slow')}
        </div>
        <div className="text-sm text-zinc-400 tabular-nums">{head.rating}</div>
        <button
          type="button"
          onClick={handleHint}
          disabled={!!animateMove || opponentBusy || hintSquare !== null}
          className="ml-auto h-9 px-3 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 active:bg-amber-500/30 transition-colors text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={t('review.hint')}
        >
          <Lightbulb size={14} />
          {t('review.hint')}
        </button>
      </div>

      <div className="w-full max-w-[min(calc(100vh-240px),880px)]">
        <TurnCard
          orientation={orientation}
          loading={!chess}
          opponentBusy={!!animateMove || opponentBusy}
          isPlayerTurn={
            !!chess &&
            ((orientation === 'white' && chess.turn() === 'w') ||
              (orientation === 'black' && chess.turn() === 'b'))
          }
        />
      </div>

      <div className="flex-1 w-full max-w-[min(calc(100vh-240px),880px)] flex items-center justify-center min-h-0">
        <div className="relative w-full aspect-square">
          {chess && settingsReady && (
            <Chessboard
              fen={chess.fen()}
              orientation={orientation}
              onMove={handleMove}
              lastMove={lastMove}
              animateMove={animateMove}
              animationMs={ANIMATION_MS[settings.animationSpeed]}
              allowMoves={!animateMove && !opponentBusy}
              theme={settings.boardTheme as BoardTheme}
              pieceSet={settings.pieceSet}
              hintSquare={hintSquare}
            />
          )}
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
      </div>

      <div className="w-full max-w-[min(calc(100vh-240px),880px)] flex items-center justify-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1"><Check size={12} /> {solvedCount}</span>
        <span className="flex items-center gap-1"><X size={12} /> {failedTries}</span>
        <span className="text-zinc-500">· {queue.length} {t('review.remaining')}</span>
      </div>
    </div>
  );
}

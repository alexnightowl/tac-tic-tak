'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Chess, Square } from 'chess.js';
import { ChevronLeft, Lightbulb } from 'lucide-react';
import { http } from '@/lib/api';
import { Chessboard } from '@/components/board/Chessboard';
import { Button } from '@/components/ui/button';
import { ServerPuzzle, initPuzzle, uciFromMove } from '@/lib/puzzle';
import { playSound } from '@/lib/sound';
import { useAppStore, ANIMATION_MS } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { BoardTheme } from '@/lib/themes';
import { themeLabel, isMetaTheme } from '@/lib/theme-labels';

type ReviewItem = {
  id: string;
  puzzleId: string;
  createdAt: string;
  rating: number;
  fen: string;
  setupMove: string | null;
  themes: string[];
};

export default function ReviewPuzzle() {
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Theme drill — when present the runner only auto-advances within
  // this theme and the "all done" screen leads back to the theme
  // landing page rather than to /play. Absent ⇒ legacy global flow.
  const themeFilter = searchParams?.get('theme') ?? null;
  const settings = useAppStore((s) => s.settings);
  const settingsReady = useAppStore((s) => s.settingsReady);
  const t = useT();

  // Review queue scoped to the current theme (or the full queue when
  // no theme filter). Fetched once and kept in cache. Drives the
  // "next task after this one" auto-advance and the "N of M" counter.
  const listUrl = themeFilter
    ? `/review?theme=${encodeURIComponent(themeFilter)}`
    : '/review';
  const list = useQuery({
    queryKey: ['review-list', themeFilter ?? '__all__'],
    queryFn: () => http.get<ReviewItem[]>(listUrl),
    staleTime: 30_000,
  });

  const [puzzle, setPuzzle] = useState<ServerPuzzle | null>(null);
  const [chess, setChess] = useState<Chess | null>(null);
  const [remaining, setRemaining] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [animateMove, setAnimateMove] = useState<{ from: Square; to: Square } | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; id: number } | null>(null);
  const [hintSquare, setHintSquare] = useState<Square | null>(null);
  const [solved, setSolved] = useState(false);
  const [done, setDone] = useState(false);

  // Queue position relative to the LIST AT THE TIME THIS PUZZLE MOUNTED.
  // We lock it so that when the current puzzle resolves (and the list
  // refetches without it), the counter still advances cleanly instead
  // of snapping.
  const positionRef = useMemo(() => {
    // Intentionally only captured on first render for this puzzleId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return { current: null as { index: number; total: number } | null };
  }, [puzzleId]);
  if (list.data && positionRef.current === null) {
    const idx = list.data.findIndex((i) => i.puzzleId === puzzleId);
    positionRef.current = idx >= 0
      ? { index: idx, total: list.data.length }
      : { index: 0, total: Math.max(list.data.length, 1) };
  }

  useEffect(() => {
    setDone(false);
    setSolved(false);
    (async () => {
      const p = await http.get<ServerPuzzle>(`/review/${puzzleId}`);
      setPuzzle(p);
      startFrom(p);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleId]);

  function startFrom(p: ServerPuzzle) {
    const init = initPuzzle(p);
    setChess(new Chess(init.preFen));
    setRemaining(init.remaining);
    setOrientation(init.playerColor === 'w' ? 'white' : 'black');
    setLastMove(null);
    setAnimateMove(init.setupMove ? { from: init.setupMove.from, to: init.setupMove.to } : null);
    setSolved(false);
    setHintSquare(null);
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
  }

  function reset() {
    if (!puzzle) return;
    startFrom(puzzle);
  }

  async function resolveAndAdvance() {
    // Order matters: mark this one resolved on the server FIRST, then
    // pull a fresh list. Otherwise a cached list that still contains
    // the current puzzle would steer us back to it (endless loop —
    // the symptom we saw: "solved puzzles keep repeating").
    try {
      await http.post(`/review/${puzzleId}/resolve`);
    } catch {
      // Non-fatal: if the resolve roundtrip fails we still try to move
      // on. The user shouldn't get stuck here.
    }
    let fresh: ReviewItem[] = [];
    try {
      fresh = await http.get<ReviewItem[]>(listUrl);
    } catch {
      fresh = [];
    }
    const next = fresh.find((i) => i.puzzleId !== puzzleId);
    if (next) {
      const qs = themeFilter ? `?theme=${encodeURIComponent(themeFilter)}` : '';
      router.replace(`/review/${next.puzzleId}${qs}`);
    } else {
      setDone(true);
    }
  }

  function handleHint() {
    if (!chess || !puzzle || hintSquare || solved) return;
    const expected = remaining[0];
    if (!expected) return;
    // Highlight the source square of the next expected move and leave
    // it on. The user still has to play that move themselves to clear
    // the puzzle — the hint just shows which piece to look at.
    setHintSquare(expected.slice(0, 2) as Square);
  }

  function handleMove(m: { from: Square; to: Square; promotion?: string }) {
    if (!chess || !puzzle) return false;
    const uci = uciFromMove(m);
    const expected = remaining[0];
    if (!expected) return false;
    const legal = chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    if (!legal) return false;

    setLastMove({ from: m.from, to: m.to });
    if (settings.soundEnabled) playSound(settings.soundPack, legal.captured ? 'capture' : 'move');

    if (uci !== expected) {
      setFeedback({ correct: false, id: Date.now() });
      if (settings.soundEnabled) playSound(settings.soundPack, 'fail');
      setTimeout(() => { setFeedback(null); reset(); }, 520);
      return true;
    }

    // Correct move played — the hint (if shown) was for this move and
    // is now stale.
    setHintSquare(null);

    const after = remaining.slice(1);
    if (after.length === 0) {
      setSolved(true);
      setFeedback({ correct: true, id: Date.now() });
      if (settings.soundEnabled) playSound(settings.soundPack, 'correct');
      // Give the correct-ring time to flash, then resolve + refetch +
      // navigate in sequence. See resolveAndAdvance for the ordering
      // rationale.
      setTimeout(() => { void resolveAndAdvance(); }, 650);
      return true;
    }
    const op = after[0];
    const animMs = ANIMATION_MS[settings.animationSpeed];
    setTimeout(() => {
      const mv = chess.move({ from: op.slice(0, 2) as Square, to: op.slice(2, 4) as Square, promotion: op.length > 4 ? op.slice(4) : undefined });
      setChess(new Chess(chess.fen()));
      setLastMove({ from: op.slice(0, 2) as Square, to: op.slice(2, 4) as Square });
      if (settings.soundEnabled) playSound(settings.soundPack, mv?.captured ? 'capture' : 'move');
      setRemaining(after.slice(1));
    }, Math.max(animMs, 80));
    setChess(new Chess(chess.fen()));
    return true;
  }

  const counter = positionRef.current
    ? `${Math.min(positionRef.current.index + 1, positionRef.current.total)} / ${positionRef.current.total}`
    : '';

  if (done) {
    const themeName = themeFilter
      ? themeLabel(themeFilter, settings.language as 'en' | 'uk')
      : null;
    const title = themeFilter ? t('review.theme_done_title') : t('review.done_title');
    const hint = themeFilter
      ? t('review.theme_done_hint')
        .replace('{theme}', themeName ?? '')
        .replace('{n}', String(positionRef.current?.total ?? 0))
      : t('review.done_hint').replace('{n}', String(positionRef.current?.total ?? 0));
    return (
      <div className="max-w-md mx-auto mt-10 space-y-4 px-4 text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-zinc-400">{hint}</p>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => router.push('/review')}>
            {t('review.back_to_themes')}
          </Button>
          <Button className="flex-1" onClick={() => router.push('/play')}>
            {t('review.new_session')}
          </Button>
        </div>
      </div>
    );
  }

  const themesLine = puzzle?.themes
    .filter((s) => !isMetaTheme(s))
    .slice(0, 3)
    .map((s) => themeLabel(s, settings.language as 'en' | 'uk'))
    .join(', ');

  return (
    <div
      className="flex flex-col gap-3 max-w-[min(90vh,640px)] mx-auto"
      style={{
        // Subtract every fixed slice of chrome from 100dvh so the page
        // is sized to the EXACT visible area — otherwise the flex-1
        // board container centers itself in an off-screen overflow and
        // the gap above the board ends up bigger than the gap below.
        //
        //   76px  mobile top nav (pt-3 + 56px logo + pb-2)
        //   32px  AppLayout main py-4 (top + bottom on mobile)
        //   96px  AppLayout outer pb-24 (mobile bottom-nav reserve)
        //   env(safe-area-inset-top)/bottom — body's app-shell padding
        //
        // On desktop md:py-6 swaps in (~16px more) and pb-24 vanishes,
        // so the calc undershoots by ~70px there — acceptable, the
        // worst case is a small empty band below the board on desktop.
        minHeight:
          'calc(100dvh - 204px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      }}
    >
      {/* Row 1: back, counter+rating, hint button. Row 2 is reserved
          for either the themes caption or the inline retry feedback —
          rendered as a single fixed-height slot so the board doesn't
          jump up by ~20px when the message appears. */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/review')}>
          <ChevronLeft size={16} /> {t('review.back')}
        </Button>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 text-sm tabular-nums text-zinc-400">
            {counter && <span>{counter}</span>}
            {counter && puzzle?.rating != null && <span className="text-zinc-600">·</span>}
            {puzzle?.rating != null && <span>{puzzle.rating}</span>}
          </div>
          <button
            type="button"
            onClick={handleHint}
            disabled={!chess || !!hintSquare || solved}
            className="h-8 px-2.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 active:bg-amber-500/30 transition-colors text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t('review.hint')}
          >
            <Lightbulb size={14} />
            {t('review.hint')}
          </button>
        </div>
      </div>
      <div className="-mt-1 px-1 min-h-[18px] flex items-center">
        {feedback && !feedback.correct ? (
          <span className="text-xs text-rose-400">{t('review.retry')}</span>
        ) : themesLine ? (
          <span className="text-xs text-zinc-500 truncate">{themesLine}</span>
        ) : null}
      </div>
      {/* Board grows to fill the remaining vertical space; container
          queries pick the largest square that fits both width AND
          height so we don't leave dead space above or below. */}
      <div
        className="flex-1 grid place-items-center min-h-0 min-w-0"
        style={{ containerType: 'size' }}
      >
        <div
          className="relative aspect-square"
          style={{ width: 'min(100cqw, 100cqh)' }}
        >
          {chess && settingsReady && (
            <Chessboard
              fen={chess.fen()}
              orientation={orientation}
              onMove={handleMove}
              lastMove={lastMove}
              animateMove={animateMove}
              animationMs={ANIMATION_MS[settings.animationSpeed]}
              allowMoves={!animateMove && !solved}
              theme={settings.boardTheme as BoardTheme}
              pieceSet={settings.pieceSet}
              hintSquare={hintSquare}
            />
          )}
          {feedback && (
            <div
              key={feedback.id}
              className={`absolute inset-0 pointer-events-none rounded-xl board-feedback-ring ${
                feedback.correct ? 'is-correct' : 'is-fail'
              }`}
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  );
}

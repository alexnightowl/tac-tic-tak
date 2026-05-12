'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Chess, Square } from 'chess.js';
import { ChevronLeft, Lightbulb, Check, ArrowRight } from 'lucide-react';
import { http } from '@/lib/api';
import { Chessboard } from '@/components/board/Chessboard';
import { TurnCard } from '@/components/board/TurnCard';
import { Button } from '@/components/ui/button';
import { ServerPuzzle, initPuzzle, uciFromMove } from '@/lib/puzzle';
import { playSound } from '@/lib/sound';
import { useAppStore, ANIMATION_MS } from '@/lib/store';
import { useT, useTn } from '@/lib/i18n';
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
  const tn = useTn();

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
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [solved, setSolved] = useState(false);
  const [done, setDone] = useState(false);

  // Session position. The total is captured ONCE per theme drill and
  // never reacts to the queue shrinking (puzzles being resolved) or
  // growing (backend pushing new items mid-session). We also remember
  // the original puzzle order so the X counter advances even when the
  // server-side list mutates underneath us.
  const sessionRef = useRef<{ ids: string[]; total: number; key: string } | null>(null);
  const sessionKey = themeFilter ?? '__all__';
  if (
    list.data &&
    (sessionRef.current === null || sessionRef.current.key !== sessionKey)
  ) {
    const ids = list.data.map((i) => i.puzzleId);
    sessionRef.current = { ids, total: ids.length, key: sessionKey };
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

  // Lock html+body for the runner's lifetime so iOS PWA doesn't push
  // the bottom CTA under the home indicator. Without this the
  // app-shell adds its own safe-area padding on top of our h-dvh
  // height, and the page overflows the visible viewport.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('play-locked');
    document.body.classList.add('play-locked');
    return () => {
      html.classList.remove('play-locked');
      document.body.classList.remove('play-locked');
    };
  }, []);

  // Enter / Space advance to the next puzzle once the current one
  // is solved. Lets a player who just wants to crank through the
  // queue skip reaching for the on-screen Next button. Skipped
  // when auto-advance is enabled — the timer is already moving.
  useEffect(() => {
    if (!solved || settings.reviewAutoAdvance) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void resolveAndAdvance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, settings.reviewAutoAdvance]);

  function startFrom(p: ServerPuzzle) {
    const init = initPuzzle(p);
    setChess(new Chess(init.preFen));
    setRemaining(init.remaining);
    setOrientation(init.playerColor === 'w' ? 'white' : 'black');
    setLastMove(null);
    setAnimateMove(init.setupMove ? { from: init.setupMove.from, to: init.setupMove.to } : null);
    setSolved(false);
    setHintLevel(0);
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
    if (!chess || !puzzle || solved) return;
    if (!remaining[0]) return;
    setHintLevel((lvl) => (lvl >= 2 ? 2 : ((lvl + 1) as 0 | 1 | 2)));
  }

  const expectedMove = remaining[0];
  const hintSquare: Square | null =
    hintLevel >= 1 && expectedMove ? (expectedMove.slice(0, 2) as Square) : null;
  const hintTargetSquare: Square | null =
    hintLevel >= 2 && expectedMove ? (expectedMove.slice(2, 4) as Square) : null;

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
    setHintLevel(0);

    const after = remaining.slice(1);
    if (after.length === 0) {
      setSolved(true);
      setFeedback({ correct: true, id: Date.now() });
      if (settings.soundEnabled) playSound(settings.soundPack, 'correct');
      // settings.reviewAutoAdvance: when true, fall back to the old
      // 650ms auto-advance. When false (the default), the player
      // gets time to study the solved position and drives the
      // advance manually via the Next button or Enter / Space.
      if (settings.reviewAutoAdvance) {
        setTimeout(() => { void resolveAndAdvance(); }, 650);
      }
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

  const counter = (() => {
    const sess = sessionRef.current;
    if (!sess) return '';
    const idx = sess.ids.indexOf(puzzleId);
    // Outside the original session list (backend added a new puzzle
    // mid-drill, we drifted onto it) ⇒ pin to the captured total so
    // the denominator never bumps.
    const position = idx >= 0 ? idx + 1 : sess.total;
    return `${Math.min(position, sess.total)} / ${sess.total}`;
  })();

  if (done) {
    const total = sessionRef.current?.total ?? 0;
    const noun = tn('review.puzzle_word', total);
    const themeName = themeFilter
      ? themeLabel(themeFilter, settings.language as 'en' | 'uk')
      : null;
    const title = themeFilter ? t('review.theme_done_title') : t('review.done_title');
    const hint = themeFilter
      ? t('review.theme_done_hint')
        .replace('{theme}', themeName ?? '')
        .replace('{n}', String(total))
        .replace('{noun}', noun)
      : t('review.done_hint')
        .replace('{n}', String(total))
        .replace('{noun}', noun);
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

  const headerRow = (
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" onClick={() => router.push('/review')}>
        <ChevronLeft size={16} /> {t('review.back')}
      </Button>
      <div className="flex items-center gap-2 text-sm tabular-nums text-zinc-400 shrink-0">
        {counter && <span>{counter}</span>}
        {counter && puzzle?.rating != null && <span className="text-zinc-600">·</span>}
        {puzzle?.rating != null && <span>{puzzle.rating}</span>}
      </div>
    </div>
  );

  // Hint/Next CTA — lives at the bottom on phone (thumb zone) and on
  // the right side panel on desktop. Hint morphs into Next once solved
  // so the slot doesn't bounce around.
  const ctaButton = solved && !settings.reviewAutoAdvance ? (
    <button
      type="button"
      onClick={() => { void resolveAndAdvance(); }}
      autoFocus
      className="h-12 w-full rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] transition-colors text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:opacity-80"
      aria-label={t('review.done_cta')}
    >
      <Check size={16} />
      {t('review.done_cta')}
      <ArrowRight size={16} />
    </button>
  ) : (
    <button
      type="button"
      onClick={handleHint}
      disabled={!chess || hintLevel >= 2 || solved}
      className="h-12 w-full rounded-xl bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 active:bg-amber-500/30 transition-colors text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      aria-label={t('review.hint')}
    >
      <Lightbulb size={16} />
      {t('review.hint')}
    </button>
  );

  // Reserved as a fixed-height slot so the board doesn't jump up
  // by ~20px when the retry message appears.
  const themesSlot = (
    <div className="-mt-1 px-1 min-h-[18px] flex items-center">
      {feedback && !feedback.correct ? (
        <span className="text-xs text-rose-400">{t('review.retry')}</span>
      ) : themesLine ? (
        <span className="text-xs text-zinc-500 truncate">{themesLine}</span>
      ) : null}
    </div>
  );

  const turnCardBlock = (
    <TurnCard
      orientation={orientation}
      loading={!chess}
      opponentBusy={!!animateMove}
      // chess.turn() === user's color ⇒ player's turn. Solved
      // puzzles also flip to "opponent moving" since the board
      // is no longer interactive.
      isPlayerTurn={
        !!chess && !solved &&
        ((orientation === 'white' && chess.turn() === 'w') ||
          (orientation === 'black' && chess.turn() === 'b'))
      }
    />
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
          animationMs={ANIMATION_MS[settings.animationSpeed]}
          allowMoves={!animateMove && !solved}
          theme={settings.boardTheme as BoardTheme}
          pieceSet="maestro"
          hintSquare={hintSquare}
          hintTargetSquare={hintTargetSquare}
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
  );

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden px-2 lg:px-6"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Mirrors the play runner: phone & tablet stacked, desktop (lg+)
          board on the left with a 320px control panel on the right.
          containerType:size on the board column lets the inner element
          render the largest square that fits via cqw/cqh — same trick
          used in the play runner so the board matches session size. */}
      <div className="flex flex-col lg:flex-row items-stretch flex-1 min-h-0 w-full gap-2 lg:gap-6 lg:max-w-screen-2xl lg:mx-auto">
        <div className="lg:hidden w-full mx-auto max-w-[min(calc(100vh-240px),880px)] flex flex-col gap-2.5">
          {headerRow}
          {themesSlot}
          {turnCardBlock}
        </div>

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

        <div className="lg:hidden w-full mx-auto max-w-[min(calc(100vh-240px),880px)] pt-2">
          {ctaButton}
        </div>

        <aside className="hidden lg:flex w-[320px] shrink-0 self-center flex-col gap-3 max-h-full overflow-y-auto py-2">
          {headerRow}
          {themesSlot}
          {turnCardBlock}
          {ctaButton}
        </aside>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess, Square } from 'chess.js';
import { ChevronLeft } from 'lucide-react';
import { http } from '@/lib/api';
import { Chessboard } from '@/components/board/Chessboard';
import { Button } from '@/components/ui/button';
import { ServerPuzzle, initPuzzle, uciFromMove } from '@/lib/puzzle';
import { playSound } from '@/lib/sound';
import { useAppStore, ANIMATION_MS } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { BoardTheme } from '@/lib/themes';
import { themeLabel, isMetaTheme } from '@/lib/theme-labels';

export default function ReviewPuzzle() {
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const settingsReady = useAppStore((s) => s.settingsReady);
  const t = useT();

  const [puzzle, setPuzzle] = useState<ServerPuzzle | null>(null);
  const [chess, setChess] = useState<Chess | null>(null);
  const [remaining, setRemaining] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [animateMove, setAnimateMove] = useState<{ from: Square; to: Square } | null>(null);
  const [feedback, setFeedback] = useState<'wrong' | 'correct' | null>(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await http.get<ServerPuzzle>(`/review/${puzzleId}`);
      setPuzzle(p);
      startFrom(p);
    })();
  }, [puzzleId]);

  function startFrom(p: ServerPuzzle) {
    const init = initPuzzle(p);
    setChess(new Chess(init.preFen));
    setRemaining(init.remaining);
    setOrientation(init.playerColor === 'w' ? 'white' : 'black');
    setLastMove(null);
    setAnimateMove(init.setupMove ? { from: init.setupMove.from, to: init.setupMove.to } : null);
    setSolved(false);
    const animMs = ANIMATION_MS[settings.animationSpeed];
    if (init.setupMove) {
      const mv = init.setupMove;
      if (settings.soundEnabled) playSound(settings.soundPack, 'move');
      if (animMs === 0) {
        setChess(new Chess(init.postFen));
        setLastMove({ from: mv.from, to: mv.to });
        setAnimateMove(null);
      } else {
        setTimeout(() => {
          setChess(new Chess(init.postFen));
          setLastMove({ from: mv.from, to: mv.to });
          setAnimateMove(null);
        }, animMs + 20);
      }
    }
  }

  function reset() {
    if (!puzzle) return;
    startFrom(puzzle);
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
      setFeedback('wrong');
      if (settings.soundEnabled) playSound(settings.soundPack, 'fail');
      setTimeout(() => { setFeedback(null); reset(); }, 500);
      return true;
    }

    const after = remaining.slice(1);
    if (after.length === 0) {
      setSolved(true);
      setFeedback('correct');
      if (settings.soundEnabled) playSound(settings.soundPack, 'correct');
      http.post(`/review/${puzzleId}/resolve`).catch(() => {});
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

  return (
    <div className="max-w-[min(90vh,640px)] mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/review')}>
          <ChevronLeft size={16} /> {t('review.back')}
        </Button>
        <div className="text-sm text-zinc-400">
          {puzzle?.rating} · {puzzle?.themes.filter((s) => !isMetaTheme(s)).slice(0, 3).map((s) => themeLabel(s, settings.language as 'en' | 'uk')).join(', ')}
        </div>
      </div>
      {chess && settingsReady && (
        <Chessboard
          fen={chess.fen()}
          orientation={orientation}
          onMove={handleMove}
          lastMove={lastMove}
          animateMove={animateMove}
          animationMs={ANIMATION_MS[settings.animationSpeed]}
          allowMoves={!animateMove}
          theme={settings.boardTheme as BoardTheme}
          pieceSet={settings.pieceSet}
        />
      )}
      {feedback === 'wrong' && <p className="text-sm text-red-400 text-center">{t('review.retry')}</p>}
      {solved && (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => router.push('/review')}>{t('review.next')}</Button>
          <Button className="flex-1" onClick={reset}>{t('review.replay')}</Button>
        </div>
      )}
    </div>
  );
}

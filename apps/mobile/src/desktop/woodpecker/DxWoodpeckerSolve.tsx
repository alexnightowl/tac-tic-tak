import type { WoodpeckerSet } from '@tac/core/api';
import { alpha, eos, tone } from '@tac/core/tokens';

import { useWoodpeckerSet } from '@/features/woodpecker/api';
import { useWoodpeckerRunner } from '@/features/woodpecker/SolveScreen';
import { useT } from '@/ui/lang';
import { ChapterStage, Missing, SolveFooter, solveHotkeys, solveKeys, stepKeys } from '../board/DxChapterSolve';

// /woodpecker/solve on a desktop window (D40, no artboard): the chapter
// board screen (DXChapterSolve) with the set's runner: the cycle chip with
// done/total, this puzzle's clock against the cycle target, the current
// block's dashes, hint / solution (H, R, Esc).

export function DxWoodpeckerSolve({ setId, cycle, start }: { setId: string; cycle: number; start: number }) {
  const t = useT();
  const q = useWoodpeckerSet(setId);
  if (!q.data) return <Missing loading={q.isPending} text={t('woodpecker.missing')} back={t('woodpecker.back_set')} testID="woodpecker-solve" />;
  return <Runner set={q.data} cycle={cycle} start={start} />;
}

function Runner({ set, cycle, start }: { set: WoodpeckerSet; cycle: number; start: number }) {
  const r = useWoodpeckerRunner(set, cycle, start);
  const { t, controller, s, step } = r;
  return (
    <ChapterStage
      testID="woodpecker-solve"
      board={{ controller, s, onMove: r.onMove, boardRef: r.boardRef }}
      back={{ label: t('woodpecker.back_set'), a11y: t('woodpecker.exit_a11y'), onPress: r.close, testID: 'woodpecker-solve-exit' }}
      chip={{ label: r.chip, color: tone.roseSoft, bg: alpha(eos.ember, 0.18), testID: 'woodpecker-cycle-chip' }}
      tracker={r.tracker}
      target={r.target}
      dashes={{ looks: r.looks, label: r.position, testID: 'woodpecker-segments' }}
      turn={{ side: r.side, title: r.solved ? t('review.solved') : r.goal, solved: r.solved, sub: r.position }}
      note={r.noteText}
      noteTestID="woodpecker-note"
      cards={null}
      footer={<SolveFooter controller={controller} s={s} step={step} prefix="woodpecker" t={t} />}
      keys={step ? stepKeys(t) : solveKeys(t)}
      hotkeys={solveHotkeys(controller, s, !!step, r.close)}
    />
  );
}

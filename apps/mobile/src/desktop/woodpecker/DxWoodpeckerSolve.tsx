import type { WoodpeckerSet } from '@tac/core/api';
import { alpha, eos, tone } from '@tac/core/tokens';

import { useWoodpeckerSet } from '@/features/woodpecker/api';
import { TodayChip, useWoodpeckerRunner } from '@/features/woodpecker/SolveScreen';
import { useT } from '@/ui/lang';
import { ChapterStage, Missing, SolveFooter, solveHotkeys, solveKeys, stepKeys } from '../board/DxChapterSolve';

// /woodpecker/solve on a desktop window (D41, no artboard): the chapter
// board screen (DXChapterSolve) with the set's runner as the book has it:
// the cycle chip, the day's portion where the clock was, the current
// block's dashes, whose move it is, "show solution" only (R, Esc).

export function DxWoodpeckerSolve({ setId, cycle }: { setId: string; cycle: number }) {
  const t = useT();
  const q = useWoodpeckerSet(setId);
  if (!q.data) return <Missing loading={q.isPending} text={t('woodpecker.missing')} back={t('woodpecker.back_set')} testID="woodpecker-solve" />;
  return <Runner set={q.data} cycle={cycle} />;
}

function Runner({ set, cycle }: { set: WoodpeckerSet; cycle: number }) {
  const r = useWoodpeckerRunner(set, cycle);
  const { t, controller, s, step } = r;
  return (
    <ChapterStage
      testID="woodpecker-solve"
      board={{ controller, s, onMove: r.onMove, boardRef: r.boardRef }}
      back={{ label: t('woodpecker.back_set'), a11y: t('woodpecker.exit_a11y'), onPress: r.close, testID: 'woodpecker-solve-exit' }}
      chip={{ label: r.chip, color: tone.roseSoft, bg: alpha(eos.ember, 0.18), testID: 'woodpecker-cycle-chip' }}
      tracker={r.tracker}
      target={null}
      status={r.today && r.todayText ? <TodayChip today={r.today} text={r.todayText} /> : <></>}
      dashes={{ looks: r.looks, label: r.position, testID: 'woodpecker-segments' }}
      turn={{ side: r.side, title: r.solved ? t('review.solved') : r.goal, solved: r.solved, sub: r.position }}
      note={r.noteText}
      noteTestID="woodpecker-note"
      cards={null}
      footer={<SolveFooter controller={controller} s={s} step={step} prefix="woodpecker" t={t} hint={false} />}
      keys={step ? stepKeys(t) : solveKeys(t, false)}
      hotkeys={solveHotkeys(controller, s, !!step, r.close, false)}
    />
  );
}

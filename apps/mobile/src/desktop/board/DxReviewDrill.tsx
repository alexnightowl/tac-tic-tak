import { isApiError } from '@tac/core/api';
import { localeFor, formatSessionTime } from '@tac/core/format';
import { browseOf, canHint, drillCounterOf, mistakesProgressOf, practiceTitleOf, tacticalThemes, type PracticeState, type PracticeTitle } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { alpha, eos, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, CloudOff, Lightbulb, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDrill } from '@/features/review/DrillScreen';
import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import type { PracticeController } from '@/features/review/practice/PracticeController';
import { useMistakes } from '@/features/sessions/MistakesScreen';
import type { BoardHandle, BoardMove } from '@/board';
import { PlateButton } from '@/ui';
import { useLang, useT, useTn, type TFn } from '@/ui/lang';
import { useHotkeys } from '../hotkeys';
import { Bar, DText, GhostButton, KeyHints, Label } from '../kit';
import { dx } from '../tokens';
import { Card2, Spacer, SquareButton, TurnCard } from './parts';
import { BoardStage, StageMessage } from './Stage';

// The review runners on a desktop-wide window (canvas DXReviewDrill,
// DXReviewHint): /review/[puzzleId] (theme drill) and /sessions/[id]/review
// (the session's mistakes). Board left; right Close + the counter, the turn
// card, the hint card once a hint is used, where the mistake came from, and
// prev / hint / next. The runners are the phone screens' (useDrill,
// useMistakes).

const PLAY = '/play' as Href;
const notFound = (e: unknown) => isApiError(e) && e.status === 404;

type Runner = {
  controller: PracticeController;
  s: PracticeState;
  onMove: (m: BoardMove) => boolean;
  boardRef: (h: BoardHandle | null) => void;
};

export function DxReviewDrill({ puzzleId, theme }: { puzzleId: string; theme?: string }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const { controller, s, onMove, boardRef, puzzleQ, listQ, close } = useDrill(puzzleId, theme);

  if (puzzleQ.isError) {
    const missing = notFound(puzzleQ.error);
    return (
      <Message
        testID={missing ? 'drill-not-found' : 'drill-error'}
        title={missing ? t('review.not_in_queue') : t('review.error_title')}
        body={missing ? undefined : t('review.error_hint')}
        primary={
          missing
            ? { label: t('review.back_to_themes'), testID: 'drill-back', onPress: close }
            : { label: t('review.retry_load'), testID: 'drill-retry', onPress: () => void puzzleQ.refetch() }
        }
      />
    );
  }

  if (s.phase === 'done') {
    const total = drillCounterOf(s)?.total ?? s.drilled;
    const noun = tn('review.puzzle_word', total);
    return (
      <Message
        testID="drill-done"
        done
        title={theme ? t('review.theme_done_title') : t('review.done_title')}
        body={theme ? t('review.theme_done_hint', { theme: themeLabel(theme, lang), n: total, noun }) : t('review.done_hint', { n: total, noun })}
        primary={{ label: t('review.back_to_themes'), testID: 'drill-done-back', onPress: close }}
        secondary={{ label: t('review.new_session'), testID: 'drill-done-play', onPress: () => router.dismissTo(PLAY) }}
      />
    );
  }

  const counter = drillCounterOf(s);
  const name = theme ? themeLabel(theme, lang) : t('dx.board.mistakes');
  const heading = counter ? t('dx.board.drill_counter', { title: name, n: counter.position, total: counter.total }) : name;
  const listed = listQ.data?.find((i) => i.puzzleId === s.item?.puzzle.id);
  const added = listed ? `${new Date(listed.createdAt).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'long' })}, ${formatSessionTime(listed.createdAt, lang)}` : null;

  return (
    <DrillStage
      testID="screen-drill"
      runner={{ controller, s, onMove, boardRef }}
      loading={s.phase === 'idle' || s.phase === 'advancing'}
      close={close}
      closeTestID="screen-drill-close"
      closeLabel={t('review.back_to_themes')}
      heading={heading}
      headingTestID="drill-counter"
      origin={added ? `${t('dx.board.origin_queue')} · ${added}` : t('dx.board.origin_queue')}
      note={s.phase === 'advanceFailed' ? t('review.advance_failed') : null}
      retry={s.phase === 'advanceFailed' ? () => controller.dispatch({ type: 'retry' }) : null}
      t={t}
      lang={lang}
    />
  );
}

export function DxMistakes({ sessionId }: { sessionId: string }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const { controller, s, onMove, boardRef, q, close } = useMistakes(sessionId);

  if (q.isError && !q.data) {
    return (
      <Message
        testID="mistakes-error"
        title={t('sessions.error')}
        primary={{ label: t('sessions.retry'), testID: 'mistakes-retry', onPress: () => void q.refetch() }}
        icon={<CloudOff size={24} color={eos.ash} />}
      />
    );
  }

  if (s.phase === 'done') {
    const nothing = s.total === 0;
    return nothing ? (
      <Message
        testID="mistakes-nothing"
        done
        title={t('review.nothing_title')}
        body={t('review.nothing_hint')}
        primary={{ label: t('review.back'), testID: 'mistakes-back', onPress: close }}
      />
    ) : (
      <Message
        testID="mistakes-done"
        done
        title={t('review.done_title')}
        body={t('review.done_hint', { n: s.total, noun: tn('review.puzzle_word', s.total) })}
        primary={{ label: t('review.back_to_session'), testID: 'mistakes-done-back', onPress: close }}
        secondary={{ label: t('review.new_session'), testID: 'mistakes-done-play', onPress: () => router.dismissTo(PLAY) }}
      />
    );
  }

  const reason = s.item?.reason;
  const left = Math.max(0, s.queue.length - (s.phase === 'solved' ? 1 : 0));
  return (
    <DrillStage
      testID="screen-session-review"
      runner={{ controller, s, onMove, boardRef }}
      loading={q.isPending || s.phase === 'idle'}
      close={close}
      closeTestID="screen-session-review-close"
      closeLabel={t('review.back_to_session')}
      heading={t('dx.board.drill_counter', { title: t('dx.board.mistakes_title'), n: s.solvedCount, total: s.total })}
      headingTestID="mistakes-progress"
      progress={mistakesProgressOf(s)}
      origin={reason ? t(reason === 'failed' ? 'dx.board.origin_failed' : 'dx.board.origin_slow') : null}
      originLine={`${t('review.progress_a11y', { solved: s.solvedCount, total: s.total })} · ${t('review.tries_a11y', { n: s.failedTries })} · ${left} ${t('review.remaining')}`}
      note={null}
      retry={null}
      t={t}
      lang={lang}
    />
  );
}

function DrillStage({
  testID,
  runner,
  loading,
  close,
  closeTestID,
  closeLabel,
  heading,
  headingTestID,
  progress,
  origin,
  originLine,
  note,
  retry,
  t,
  lang,
}: {
  testID: string;
  runner: Runner;
  loading: boolean;
  close: () => void;
  closeTestID: string;
  closeLabel: string;
  heading: string;
  headingTestID: string;
  progress?: number;
  origin: string | null;
  originLine?: string;
  note: string | null;
  retry: (() => void) | null;
  t: TFn;
  lang: 'en' | 'uk';
}) {
  const { controller, s, onMove, boardRef } = runner;
  const title = practiceTitleOf(s);
  const solved = title === 'solved';
  const b = browseOf(s);
  const hint = () => canHint(s) && controller.dispatch({ type: 'hint' });
  const browse = (delta: -1 | 1) => controller.dispatch({ type: 'browse', delta });
  useHotkeys({
    h: hint,
    ArrowLeft: () => b.back && browse(-1),
    ArrowRight: () => b.forward && browse(1),
    Escape: close,
  });

  const themes = tacticalThemes(s.item?.puzzle.themes ?? []).map((x) => themeLabel(x, lang));
  const rewinding = s.phase === 'rewinding';

  const panel = (
    <>
      <View style={styles.row}>
        <GhostButton testID={closeTestID} label={t('review.close')} accessibilityLabel={closeLabel} icon={X} onPress={close} />
        <Spacer />
        <DText size={14} weight={700} color={dx.ash} tabular numberOfLines={1} testID={headingTestID}>
          {heading}
        </DText>
      </View>
      {progress != null ? <Bar value={progress} height={4} colors={[dx.dotOk, eos.sage]} /> : null}

      <TurnCard
        side={s.playerColor}
        title={turnTitle(title, s.playerColor, t)}
        titleColor={solved ? eos.sage : undefined}
        sub={rewinding ? null : title === 'yourTurn' ? t('dx.board.find_best') : null}
        pill={s.item ? String(s.item.puzzle.rating) : null}
      />
      {rewinding || note ? (
        <DText size={13} color={eos.rose} testID="practice-themes">
          {note ?? t('review.retry')}
        </DText>
      ) : null}

      {s.hintLevel > 0 && !solved ? (
        <View style={styles.hintCard} testID="dx-hint-card">
          <View style={styles.hintHead}>
            <Lightbulb size={15} color={tone.gold} strokeWidth={2} />
            <DText size={13.5} weight={800} color={tone.gold}>
              {t('dx.board.hint_n', { n: s.hintLevel })}
            </DText>
          </View>
          <DText size={13.5} lh={20} color={tone.goldInk} style={styles.mt6}>
            {t(s.hintLevel >= 2 ? 'dx.board.hint_2' : 'dx.board.hint_1')}
          </DText>
        </View>
      ) : null}

      {origin || themes.length ? (
        <Card2>
          {origin ? (
            <>
              <Label size={10}>{t('dx.board.origin')}</Label>
              <DText size={13.5} style={styles.mt6} testID={s.item?.reason ? `mistakes-reason-${s.item.reason}` : undefined}>
                {origin}
              </DText>
            </>
          ) : null}
          {originLine ? (
            <DText size={12} color={dx.dust} style={styles.mt6}>
              {originLine}
            </DText>
          ) : null}
          {themes.length ? (
            <DText size={12} color={dx.dust} style={styles.mt6} numberOfLines={1}>
              {themes.join(' · ')}
            </DText>
          ) : null}
        </Card2>
      ) : null}

      <Spacer />
      {E2E && <PracticeE2EStrip controller={controller} state={s} />}
      {retry ? (
        <PlateButton testID="drill-retry-next" label={t('review.retry_load')} variant="slate" size="md" block onPress={retry} />
      ) : (
        <View style={styles.row}>
          <SquareButton icon={ChevronLeft} testID="practice-back" accessibilityLabel={t('puzzle.prev')} disabled={!b.back} onPress={() => browse(-1)} />
          <View style={styles.flex}>
            {solved ? (
              <View style={styles.solved} testID="practice-solved" accessible accessibilityLabel={t('review.solved')}>
                <Check size={16} color={eos.sage} strokeWidth={2} />
                <DText size={13.5} weight={800} color={eos.sage}>
                  {t('review.solved')}
                </DText>
              </View>
            ) : (
              <PlateButton
                testID="practice-hint"
                label={s.hintLevel > 0 ? t('dx.board.hint_plate', { n: s.hintLevel }) : t('review.hint')}
                accessibilityLabel={t('review.hint')}
                variant="slate"
                size="md"
                block
                icon={<Lightbulb size={16} color={s.hintLevel > 0 ? eos.ember : eos.bone} strokeWidth={1.8} />}
                disabled={!canHint(s)}
                onPress={hint}
              />
            )}
          </View>
          <SquareButton icon={ChevronRight} testID="practice-forward" accessibilityLabel={t('puzzle.next')} disabled={!b.forward} onPress={() => browse(1)} />
        </View>
      )}
      <KeyHints
        items={[
          { keys: ['H'], label: t('dx.board.key.hint') },
          { keys: ['←', '→'], label: t('dx.board.key.browse') },
          { keys: ['Esc'], label: t('dx.board.key.close') },
        ]}
        style={styles.hints}
      />
    </>
  );

  return (
    <BoardStage
      testID={testID}
      board={(size) => <PracticeBoard controller={controller} boardRef={boardRef} onMove={onMove} loading={loading} size={size} />}
      panel={panel}
    />
  );
}

function turnTitle(title: PracticeTitle, side: 'w' | 'b', t: TFn): string {
  if (title === 'loading') return t('play.loading_puzzle');
  if (title === 'opponent') return t('play.opponent_moving');
  if (title === 'solved') return t('review.solved');
  if (title === 'solution') return t('puzzle.show_solution');
  return t(side === 'w' ? 'dx.board.white_moves' : 'dx.board.black_moves');
}

type Action = { label: string; testID: string; onPress: () => void };

/** Errors and the finished drill, centred in the stage. */
function Message({
  testID,
  title,
  body,
  primary,
  secondary,
  done,
  icon,
}: {
  testID: string;
  title: string;
  body?: string;
  primary: Action;
  secondary?: Action;
  done?: boolean;
  icon?: ReactNode;
}) {
  return (
    <StageMessage testID={testID}>
      {done ? (
        <View style={styles.doneIcon}>
          <Check size={28} color={eos.sage} />
        </View>
      ) : (
        (icon ?? null)
      )}
      <DText serif weight={700} size={24} align="center" accessibilityRole="header">
        {title}
      </DText>
      {body ? (
        <DText size={14.5} color={dx.ash} align="center" style={styles.body}>
          {body}
        </DText>
      ) : null}
      <View style={styles.actions}>
        <PlateButton label={primary.label} testID={primary.testID} onPress={primary.onPress} size="lg" block />
        {secondary ? <PlateButton label={secondary.label} testID={secondary.testID} onPress={secondary.onPress} variant="slate" size="lg" block /> : null}
      </View>
    </StageMessage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt6: { marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hintCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: alpha(tone.gold, 0.08),
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(tone.gold, 0.35), inset: true }],
  },
  hintHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  solved: {
    height: 46,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: alpha(tone.sageDeep, 0.16),
  },
  hints: { gap: 14 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(tone.sageDeep, 0.16) },
  body: { maxWidth: 440 },
  actions: { width: 320, gap: 12, marginTop: 12 },
});

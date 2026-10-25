import { isApiError } from '@tac/core/api';
import { normalizePieceSet } from '@tac/core/board';
import { canHint, practiceTitleOf, solutionStepOf, tacticalThemes } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { eos, layout, radii, semantic, space, surface } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { CloudOff, ExternalLink, Eye, RotateCcw, SearchX } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { puzzleApi, reviewKeys } from '@/features/review/api';
import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import { HintButton, PracticeTurnCard, SolvedBadge } from '@/features/review/practice/parts';
import { usePractice } from '@/features/review/practice/usePractice';
import { StateView } from '@/features/review/states';
import { useAppStore } from '@/stores/appStore';
import { AppText } from '@/ui';
import { useLang, useT, type TFn } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { BoardSwipe, SolutionStepper } from './SolutionStepper';

const lichessUrl = (id: string) => `https://lichess.org/training/${encodeURIComponent(id)}`;

/**
 * /puzzles/[puzzleId] (push): re-solve as practice (nothing is sent), or
 * step through the full solution. fix: the web rendered this inside the
 * nav and pull-to-refresh while also being full height, and the steps
 * hint read '← → to step'; here swipes, buttons and a scrubber step it.
 */
export function ViewerScreen({ puzzleId }: { puzzleId: string }) {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const pieceSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const { controller, state: s, onMove, boardRef } = usePractice('viewer');
  const q = useQuery({
    queryKey: reviewKeys.puzzle(puzzleId),
    queryFn: () => puzzleApi.get(puzzleId),
    staleTime: Infinity,
    retry: (n, e) => !(isApiError(e) && e.status === 404) && n < 1,
  });

  const puzzle = q.data;
  useEffect(() => {
    if (puzzle) controller.dispatch({ type: 'start', items: [{ puzzle }] });
  }, [controller, puzzle]);

  const header = (
    <Stack.Screen
      options={{
        title: t('puzzle.title'),
        headerRight: puzzle ? () => <LichessButton id={puzzle.id} rating={puzzle.rating} t={t} /> : undefined,
      }}
    />
  );

  if (q.isError && !q.data) {
    const missing = isApiError(q.error) && q.error.status === 404;
    return (
      <View style={styles.root} testID="screen-puzzle">
        {header}
        <StateView
          testID={missing ? 'viewer-not-found' : 'viewer-error'}
          icon={missing ? <SearchX size={24} color={eos.ash} /> : <CloudOff size={24} color={eos.ash} />}
          title={missing ? t('puzzle.not_found') : t('review.error_title')}
          body={missing ? t('puzzle.not_found_hint') : undefined}
          action={
            missing
              ? { label: t('review.back'), testID: 'viewer-back', onPress: () => router.back() }
              : { label: t('review.retry_load'), testID: 'viewer-retry', onPress: () => void q.refetch() }
          }
          style={styles.flex}
        />
      </View>
    );
  }

  const title = practiceTitleOf(s);
  const step = solutionStepOf(s);
  const themes = tacticalThemes(puzzle?.themes ?? []).map((x) => themeLabel(x, lang));
  const info = [t('puzzle.practice_note'), ...themes].join(' · ');
  const onStep = (delta: number, source: 'tap' | 'repeat' | 'swipe') => controller.dispatch({ type: 'step', delta, source });
  const onSeek = (ply: number) => controller.dispatch({ type: 'seek', ply });

  return (
    <View style={[styles.root, { paddingBottom: Math.max(layout.runnerPadding, insets.bottom) }]} testID="screen-puzzle">
      {header}
      <View style={styles.topSlot}>
        <PracticeTurnCard
          title={title}
          playerColor={s.playerColor}
          pieceSet={pieceSet}
          subtitle={step ? t('puzzle.solution_step_mobile', { n: step.n, total: step.total }) : undefined}
          t={t}
        />
        <AppText variant="caption" numberOfLines={2} style={styles.info} testID="viewer-info">
          {info}
        </AppText>
      </View>

      <PracticeBoard
        controller={controller}
        boardRef={boardRef}
        onMove={onMove}
        loading={q.isPending || s.phase === 'idle'}
        overlay={step ? <BoardSwipe onStep={onStep} /> : null}
      />

      <View style={styles.bottom}>
        {step ? (
          <>
            <SolutionStepper ply={step.ply} maxPly={step.maxPly} onStep={onStep} onSeek={onSeek} t={t} />
            <View style={styles.actions}>
              <AppText variant="caption" style={styles.counter} testID="viewer-counter">
                {`${step.n} / ${step.total}`}
              </AppText>
              <ActionButton testID="viewer-try-again" label={t('puzzle.try_again')} onPress={() => controller.dispatch({ type: 'tryAgain' })}>
                <RotateCcw size={16} color={eos.bone} />
              </ActionButton>
            </View>
          </>
        ) : (
          <View style={styles.actions}>
            {title === 'solved' ? (
              <>
                <SolvedBadge t={t} />
                <ActionButton testID="viewer-try-again" label={t('puzzle.try_again')} onPress={() => controller.dispatch({ type: 'tryAgain' })}>
                  <RotateCcw size={16} color={eos.bone} />
                </ActionButton>
              </>
            ) : (
              <HintButton level={s.hintLevel} disabled={!canHint(s)} onPress={() => controller.dispatch({ type: 'hint' })} t={t} />
            )}
            <ActionButton
              testID="viewer-solution"
              label={t('puzzle.show_solution')}
              disabled={!puzzle || s.phase === 'idle'}
              onPress={() => controller.dispatch({ type: 'showSolution' })}
            >
              <Eye size={16} color={eos.bone} />
            </ActionButton>
          </View>
        )}
        {E2E && <PracticeE2EStrip controller={controller} state={s} />}
      </View>
    </View>
  );
}

function ActionButton({
  testID,
  label,
  onPress,
  disabled,
  children,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.action, disabled && styles.disabled]}
    >
      {children}
      <AppText variant="label" color={eos.bone}>
        {label}
      </AppText>
    </Tap>
  );
}

function LichessButton({ id, rating, t }: { id: string; rating: number; t: TFn }) {
  return (
    <Tap
      testID="viewer-lichess"
      accessibilityRole="link"
      accessibilityLabel={t('puzzle.open_lichess')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() =>
        void WebBrowser.openBrowserAsync(lichessUrl(id), {
          controlsColor: eos.ember,
          toolbarColor: eos.ink,
          dismissButtonStyle: 'close',
        })
      }
      style={styles.lichess}
    >
      <AppText variant="caption" color={eos.bone} style={styles.counter}>
        {`${rating} · Lichess`}
      </AppText>
      <ExternalLink size={14} color={eos.ash} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1 },
  topSlot: { paddingHorizontal: space[2] + space[1], paddingTop: space[2], paddingBottom: space[3], gap: space[2.5] },
  info: { paddingHorizontal: space[1] },
  bottom: { paddingHorizontal: space[3], paddingTop: space[3], gap: space[3] },
  // Wraps: solved shows badge + Try again + Solution, wider than a 375 pt phone.
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space[3] },
  action: {
    height: space[11],
    paddingHorizontal: space[4],
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  disabled: { opacity: 0.5 },
  counter: { fontVariant: ['tabular-nums'] },
  lichess: { flexDirection: 'row', alignItems: 'center', gap: space[1], paddingHorizontal: space[2], height: space[9] },
});

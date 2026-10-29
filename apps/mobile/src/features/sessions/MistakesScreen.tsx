import { normalizePieceSet } from '@tac/core/board';
import { canHint, mistakesProgressOf, practiceTitleOf, sessionItemToPractice, tacticalThemes } from '@tac/core/runner';
import { eos, feedback, layout, radii, space, surface } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Check, CloudOff, Hourglass, X, XCircle } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FocusStatusBar } from '@/shell/FocusStatusBar';
import { reviewApi, reviewKeys, sessionApi } from '@/features/review/api';
import { progressTiming } from '@/features/review/motion';
import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import type { PracticeHooks } from '@/features/review/practice/PracticeController';
import { DoneView, HintButton, PracticeTurnCard, RoundButton, SolvedBadge, ThemesLine } from '@/features/review/practice/parts';
import { usePractice } from '@/features/review/practice/usePractice';
import { StateView } from '@/features/review/states';
import { queryClient } from '@/platform/query';
import { useAppStore } from '@/stores/appStore';
import { AppText } from '@/ui';
import { useLang, useT, useTn } from '@/ui/lang';

const PLAY = '/play' as Href;

/** Q14 (PROVISIONAL yes): a solved mistake also leaves the global review queue. */
const mistakesHooks: PracticeHooks = {
  resolve: (puzzleId) => {
    reviewApi.resolve(puzzleId).then(
      () => void queryClient.invalidateQueries({ queryKey: reviewKeys.themes() }),
      () => {
        // Already resolved or gone: nothing to undo.
      },
    );
  },
};

/**
 * /sessions/[id]/review (fullScreenModal): the session's missed and slow
 * puzzles, a local FIFO with no timer. Nothing affects the rating.
 */
export function MistakesScreen({ sessionId }: { sessionId: string }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const pieceSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const { controller, state: s, onMove, boardRef } = usePractice('mistakes', mistakesHooks);
  const q = useQuery({
    queryKey: reviewKeys.sessionReviewItems(sessionId),
    queryFn: () => sessionApi.reviewItems(sessionId),
    staleTime: 60_000,
  });

  const items = q.data?.items;
  useEffect(() => {
    if (!items) return;
    controller.dispatch({ type: 'start', items: items.map(sessionItemToPractice) });
  }, [controller, items]);

  const progress = useSharedValue(0);
  const ratio = mistakesProgressOf(s);
  useEffect(() => {
    progress.set(withTiming(ratio, progressTiming));
  }, [progress, ratio]);
  const bar = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/sessions/${encodeURIComponent(sessionId)}` as Href);
  };
  const closeButton = (
    <RoundButton testID="screen-session-review-close" label={t('review.back_to_session')} onPress={close}>
      <X size={20} color={eos.bone} />
    </RoundButton>
  );
  const pad = { paddingTop: Math.max(layout.runnerPadding, insets.top), paddingBottom: Math.max(layout.runnerPadding, insets.bottom) };

  if (q.isError && !q.data) {
    return (
      <View style={[styles.root, pad]} testID="screen-session-review">
        <View style={styles.doneTop}>{closeButton}</View>
        <StateView
          testID="mistakes-error"
          icon={<CloudOff size={24} color={eos.ash} />}
          title={t('sessions.error')}
          action={{ label: t('sessions.retry'), testID: 'mistakes-retry', onPress: () => void q.refetch() }}
          style={styles.flex}
        />
      </View>
    );
  }

  if (s.phase === 'done') {
    const nothing = s.total === 0;
    return (
      <View style={[styles.root, pad]} testID="screen-session-review">
        <View style={styles.doneTop}>{closeButton}</View>
        {nothing ? (
          <StateView
            testID="mistakes-nothing"
            icon={<Check size={24} color={eos.sage} />}
            title={t('review.nothing_title')}
            body={t('review.nothing_hint')}
            action={{ label: t('review.back'), testID: 'mistakes-back', variant: 'ember', onPress: close }}
            style={styles.flex}
          />
        ) : (
          <DoneView
            testID="mistakes-done"
            title={t('review.done_title')}
            hint={t('review.done_hint', { n: s.total, noun: tn('review.puzzle_word', s.total) })}
            primary={{ label: t('review.back_to_session'), testID: 'mistakes-done-back', onPress: close }}
            secondary={{ label: t('review.new_session'), testID: 'mistakes-done-play', onPress: () => router.dismissTo(PLAY) }}
          />
        )}
      </View>
    );
  }

  const reason = s.item?.reason;
  const left = Math.max(0, s.queue.length - (s.phase === 'solved' ? 1 : 0));
  const note = s.phase === 'rewinding' ? t('review.retry') : null;

  return (
    <View style={[styles.root, pad]} testID="screen-session-review">
      <FocusStatusBar />
      <View style={styles.topSlot}>
        <View style={styles.topRow}>
          {closeButton}
          <View style={styles.progressBox} accessible accessibilityLabel={t('review.progress_a11y', { solved: s.solvedCount, total: s.total })}>
            <View style={styles.track}>
              <Animated.View style={[styles.fill, bar]} />
            </View>
            <AppText variant="caption" style={styles.tabular} testID="mistakes-progress">
              {`${s.solvedCount} / ${s.total}`}
            </AppText>
          </View>
        </View>
        <PracticeTurnCard title={practiceTitleOf(s)} playerColor={s.playerColor} pieceSet={pieceSet} t={t} />
        <View style={styles.reasonBar}>
          {reason ? (
            <View style={styles.chip} testID={`mistakes-reason-${reason}`}>
              {reason === 'failed' ? <XCircle size={14} color={eos.rose} /> : <Hourglass size={14} color={feedback.hint} />}
              <AppText variant="label" color={reason === 'failed' ? eos.rose : feedback.hint}>
                {t(reason === 'failed' ? 'review.reason_failed' : 'review.reason_slow')}
              </AppText>
            </View>
          ) : null}
          {s.item ? (
            <AppText variant="caption" style={styles.tabular}>
              {`${t('review.rating')} ${s.item.puzzle.rating}`}
            </AppText>
          ) : null}
        </View>
        <ThemesLine slugs={tacticalThemes(s.item?.puzzle.themes ?? [])} lang={lang} note={note} />
      </View>

      <PracticeBoard controller={controller} boardRef={boardRef} onMove={onMove} loading={q.isPending || s.phase === 'idle'} />

      <View style={styles.bottom}>
        <View style={styles.statsRow}>
          <View style={styles.stat} accessible accessibilityLabel={t('review.progress_a11y', { solved: s.solvedCount, total: s.total })}>
            <Check size={14} color={eos.sage} />
            <AppText variant="label" color={eos.sage} testID="mistakes-solved">
              {String(s.solvedCount)}
            </AppText>
          </View>
          <View style={styles.stat} accessible accessibilityLabel={t('review.tries_a11y', { n: s.failedTries })}>
            <X size={14} color={eos.rose} />
            <AppText variant="label" color={eos.rose} testID="mistakes-tries">
              {String(s.failedTries)}
            </AppText>
          </View>
          <AppText variant="caption" testID="mistakes-left">
            {`· ${left} ${t('review.remaining')}`}
          </AppText>
        </View>
        <View style={styles.cta}>
          {practiceTitleOf(s) === 'solved' ? (
            <SolvedBadge t={t} />
          ) : (
            <HintButton level={s.hintLevel} disabled={!canHint(s)} onPress={() => controller.dispatch({ type: 'hint' })} t={t} />
          )}
        </View>
        {E2E && <PracticeE2EStrip controller={controller} state={s} />}
      </View>
      {q.isPending ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={eos.ember} size="large" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1 },
  topSlot: { minHeight: layout.boardTopSlot, paddingHorizontal: space[2], gap: space[2.5] },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[2] },
  doneTop: { flexDirection: 'row', paddingHorizontal: layout.gutter },
  progressBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  track: { flex: 1, height: space[1.5], borderRadius: radii.full, backgroundColor: eos.rise, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radii.full, backgroundColor: eos.sage },
  reasonBar: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[1] },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    paddingHorizontal: space[2.5],
    paddingVertical: space[1],
    borderRadius: radii.full,
    backgroundColor: surface.floatCard,
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  bottom: { paddingHorizontal: space[2], paddingTop: space[3], gap: space[2] },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[3] },
  stat: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  cta: { alignItems: 'center', minHeight: space[11] },
  tabular: { fontVariant: ['tabular-nums'] },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});

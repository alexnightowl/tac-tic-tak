import { isApiError } from '@tac/core/api';
import { normalizePieceSet } from '@tac/core/board';
import {
  canHint,
  drillCounterOf,
  nextReviewPuzzleId,
  practiceTitleOf,
  tacticalThemes,
} from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { eos, layout, space } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FocusStatusBar } from '@/shell/FocusStatusBar';
import { queryClient } from '@/platform/query';
import { useAppStore } from '@/stores/appStore';
import { AppText } from '@/ui';
import { useLang, useT, useTn } from '@/ui/lang';
import { reviewApi, reviewKeys } from './api';
import { E2E, PracticeE2EStrip } from './practice/E2EStrip';
import type { PracticeHooks } from './practice/PracticeController';
import { PracticeBoard } from './practice/PracticeBoard';
import { DoneView, HintButton, PracticeTurnCard, RoundButton, SolvedBadge, ThemesLine } from './practice/parts';
import { usePractice } from './practice/usePractice';
import { StateView } from './states';

const REVIEW = '/review' as Href;
const PLAY = '/play' as Href;
const notFound = (e: unknown) => isApiError(e) && e.status === 404;

const puzzleQuery = (id: string) => ({
  queryKey: reviewKeys.reviewPuzzle(id),
  queryFn: () => reviewApi.puzzle(id),
  staleTime: Infinity,
  meta: { persist: false },
});

/**
 * Drill: resolve the solved puzzle (errors swallowed, as on the web), then
 * a fresh list, then the first other puzzle. Resolve goes first so a stale
 * list can't steer the drill back to the puzzle just solved.
 */
function drillHooks(theme: string | undefined): PracticeHooks {
  return {
    advance: async (solvedId) => {
      try {
        await reviewApi.resolve(solvedId);
      } catch {
        // Non-fatal: the drill still moves on.
      }
      const fresh = await reviewApi.list(theme);
      queryClient.setQueryData(reviewKeys.list(theme), fresh);
      void queryClient.invalidateQueries({ queryKey: reviewKeys.themes() });
      const nextId = nextReviewPuzzleId(fresh, solvedId);
      if (!nextId) return null;
      const puzzle = await queryClient.fetchQuery(puzzleQuery(nextId));
      // Warm the one after, so the next swap is instant too.
      const after = nextReviewPuzzleId(fresh.filter((i) => i.puzzleId !== solvedId), nextId);
      if (after) void queryClient.prefetchQuery(puzzleQuery(after));
      return { puzzle };
    },
  };
}

/**
 * /review/[puzzleId]?theme= (fullScreenModal): the theme drill on the
 * shared practice runner. The next puzzle cross-fades in place, so the
 * stack never grows (the web router.replace'd a route per puzzle).
 */
export function DrillScreen({ puzzleId, theme }: { puzzleId: string; theme?: string }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const pieceSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const { controller, state: s, onMove, boardRef } = usePractice('drill', drillHooks(theme));

  const puzzleQ = useQuery({ ...puzzleQuery(puzzleId), retry: (n: number, e: unknown) => !notFound(e) && n < 1 });
  const listQ = useQuery({ queryKey: reviewKeys.list(theme), queryFn: () => reviewApi.list(theme), staleTime: 30_000 });

  // Start once the puzzle and the counter list are in (a failed list
  // freezes the counter on this puzzle alone). The reducer ignores repeats.
  const first = puzzleQ.data;
  const listSettled = !listQ.isPending;
  useEffect(() => {
    if (!first || !listSettled) return;
    const ids = listQ.data?.map((i) => i.puzzleId) ?? [first.id];
    controller.dispatch({ type: 'start', items: [{ puzzle: first }], counterIds: ids });
    const next = listQ.data ? nextReviewPuzzleId(listQ.data, first.id) : null;
    if (next) void queryClient.prefetchQuery(puzzleQuery(next));
  }, [controller, first, listSettled, listQ.data]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(REVIEW);
  };
  const closeButton = (
    <RoundButton testID="screen-drill-close" label={t('review.back_to_themes')} onPress={close}>
      <X size={20} color={eos.bone} />
    </RoundButton>
  );
  const pad = { paddingTop: Math.max(layout.runnerPadding, insets.top), paddingBottom: Math.max(layout.runnerPadding, insets.bottom) };

  if (puzzleQ.isError) {
    const missing = notFound(puzzleQ.error);
    return (
      <View style={[styles.root, pad]} testID="screen-drill">
        <View style={styles.topRow}>{closeButton}</View>
        <StateView
          testID={missing ? 'drill-not-found' : 'drill-error'}
          title={missing ? t('review.not_in_queue') : t('review.error_title')}
          body={missing ? undefined : t('review.error_hint')}
          action={
            missing
              ? { label: t('review.back_to_themes'), testID: 'drill-back', onPress: close }
              : { label: t('review.retry_load'), testID: 'drill-retry', onPress: () => void puzzleQ.refetch() }
          }
          style={styles.flex}
        />
      </View>
    );
  }

  if (s.phase === 'done') {
    const total = drillCounterOf(s)?.total ?? s.drilled;
    const noun = tn('review.puzzle_word', total);
    const hint = theme
      ? t('review.theme_done_hint', { theme: themeLabel(theme, lang), n: total, noun })
      : t('review.done_hint', { n: total, noun });
    return (
      <View style={[styles.root, pad]} testID="screen-drill">
        <View style={styles.topRow}>{closeButton}</View>
        <DoneView
          testID="drill-done"
          title={theme ? t('review.theme_done_title') : t('review.done_title')}
          hint={hint}
          primary={{ label: t('review.back_to_themes'), testID: 'drill-done-back', onPress: close }}
          secondary={{ label: t('review.new_session'), testID: 'drill-done-play', onPress: () => router.dismissTo(PLAY) }}
        />
      </View>
    );
  }

  const counter = drillCounterOf(s);
  const rating = s.item?.puzzle.rating;
  const title = practiceTitleOf(s);
  const solvedLike = title === 'solved';
  const note = s.phase === 'rewinding' ? t('review.retry') : s.phase === 'advanceFailed' ? t('review.advance_failed') : null;

  return (
    <View style={[styles.root, pad]} testID="screen-drill">
      <FocusStatusBar />
      <View style={styles.topSlot}>
        <View style={styles.topRow}>
          {closeButton}
          <View
            style={styles.counter}
            accessible
            accessibilityLabel={counter ? t('review.counter_a11y', { n: counter.position, total: counter.total }) : t('ui.loading')}
          >
            {theme ? (
              <AppText variant="turnTitle" numberOfLines={1} testID="drill-theme">
                {themeLabel(theme, lang)}
              </AppText>
            ) : null}
            <AppText variant="caption" testID="drill-counter">
              {counter ? `${counter.position} / ${counter.total}` : ' '}
              {rating != null ? ` · ${rating}` : ''}
            </AppText>
          </View>
          <View style={styles.sideSpacer} />
        </View>
        <PracticeTurnCard title={title} playerColor={s.playerColor} pieceSet={pieceSet} t={t} />
        <ThemesLine slugs={tacticalThemes(s.item?.puzzle.themes ?? [])} lang={lang} note={note} />
      </View>

      <PracticeBoard controller={controller} boardRef={boardRef} onMove={onMove} loading={s.phase === 'idle' || s.phase === 'advancing'} />

      <View style={styles.bottom}>
        <View style={styles.cta}>
          {s.phase === 'advanceFailed' ? (
            <RoundButton testID="drill-retry-next" label={t('review.retry_load')} onPress={() => controller.dispatch({ type: 'retry' })}>
              <AppText variant="label" color={eos.bone}>
                {t('review.retry_load')}
              </AppText>
            </RoundButton>
          ) : solvedLike ? (
            <SolvedBadge t={t} />
          ) : (
            <HintButton level={s.hintLevel} disabled={!canHint(s)} onPress={() => controller.dispatch({ type: 'hint' })} t={t} />
          )}
        </View>
        {E2E && <PracticeE2EStrip controller={controller} state={s} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1 },
  topSlot: { minHeight: layout.boardTopSlot, paddingHorizontal: space[2], gap: space[2.5] },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], paddingHorizontal: space[2] },
  counter: { flex: 1, alignItems: 'center', gap: space[0.5] },
  sideSpacer: { width: space[11] },
  bottom: { paddingHorizontal: space[2], paddingTop: space[3], gap: space[1] },
  cta: { alignItems: 'center', minHeight: space[11] },
});

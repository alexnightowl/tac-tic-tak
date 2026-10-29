import { formatLocalDate } from '@tac/core/format';
import type { OfflinePuzzle } from '@tac/core/offline';
import type { TrainingStyle } from '@tac/core/rules';
import { canHint, type PracticeItem, type PracticeState } from '@tac/core/runner';
import { alpha, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Lightbulb, Plane, RefreshCw, X } from 'lucide-react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readLastStyle } from '@/features/play/setupPrefs';
import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import type { PracticeHooks } from '@/features/review/practice/PracticeController';
import { DoneView } from '@/features/review/practice/parts';
import { usePractice } from '@/features/review/practice/usePractice';
import { FocusStatusBar } from '@/shell/FocusStatusBar';
import { useAppStore } from '@/stores/appStore';
import { AppText, PlateButton, Tap } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { packShort, plural } from './format';
import { offlineStore, packOf, unplayedOf, useOfflineStore, type PackKey } from './store';
import { requestSync } from './sync';

// /offline/solve?pack= (OfflineSolve artboard): the theme-drill practice
// runner fed from a pack on the phone. Rated, but the rating is frozen
// until sync: each puzzle's first outcome is queued (a wrong move, a hint
// or Skip = missed; a clean solve = correct). After a miss the player may
// keep trying (practice) or skip; the result is already in the queue.

/** Server cap on responseMs (10 min). */
const MAX_RESPONSE_MS = 10 * 60 * 1000;

const toItem = (p: OfflinePuzzle): PracticeItem => ({ puzzle: { ...p, gameUrl: null } });

type Note = 'missed' | 'hint' | null;

/**
 * Watches the runner and queues each puzzle's first outcome. Plain class
 * (not React state): it runs from the controller's listener.
 */
class ResultTracker {
  private id: string | null = null;
  private startedAt = 0;
  private done = false;
  private correct: boolean | null = null;
  private note: Note = null;
  private listeners = new Set<() => void>();

  constructor(
    private readonly pack: PackKey,
    private readonly style: TrainingStyle,
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getNote = (): Note => this.note;
  /** The puzzle on the board left with a miss (Skip): its advance is not a solve. */
  missedCurrent = () => this.done && this.correct === false;
  recorded = (id: string) => this.id === id && this.done;

  onState = (s: PracticeState) => {
    const id = s.item?.puzzle.id ?? null;
    if (id !== this.id) {
      this.id = id;
      this.startedAt = 0;
      this.done = false;
      this.correct = null;
      this.setNote(null);
    }
    if (!id || this.done) return;
    if (s.phase === 'playerTurn' && this.startedAt === 0) this.startedAt = Date.now();
    if (s.phase === 'solved') this.record(true);
    else if (s.phase === 'rewinding') this.record(false, 'missed');
    else if (s.hintLevel > 0) this.record(false, 'hint');
  };

  skip = () => {
    if (this.id && !this.done) this.record(false, null);
  };

  private record(correct: boolean, note: Note = null) {
    if (!this.id) return;
    this.done = true;
    this.correct = correct;
    const now = new Date();
    offlineStore.getState().enqueue({
      puzzleId: this.id,
      correct,
      responseMs: this.startedAt ? Math.min(MAX_RESPONSE_MS, Math.max(0, now.getTime() - this.startedAt)) : 0,
      solvedAt: now.toISOString(),
      localDay: formatLocalDate(now),
      source: this.pack === 'review' ? 'review' : 'pack',
      style: this.style,
      pack: this.pack,
    });
    this.setNote(note);
  }

  private setNote(note: Note) {
    if (note === this.note) return;
    this.note = note;
    for (const fn of this.listeners) fn();
  }
}

function packHooks(key: PackKey, tracker: ResultTracker): PracticeHooks {
  return {
    advance: async (puzzleId) => {
      // Advanced without an outcome: the line was unplayable. Drop it.
      if (!tracker.recorded(puzzleId)) offlineStore.getState().prune(key, new Set([puzzleId]));
      const next = unplayedOf(offlineStore.getState(), key).find((p) => p.id !== puzzleId);
      return next ? toItem(next) : null;
    },
  };
}

export function SolveScreen({ pack: key }: { pack: PackKey }) {
  const t = useT();
  const tn = useTn();
  const insets = useSafeAreaInsets();
  const [style] = useState<TrainingStyle>(() => packOf(offlineStore.getState(), key)?.style ?? readLastStyle());
  const [tracker] = useState(() => new ResultTracker(key, style));
  const { controller, state: s, onMove, boardRef } = usePractice('drill', packHooks(key, tracker));
  const note = useSyncExternalStore(tracker.subscribe, tracker.getNote);
  const rating = useAppStore((st) => st.progressions[style].currentPuzzleRating);
  const pending = useOfflineStore((st) => st.queue.length);
  const pack = useOfflineStore((st) => packOf(st, key));
  const left = useOfflineStore((st) => unplayedOf(st, key).length);

  useEffect(() => {
    const off = controller.subscribe(() => tracker.onState(controller.getState()));
    const first = unplayedOf(offlineStore.getState(), key)[0];
    controller.dispatch({ type: 'start', items: first ? [toItem(first)] : [] });
    return off;
  }, [controller, tracker, key]);

  // Leaving the runner online flushes what was just played.
  useEffect(() => () => void requestSync('runner'), []);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/offline' as Href);
  };

  const pad = { paddingTop: insets.top, paddingBottom: Math.max(space[6], insets.bottom) };
  const total = pack?.puzzles.length ?? 0;
  const cur = s.item?.puzzle.id;
  const position = Math.min(total, total - left + (cur && !tracker.recorded(cur) ? 1 : 0));

  const header = (
    <View style={styles.header}>
      <Tap testID="offline-exit" accessibilityRole="button" accessibilityLabel={t('offline.exit')} onPress={close} style={styles.exit}>
        <X size={18} color={eos.ash} strokeWidth={1.8} />
        <AppText variant="bodyStrong" color={eos.ash}>
          {t('offline.exit')}
        </AppText>
      </Tap>
      <View style={styles.flex} />
      <View style={styles.chip} testID="offline-chip">
        <Plane size={14} color={tone.amberLight} strokeWidth={1.8} />
        <AppText variant="captionStrong" color={tone.amberLight} style={styles.caps}>
          {t('offline.chip')}
        </AppText>
      </View>
    </View>
  );

  if (s.phase === 'done') {
    return (
      <View style={[styles.root, pad]} testID="offline-solve">
        {header}
        <DoneView
          testID="offline-done"
          title={t('offline.done_title')}
          hint={t('offline.done_hint')}
          primary={{ label: t('offline.done_back'), testID: 'offline-done-back', onPress: close }}
          secondary={{ label: t('review.new_session'), testID: 'offline-done-play', onPress: () => router.dismissTo('/play' as Href) }}
        />
      </View>
    );
  }

  const skipped = s.phase === 'advancing' && tracker.missedCurrent();
  const titleKey =
    s.phase === 'idle' || s.phase === 'swapping' || skipped
      ? 'play.loading_puzzle'
      : s.phase === 'solved' || s.phase === 'advancing'
        ? 'review.solved'
        : s.phase === 'playerTurn' || s.phase === 'rewinding'
          ? 'play.your_turn'
          : 'play.opponent_moving';
  const noteText = note === 'missed' ? t('offline.missed_note') : note === 'hint' ? t('offline.hint_note') : null;

  return (
    <View style={[styles.root, pad]} testID="offline-solve">
      <FocusStatusBar />
      {header}
      <View style={styles.turn}>
        <View style={[styles.side, { backgroundColor: s.playerColor === 'w' ? eos.bone : tone.iron }]} />
        <View style={styles.flex}>
          <AppText variant="navTitle" numberOfLines={1} color={titleKey === 'review.solved' ? tone.sage : undefined} testID="turn-title">
            {t(titleKey)}
          </AppText>
          <AppText variant="caption" numberOfLines={1} testID="offline-progress">
            {t('offline.progress', { pack: packShort(key, t), n: Math.max(1, position), total })}
          </AppText>
        </View>
        <View style={styles.rating} accessible accessibilityLabel={t('offline.rating_a11y', { rating })}>
          <AppText variant="tabLabel" color={eos.dust} style={styles.caps}>
            {t('offline.rating')}
          </AppText>
          <AppText variant="bodyStrong" color={eos.ash} style={styles.tabular} testID="offline-rating">
            {`${rating}*`}
          </AppText>
        </View>
      </View>

      <PracticeBoard controller={controller} boardRef={boardRef} onMove={onMove} loading={s.phase === 'idle' || s.phase === 'advancing'} />

      <View style={styles.noteLine}>
        {noteText ? (
          <AppText variant="caption" color={tone.rose} numberOfLines={1} testID="offline-missed">
            {noteText}
          </AppText>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardIcon}>
          <RefreshCw size={18} color={tone.amberLight} strokeWidth={1.8} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" testID="offline-waiting">
            {pending > 0 ? plural(tn, 'offline.waiting', pending) : t('offline.nothing_waiting')}
          </AppText>
          <AppText variant="caption" style={styles.cardBody}>
            {t('offline.frozen_note')}
          </AppText>
        </View>
      </View>

      <View style={styles.flex} />
      <View style={styles.bottom}>
        <View style={styles.flex}>
          <PlateButton
            testID="offline-hint"
            label={t('review.hint')}
            variant="slate"
            size="md"
            block
            icon={<Lightbulb size={18} color={s.hintLevel > 0 ? eos.ember : eos.bone} strokeWidth={1.8} />}
            disabled={!canHint(s)}
            onPress={() => controller.dispatch({ type: 'hint' })}
          />
        </View>
        <Tap
          testID="offline-skip"
          accessibilityRole="button"
          accessibilityLabel={t('offline.skip_a11y')}
          onPress={() => {
            tracker.skip();
            controller.dispatch({ type: 'skip' });
          }}
          style={styles.skip}
        >
          <AppText variant="bodyStrong" color={eos.ash}>
            {t('offline.skip')}
          </AppText>
        </Tap>
      </View>
      {E2E && <PracticeE2EStrip controller={controller} state={s} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1, minWidth: 0 },
  caps: { textTransform: 'uppercase' },
  tabular: { fontVariant: ['tabular-nums'] },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center', gap: space[2] },
  exit: { height: layout.headerButton, paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  chip: {
    height: space[6],
    paddingHorizontal: 9,
    marginRight: space[2],
    borderRadius: radii.full,
    backgroundColor: alpha(tone.copper, 0.18),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
  },
  turn: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: layout.gutter, paddingTop: space[3], paddingBottom: space[3.5] },
  side: { width: 14, height: 14, borderRadius: 3 },
  rating: { alignItems: 'flex-end' },
  noteLine: { height: space[6], justifyContent: 'center', paddingHorizontal: layout.gutter },
  card: {
    marginHorizontal: layout.gutter,
    paddingHorizontal: space[3.5],
    paddingVertical: space[3],
    borderRadius: radii.xl,
    backgroundColor: eos.shade,
    borderWidth: 1,
    borderColor: eos.seam,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  cardIcon: { width: space[9], height: space[9], borderRadius: radii.lg, backgroundColor: eos.rise, alignItems: 'center', justifyContent: 'center' },
  cardBody: { marginTop: space[0.5] },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: space[2.5], paddingHorizontal: layout.gutter },
  skip: { flex: 1, height: space[12], alignItems: 'center', justifyContent: 'center' },
});

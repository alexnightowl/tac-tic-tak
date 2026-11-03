import { comboBar, STORM_COMBO_STEPS, STORM_LIVES, stormClockMs, type StormFormat, type StormStreamResponse } from '@tac/core/storm';
import { eos, layout, radii, space, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePreventRemove, type Href } from 'expo-router';
import { X } from 'lucide-react-native';
import { memo, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, AppState, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BoardHandle } from '@/board';
import { feel } from '@/feel';
import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import { usePractice } from '@/features/review/practice/usePractice';
import { FocusStatusBar } from '@/shell/FocusStatusBar';
import { AppText, PlateButton, Tap } from '@/ui';
import { useT } from '@/ui/lang';
import { stormApi } from './api';
import { clockText } from './format';
import { BAR_JUMP, BONUS_FLOAT, END_HOLD_MS, LOW_TIME_MS, TICK_LAST_S, WARN_TIME_MS } from './motion';
import { Bolt, EmberChip, Heart } from './parts';
import { StormRun } from './run';
import { setMountedRun } from './store';

// /storm/run?challenge&format (canvas StormRun). Solo Storm and the async
// Race share it (docs/mobile/STORM.md "Rules"): the stream is fetched here,
// the clock starts on the first puzzle's turn and never pauses (wall time;
// coming back from the background after 0:00 ends the run). The run is
// saved after every puzzle; on its end it is queued and posted, then the
// screen replaces itself with the result (solo) or the challenge (race).

export function RunScreen({ challengeId, format }: { challengeId: string | null; format: StormFormat }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; stream: StormStreamResponse }>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    stormApi.stream(challengeId ?? undefined).then(
      (stream) => alive && setLoad(stream.puzzles.length > 0 ? { status: 'ready', stream } : { status: 'error' }),
      () => alive && setLoad({ status: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [challengeId, attempt]);

  if (load.status === 'ready') return <Run stream={load.stream} format={format} challengeId={challengeId} />;
  return (
    <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="storm-run-loading">
      <FocusStatusBar />
      {load.status === 'loading' ? (
        <>
          <ActivityIndicator color={eos.ember} size="large" />
          <AppText variant="body" color={eos.ash}>
            {t('storm.run.loading')}
          </AppText>
        </>
      ) : (
        <>
          <AppText variant="body" color={eos.ash} style={styles.centerText} testID="storm-run-error">
            {t('storm.run.error')}
          </AppText>
          <PlateButton testID="storm-run-retry" label={t('storm.run.retry')} size="md" onPress={() => {
              setLoad({ status: 'loading' });
              setAttempt((n) => n + 1);
            }} />
          <PlateButton testID="storm-run-close" label={t('storm.run.close')} variant="slate" size="sm" onPress={() => router.back()} />
        </>
      )}
    </View>
  );
}

function Run({ stream, format, challengeId }: { stream: StormStreamResponse; format: StormFormat; challengeId: string | null }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [run] = useState(() => new StormRun(stream, format, challengeId));
  const { controller, state: p, onMove, boardRef } = usePractice('storm', { advance: run.advance });
  const [ref] = useState(() => (h: BoardHandle | null) => {
    boardRef(h);
    run.setBoard(h);
  });
  const snap = useSyncExternalStore(run.subscribe, run.getSnap);
  const s = snap.state;
  const timed = stormClockMs(format) != null;

  useEffect(() => {
    setMountedRun(run.live.clientId);
    const off = controller.subscribe(() => run.onPractice(controller.getState()));
    controller.dispatch({ type: 'start', items: [run.item(0)] });
    // The clock never pauses: back from the background, check it at once.
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') run.tick();
    });
    return () => {
      off();
      app.remove();
      setMountedRun(null);
    };
  }, [controller, run]);

  // ✕, Android back: confirm, then the run ends as a quit.
  const [guard, setGuard] = useState(true);
  const confirmQuit = () => {
    if (run.getSnap().state.ended) return;
    feel.emit('exitSheet');
    Alert.alert(t('storm.run.confirm_title'), t('storm.run.confirm_body'), [
      { text: t('storm.run.confirm_keep'), style: 'cancel' },
      { text: t('storm.run.confirm_end'), style: 'destructive', onPress: () => run.quit() },
    ]);
  };
  const allowLeave = usePreventRemove(guard, confirmQuit);

  // The end: hold a beat (the last reveal, the gong), then the result.
  const finished = snap.finished;
  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => {
      setGuard(false);
      allowLeave();
      if (finished.challengeId) router.replace(`/challenge/${finished.challengeId}` as Href);
      else router.replace(`/storm/result?run=${finished.clientId}` as Href);
    }, END_HOLD_MS[finished.end]);
    return () => clearTimeout(timer);
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const bar = comboBar(s.combo);
  const shown = stream.puzzles[snap.shown];
  const solved = s.results.filter((r) => r.ok).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(space[4], insets.bottom) }]} testID="storm-run">
      <FocusStatusBar />
      <View style={styles.header}>
        <Tap
          testID="storm-run-exit"
          accessibilityRole="button"
          accessibilityLabel={t('storm.run.end_a11y')}
          onPress={confirmQuit}
          style={styles.exit}
        >
          <X size={18} color={eos.ash} strokeWidth={1.8} />
        </Tap>
        {timed ? (
          <StormClock run={run} total={stormClockMs(format) ?? 1} />
        ) : (
          <AppText variant="captionStrong" color={eos.ash} style={styles.flex} testID="storm-run-survival">
            {t('storm.run.survival')}
          </AppText>
        )}
      </View>

      <View style={styles.scoreRow}>
        <View>
          <AppText variant="label" color={eos.dust} style={styles.tinyLabel}>
            {t('storm.run.score')}
          </AppText>
          <AppText variant="sectionTitle" style={styles.score} testID="storm-run-score">
            {String(s.score)}
          </AppText>
        </View>
        <View style={styles.flex}>
          <View style={styles.comboLine}>
            <EmberChip testID="storm-run-combo">
              <Bolt size={13} color={tone.blush} strokeWidth={2} />
              <AppText variant="captionStrong" color={tone.blush} style={styles.comboText}>
                {t('storm.run.combo', { n: s.combo })}
              </AppText>
            </EmberChip>
            {timed ? (
              <AppText variant="captionStrong" color={eos.ash} numberOfLines={1} style={styles.flex}>
                {t('storm.run.next_bonus', { s: bar.nextBonusMs / 1000, n: bar.nextAt })}
              </AppText>
            ) : null}
          </View>
          <View style={styles.steps}>
            {Array.from({ length: STORM_COMBO_STEPS }, (_, i) => (
              <View key={i} style={[styles.step, i < bar.filled && styles.stepOn]} />
            ))}
          </View>
        </View>
        <View style={styles.livesBox}>
          <AppText variant="label" color={eos.dust} style={styles.tinyLabel}>
            {t('storm.run.lives')}
          </AppText>
          <View style={styles.lives} accessible accessibilityRole="image" accessibilityLabel={t('storm.run.lives_a11y', { n: s.lives })} testID="storm-run-lives">
            {Array.from({ length: STORM_LIVES }, (_, i) => (
              <Heart key={i} on={i < s.lives} />
            ))}
          </View>
        </View>
      </View>

      <PracticeBoard controller={controller} boardRef={ref} onMove={onMove} loading={p.phase === 'idle'} />

      <View style={styles.puzzleLine}>
        <AppText variant="bodyStrong" color={eos.ash} style={styles.lineText} testID="storm-run-puzzle">
          {t('storm.run.puzzle', { n: snap.shown + 1 })}
          {' · '}
          <AppText variant="bodyStrong" style={[styles.lineText, styles.tabular]}>
            {String(shown?.rating ?? '')}
          </AppText>
        </AppText>
        <AppText variant="bodyStrong" color={eos.ash} style={styles.lineText}>
          {t(p.playerColor === 'w' ? 'storm.run.white' : 'storm.run.black')}
        </AppText>
      </View>

      <History results={s.results} current={s.ended ? -1 : s.index} label={t('storm.run.history_a11y', { solved, missed: s.mistakes })} />

      <View style={styles.flex} />
      {E2E && <PracticeE2EStrip controller={controller} state={p} />}
      <AppText variant="caption" color={eos.dust} style={styles.footer}>
        {t('storm.run.footer')}
      </AppText>
    </View>
  );
}

/** Run-so-far squares: sage solved, ember mistake, iron for the one on the board. */
const History = memo(function History({ results, current, label }: { results: readonly { i: number; ok: boolean }[]; current: number; label: string }) {
  return (
    <View style={styles.history} accessible accessibilityRole="image" accessibilityLabel={label} testID="storm-run-history">
      {results.map((r) => (
        <View key={r.i} style={[styles.sq, { backgroundColor: r.ok ? tone.sageDeep : eos.ember }]} />
      ))}
      {current >= 0 ? <View style={[styles.sq, { backgroundColor: tone.iron }]} /> : null}
    </View>
  );
});

/**
 * The time bar and m:ss. Re-renders only itself, once a second (aligned to
 * the displayed second); the bar drains on the UI thread (a linear timing to
 * the deadline, re-aimed when a bonus or a penalty moves it). At 0:00 it
 * nudges the engine with a tick; a bonus floats a "+3 s" chip by the clock.
 */
function StormClock({ run, total }: { run: StormRun; total: number }) {
  const t = useT();
  const reduced = useReducedMotion();
  const [ms, setMs] = useState(total);
  const frac = useSharedValue(1);
  const bonusOpacity = useSharedValue(0);
  const bonusY = useSharedValue(0);
  const [bonusText, setBonusText] = useState('');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastDeadline: number | null = null;
    let warned = false;
    let lastTick = -1;
    let lastBonus = run.getSnap().bonus.seq;

    const sync = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      const snap = run.getSnap();
      const s = snap.state;
      const now = Date.now();
      const deadline = run.deadline();
      const left = deadline == null ? total : s.ended ? Math.max(0, deadline - (s.endedAt ?? now)) : Math.max(0, deadline - now);
      setMs(Math.ceil(left / 1000) * 1000);

      if (snap.bonus.seq !== lastBonus) {
        lastBonus = snap.bonus.seq;
        setBonusText(t('storm.run.bonus', { s: snap.bonus.ms / 1000 }));
        bonusY.set(reduced ? 0 : withSequence(withTiming(0, { duration: 0 }), withTiming(-BONUS_FLOAT.rise, { duration: BONUS_FLOAT.inMs + BONUS_FLOAT.holdMs + BONUS_FLOAT.outMs, easing: Easing.out(Easing.cubic) })));
        bonusOpacity.set(
          withSequence(
            withTiming(1, { duration: BONUS_FLOAT.inMs }),
            withDelay(BONUS_FLOAT.holdMs, withTiming(0, { duration: BONUS_FLOAT.outMs })),
          ),
        );
      }

      if (deadline == null || s.ended) {
        frac.set(withTiming(Math.min(1, left / total), BAR_JUMP));
        return;
      }
      // The bar: jump to the right spot when the deadline moved, then drain linearly.
      const f = Math.min(1, left / total);
      if (deadline !== lastDeadline) {
        frac.set(withSequence(withTiming(f, BAR_JUMP), withTiming(0, { duration: Math.max(0, left - BAR_JUMP.duration!), easing: Easing.linear })));
        lastDeadline = deadline;
      }
      const sec = Math.ceil(left / 1000);
      if (left <= WARN_TIME_MS && left > 0 && !warned) {
        warned = true;
        feel.emit('timerWarning');
      }
      if (left > WARN_TIME_MS) warned = false;
      if (sec > 0 && sec <= TICK_LAST_S && sec !== lastTick) {
        lastTick = sec;
        feel.emit('timerTick');
      }
      if (left <= 0) {
        run.tick(now);
        return;
      }
      timer = setTimeout(sync, (left % 1000 || 1000) + 5);
    };

    const unsub = run.subscribe(sync);
    sync();
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [run, total, t, reduced, frac, bonusOpacity, bonusY]);

  const low = ms <= LOW_TIME_MS;
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, frac.get())) * 100}%` }));
  const float = useAnimatedStyle(() => ({ opacity: bonusOpacity.get(), transform: [{ translateY: bonusY.get() }] }));
  const text = clockText(ms);

  return (
    <>
      <View style={styles.flex}>
        <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityLabel={t('storm.run.time_a11y', { time: text })} accessibilityValue={{ min: 0, max: 100, now: Math.round((ms / total) * 100) }}>
          <Animated.View style={[styles.fill, fill]}>
            <LinearGradient
              colors={low ? [eos.embers, tone.emberGlow] : [tone.lockRim, eos.bone]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
      <View>
        <AppText variant="timer" color={low ? tone.rose : eos.bone} style={styles.time} testID="storm-run-timer">
          {text}
        </AppText>
        <Animated.View pointerEvents="none" style={[styles.bonus, float]}>
          <EmberChip testID="storm-run-bonus">
            <AppText variant="captionStrong" color={tone.blush}>
              {bonusText}
            </AppText>
          </EmberChip>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  center: { alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: layout.gutter },
  centerText: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  exit: { width: 44, height: 44, borderRadius: radii.control, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: radii.full, backgroundColor: eos.well, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radii.full, overflow: 'hidden' },
  time: { minWidth: 52, marginRight: space[2], textAlign: 'right' },
  bonus: { position: 'absolute', right: space[2], top: 30, alignItems: 'flex-end' },
  scoreRow: { height: 82, paddingTop: space[2.5], paddingBottom: space[3], paddingHorizontal: layout.gutter, flexDirection: 'row', alignItems: 'center', gap: space[3.5] },
  tinyLabel: { fontSize: 10 },
  score: { fontVariant: ['tabular-nums'] },
  comboLine: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  comboText: { fontWeight: '800' },
  steps: { marginTop: space[2], flexDirection: 'row', gap: 3 },
  step: { flex: 1, height: 5, borderRadius: radii.sm, backgroundColor: eos.rise },
  stepOn: { backgroundColor: eos.ember },
  livesBox: { alignItems: 'flex-end' },
  lives: { marginTop: space[1], flexDirection: 'row', gap: 3 },
  puzzleLine: { marginTop: space[4], marginHorizontal: layout.gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineText: { fontSize: 13 },
  tabular: { fontVariant: ['tabular-nums'] },
  history: { marginTop: space[2.5], marginHorizontal: layout.gutter, flexDirection: 'row', flexWrap: 'wrap', gap: space[1] },
  sq: { width: 16, height: 16, borderRadius: 3 },
  footer: { textAlign: 'center', marginTop: space[2], paddingHorizontal: layout.gutter },
});

import { comboBar, STORM_COMBO_BONUS, STORM_LIVES, STORM_MAX_LEVEL, stormClockMs, type StormFormat, type StormStreamResponse } from '@tac/core/storm';
import { alpha, eos, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { memo, useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
import { COMBO_MOTION } from '@/features/storm/motion';
import { Heart } from '@/features/storm/parts';
import type { StormRun } from '@/features/storm/run';
import { useStormClock, useStormRunScreen, useStormStream } from '@/features/storm/RunScreen';
import { PlateButton } from '@/ui';
import { useT } from '@/ui/lang';
import { useHotkeys } from '../hotkeys';
import { Card, DText, GhostButton, KeyHints, Label, Tile } from '../kit';
import { dx } from '../tokens';
import { Spacer, TurnCard } from './parts';
import { BoardStage, StageMessage } from './Stage';

// /storm/run on a desktop-wide window (canvas DXStormRun): the board left;
// right the lives, the big clock card with its bar, score and combo tiles,
// the turn card and the run's ratings so far. The run, its engine and the
// quit guard are the phone screen's (useStormRunScreen).

const SEGMENTS = 5;
/** The run history scrolls past this height (a long Survival run); it keeps the newest in view. */
const HISTORY_MAX = 7 * 32;
/** Combo ink per level (the phone's meter escalates the same way): gold, then blush from level 2. */
const LEVEL_INK = [tone.gold, tone.gold, tone.blush, tone.blush];

export function DxStormRun({ challengeId, format }: { challengeId: string | null; format: StormFormat }) {
  const t = useT();
  const { load, retry } = useStormStream(challengeId);
  if (load.status === 'ready') return <Run stream={load.stream} format={format} challengeId={challengeId} />;
  return (
    <StageMessage testID="storm-run-loading">
      {load.status === 'loading' ? (
        <>
          <ActivityIndicator color={eos.ember} size="large" />
          <DText size={14} color={dx.ash}>
            {t('storm.run.loading')}
          </DText>
        </>
      ) : (
        <>
          <DText size={14} color={dx.ash} align="center" testID="storm-run-error">
            {t('storm.run.error')}
          </DText>
          <View style={styles.errorRow}>
            <PlateButton testID="storm-run-retry" label={t('storm.run.retry')} size="md" onPress={retry} />
            <PlateButton testID="storm-run-close" label={t('storm.run.close')} variant="slate" size="md" onPress={() => router.back()} />
          </View>
        </>
      )}
    </StageMessage>
  );
}

function Run({ stream, format, challengeId }: { stream: StormStreamResponse; format: StormFormat; challengeId: string | null }) {
  const t = useT();
  const { run, controller, p, onMove, ref, snap, s, timed, confirmQuit, shown } = useStormRunScreen(stream, format, challengeId);
  useHotkeys({ Escape: confirmQuit });

  const side = p.playerColor;
  const current = s.ended ? -1 : s.index;

  const panel = (
    <>
      <View style={styles.row}>
        <GhostButton testID="storm-run-exit" label={t('play.exit')} accessibilityLabel={t('storm.run.end_a11y')} icon={X} onPress={confirmQuit} />
        <Spacer />
        <View style={styles.hearts} accessible accessibilityRole="image" accessibilityLabel={t('storm.run.lives_a11y', { n: s.lives })} testID="storm-run-lives">
          {Array.from({ length: STORM_LIVES }, (_, i) => (
            <Heart key={i} on={i < s.lives} />
          ))}
        </View>
      </View>

      {timed ? (
        <ClockCard run={run} total={stormClockMs(format) ?? 1} />
      ) : (
        <Card texture style={styles.clockCard}>
          <DText size={18} weight={800} align="center" testID="storm-run-survival">
            {t('storm.run.survival')}
          </DText>
        </Card>
      )}

      <View style={styles.grid}>
        <Tile style={styles.flex}>
          <Label size={10}>{t('storm.run.score')}</Label>
          <DText size={40} weight={800} ls={-0.3} tabular style={styles.mt4} testID="storm-run-score">
            {String(s.score)}
          </DText>
        </Tile>
        <ComboTile combo={s.combo} levelUpSeq={snap.levelUp.seq} timed={timed} />
      </View>

      <TurnCard side={side} title={t(side === 'w' ? 'dx.board.white_moves' : 'dx.board.black_moves')} style={styles.turn}>
        <DText size={12.5} weight={700} color={dx.dust} tabular testID="storm-run-puzzle">
          {t('dx.board.puzzle_pill', { n: snap.shown + 1, rating: shown?.rating ?? '' })}
        </DText>
      </TurnCard>

      <View>
        <Label size={10} style={styles.mb10}>
          {t('dx.board.storm_solved')}
        </Label>
        <History
          results={s.results}
          current={current}
          stream={stream}
          label={t('storm.run.history_a11y', { solved: s.results.filter((r) => r.ok).length, missed: s.mistakes })}
        />
      </View>

      <Spacer />
      {E2E && <PracticeE2EStrip controller={controller} state={p} />}
      <DText size={12.5} color={dx.dust} align="center">
        {t('storm.run.footer')}
      </DText>
      <KeyHints items={[{ keys: ['Esc'], label: t('dx.board.key.close') }]} style={styles.hints} />
    </>
  );

  return (
    <BoardStage
      testID="storm-run"
      panelGap={16}
      board={(size) => <PracticeBoard controller={controller} boardRef={ref} onMove={onMove} loading={p.phase === 'idle'} size={size} />}
      panel={panel}
    />
  );
}

/**
 * The combo tile (canvas DXStormRun, behaviour of the phone ComboMeter):
 * ×N pops on every right move and bursts with a ring on a level-up; the
 * level pips by the label; the segments fill towards the next level and the
 * tile's edge breathes at the max; the line under it says what a move and a
 * solve are worth now or next (timed runs). Reduced motion: no pop, burst
 * or breathing.
 */
const ComboTile = memo(function ComboTile({ combo, levelUpSeq, timed }: { combo: number; levelUpSeq: number; timed: boolean }) {
  const t = useT();
  const reduced = useReducedMotion();
  const bar = comboBar(combo);
  const now = STORM_COMBO_BONUS[bar.level];
  const atMax = bar.level >= STORM_MAX_LEVEL;
  const filled = atMax ? SEGMENTS : Math.round(bar.progress * SEGMENTS);
  const ink = LEVEL_INK[bar.level] ?? tone.gold;

  const pop = useSharedValue(1);
  const burst = useSharedValue(0);
  const glow = useSharedValue(0);
  const prevCombo = useRef(combo);
  const prevSeq = useRef(levelUpSeq);

  useEffect(() => {
    const prev = prevCombo.current;
    prevCombo.current = combo;
    if (reduced || combo <= prev) return;
    pop.set(withSequence(withTiming(COMBO_MOTION.popScale, { duration: COMBO_MOTION.popMs }), withSpring(1, COMBO_MOTION.settle)));
  }, [combo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (levelUpSeq === prevSeq.current) return;
    prevSeq.current = levelUpSeq;
    if (reduced) return;
    burst.set(withSequence(withTiming(1, { duration: COMBO_MOTION.burstInMs }), withTiming(0, { duration: COMBO_MOTION.burstOutMs })));
  }, [levelUpSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    glow.set(atMax && !reduced ? withRepeat(withSequence(withTiming(1, COMBO_MOTION.breathe), withTiming(0.35, COMBO_MOTION.breathe)), -1) : withTiming(0, COMBO_MOTION.fill));
  }, [atMax]); // eslint-disable-line react-hooks/exhaustive-deps

  const numStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() + burst.get() * (COMBO_MOTION.burstScale - 1) }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: burst.get(), transform: [{ scale: 1 + burst.get() * 0.08 }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: Math.max(glow.get(), burst.get()) }));

  const line = atMax
    ? t('storm.run.combo_max', { move: now.moveMs / 1000, solve: now.solveMs / 1000 })
    : bar.level > 0
      ? t('storm.run.combo_now', { move: now.moveMs / 1000, solve: now.solveMs / 1000 })
      : t('storm.run.combo_next', { n: bar.nextAt ?? 0, move: (bar.next?.moveMs ?? 0) / 1000 });

  return (
    <Tile style={[styles.flex, styles.combo]} testID="storm-run-combo-meter">
      <Animated.View pointerEvents="none" style={[styles.comboGlow, glowStyle]} />
      <Animated.View pointerEvents="none" style={[styles.comboRing, { borderColor: ink }, ringStyle]} />
      <View style={styles.comboHead}>
        <Label size={10} color={ink}>
          {t('dx.board.combo')}
        </Label>
        <View style={styles.pips} testID="storm-run-combo-level">
          {Array.from({ length: STORM_MAX_LEVEL }, (_, i) => (
            <View key={i} style={[styles.pip, i < bar.level && { backgroundColor: ink }]} />
          ))}
        </View>
      </View>
      <Animated.View style={[styles.comboNum, numStyle]}>
        <DText
          size={40}
          weight={800}
          ls={-0.3}
          tabular
          color={ink}
          accessibilityLabel={t('storm.run.combo_a11y', { n: combo, level: bar.level, max: STORM_MAX_LEVEL })}
          testID="storm-run-combo"
        >
          {`×${combo}`}
        </DText>
      </Animated.View>
      <View style={styles.segments}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < filled ? ink : dx.barOff }]} />
        ))}
      </View>
      {timed ? (
        <DText size={11.5} weight={700} color={bar.level > 0 ? ink : dx.ash} numberOfLines={2} style={styles.mt6} testID="storm-run-combo-line">
          {line}
        </DText>
      ) : null}
    </Tile>
  );
});

/** Every result of the run as a rating chip (sage solved, rose missed), then the puzzle on the board, outlined. */
const History = memo(function History({
  results,
  current,
  stream,
  label,
}: {
  results: readonly { i: number; ok: boolean }[];
  current: number;
  stream: StormStreamResponse;
  label: string;
}) {
  const ref = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  return (
    <ScrollView
      ref={ref as never}
      style={styles.history}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: false })}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.chips} accessible accessibilityRole="image" accessibilityLabel={label} testID="storm-run-history">
        {results.map((r) => (
          <View key={r.i} style={styles.chip}>
            <DText size={11.5} weight={800} tabular color={r.ok ? eos.sage : tone.roseSoft}>
              {String(stream.puzzles[r.i]?.rating ?? '')}
            </DText>
          </View>
        ))}
        {current >= 0 ? (
          <View style={[styles.chip, styles.chipNow]} testID="storm-run-history-current">
            <DText size={11.5} weight={800} tabular color={eos.bone}>
              {String(stream.puzzles[current]?.rating ?? '')}
            </DText>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
});

/** The big m:ss over its bar; the bar drains on the UI thread, a bonus floats a chip. */
function ClockCard({ run, total }: { run: StormRun; total: number }) {
  const t = useT();
  const { ms, low, fill, float, text, bonusText } = useStormClock(run, total);
  return (
    <Card texture style={styles.clockCard}>
      <DText
        size={64}
        lh={70}
        weight={800}
        ls={-0.3}
        tabular
        align="center"
        color={low ? tone.rose : eos.bone}
        testID="storm-run-timer"
        accessibilityLabel={t('storm.run.time_a11y', { time: text })}
      >
        {text}
      </DText>
      <View
        style={styles.track}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('storm.run.time_a11y', { time: text })}
        accessibilityValue={{ min: 0, max: 100, now: Math.round((ms / total) * 100) }}
      >
        <Animated.View style={[styles.fill, fill]}>
          <LinearGradient colors={low ? [eos.embers, tone.emberGlow] : [eos.ember, eos.rose]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <Animated.View pointerEvents="none" style={[styles.bonus, float]}>
        <View style={styles.bonusChip}>
          <DText size={12.5} weight={800} color={tone.blush} testID="storm-run-bonus">
            {bonusText}
          </DText>
        </View>
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt4: { marginTop: 4 },
  mb10: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  hearts: { flexDirection: 'row', gap: 4 },
  clockCard: { padding: 22 },
  track: { height: 8, marginTop: 12, borderRadius: 999, backgroundColor: dx.track, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999, overflow: 'hidden' },
  bonus: { position: 'absolute', right: 18, top: 18 },
  bonusChip: { height: 26, paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center', backgroundColor: alpha(eos.ember, 0.3) },
  grid: { flexDirection: 'row', gap: 12 },
  mt6: { marginTop: 6 },
  combo: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: alpha(tone.gold, 0.5), inset: true }] },
  comboGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 12,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 18, spreadDistance: 0, color: alpha(tone.blush, 0.35) },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: alpha(tone.blush, 0.8), inset: true },
    ],
  },
  comboRing: { ...StyleSheet.absoluteFill, borderRadius: 12, borderWidth: 2 },
  comboHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  comboNum: { alignSelf: 'flex-start', marginTop: 4, transformOrigin: 'left center' },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 6, height: 6, borderRadius: 3, backgroundColor: alpha(eos.bone, 0.18) },
  segments: { flexDirection: 'row', gap: 4, marginTop: 6 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  turn: { paddingVertical: 14, paddingHorizontal: 16 },
  history: { maxHeight: HISTORY_MAX, flexGrow: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 26, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center', backgroundColor: dx.card2 },
  chipNow: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: eos.bone, inset: true }] },
  hints: { gap: 14 },
  errorRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
});

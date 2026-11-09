import { comboBar, STORM_LIVES, STORM_MAX_LEVEL, stormClockMs, type StormFormat, type StormStreamResponse } from '@tac/core/storm';
import { alpha, eos, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { E2E, PracticeE2EStrip } from '@/features/review/practice/E2EStrip';
import { PracticeBoard } from '@/features/review/practice/PracticeBoard';
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

/** Latest results shown as chips (a long Survival run would overflow). */
const CHIPS = 35;
const SEGMENTS = 5;

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

  const bar = comboBar(s.combo);
  const filled = bar.level >= STORM_MAX_LEVEL ? SEGMENTS : Math.round(bar.progress * SEGMENTS);
  const side = p.playerColor;
  const results = s.results.slice(-CHIPS);

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
        <Tile style={[styles.flex, styles.combo]}>
          <Label size={10} color={tone.gold}>
            {t('dx.board.combo')}
          </Label>
          <DText
            size={40}
            weight={800}
            ls={-0.3}
            tabular
            color={tone.gold}
            style={styles.mt4}
            accessibilityLabel={t('storm.run.combo_a11y', { n: s.combo, level: bar.level, max: STORM_MAX_LEVEL })}
            testID="storm-run-combo"
          >
            {`×${s.combo}`}
          </DText>
          <View style={styles.segments}>
            {Array.from({ length: SEGMENTS }, (_, i) => (
              <View key={i} style={[styles.segment, { backgroundColor: i < filled ? tone.gold : dx.barOff }]} />
            ))}
          </View>
        </Tile>
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
        <View
          style={styles.chips}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('storm.run.history_a11y', { solved: s.results.filter((r) => r.ok).length, missed: s.mistakes })}
          testID="storm-run-history"
        >
          {results.map((r) => (
            <View key={r.i} style={styles.chip}>
              <DText size={11.5} weight={800} tabular color={r.ok ? eos.sage : tone.roseSoft}>
                {String(stream.puzzles[r.i]?.rating ?? '')}
              </DText>
            </View>
          ))}
        </View>
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
  combo: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: alpha(tone.gold, 0.5), inset: true }] },
  segments: { flexDirection: 'row', gap: 4, marginTop: 6 },
  segment: { flex: 1, height: 5, borderRadius: 3 },
  turn: { paddingVertical: 14, paddingHorizontal: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 26, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center', backgroundColor: dx.card2 },
  hints: { gap: 14 },
  errorRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
});

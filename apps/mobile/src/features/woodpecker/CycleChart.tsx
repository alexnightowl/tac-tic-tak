import { alpha, eos, radii, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui';
import { useT } from '@/ui/lang';
import { clock, type CycleBar } from './model';

/** The last cycles shown (older ones fall off the left). */
const MAX_BARS = 8;

/**
 * Average seconds a puzzle per cycle (one series, so no legend box): a
 * bar per cycle anchored at the baseline, its own target as a bone tick
 * across the bar's slot, the time above and the clean share below. The
 * cycle in progress is a paler bar. Phone set page and desktop
 * DxWoodpecker (`height` differs).
 */
export function CycleChart({ bars, height = 132, testID }: { bars: readonly CycleBar[]; height?: number; testID: string }) {
  const t = useT();
  const shown = bars.filter((b) => b.avgSec != null).slice(-MAX_BARS);
  if (shown.length === 0) {
    return (
      <AppText variant="caption" color={eos.dust} style={styles.empty} testID={`${testID}-empty`}>
        {t('woodpecker.history_empty')}
      </AppText>
    );
  }
  const top = Math.max(1, ...shown.map((b) => Math.max(b.avgSec ?? 0, b.target ?? 0))) * 1.12;
  const y = (sec: number) => Math.round((sec / top) * height);
  return (
    <View testID={testID}>
      <View style={[styles.plot, { height }]}>
        {shown.map((b) => {
          const avg = b.avgSec ?? 0;
          const met = b.target != null && avg <= b.target;
          // The time sits over the bar, or over the target tick when the two would touch.
          const tick = b.target != null ? y(b.target) : null;
          const labelAt = tick != null && tick >= y(avg) - 6 && tick - y(avg) < 22 ? tick + 4 : y(avg) + 4;
          return (
            <View
              key={b.cycle}
              style={styles.slot}
              accessible
              accessibilityLabel={t('woodpecker.history_a11y', { n: b.cycle, avg: clock(avg), clean: b.cleanPct ?? 0 })}
              testID={`${testID}-bar-${b.cycle}`}
            >
              <AppText variant="captionStrong" color={met ? tone.sage : eos.bone} style={[styles.value, { bottom: labelAt }]} numberOfLines={1}>
                {clock(avg)}
              </AppText>
              <View style={[styles.bar, { height: Math.max(4, y(avg)) }, !b.complete && styles.barNow]}>
                {b.complete ? <LinearGradient colors={[tone.sealTop, tone.emberDeep]} style={StyleSheet.absoluteFill} /> : null}
              </View>
              {b.target != null ? <View style={[styles.target, { bottom: y(b.target) }]} /> : null}
            </View>
          );
        })}
      </View>
      <View style={styles.axis} />
      <View style={styles.labels}>
        {shown.map((b) => (
          <View key={b.cycle} style={styles.slot}>
            <AppText variant="captionStrong" color={b.complete ? eos.bone : eos.ash} numberOfLines={1} style={styles.center}>
              {t('woodpecker.cycle', { n: b.cycle })}
            </AppText>
            <AppText variant="caption" color={eos.dust} numberOfLines={1} style={[styles.center, styles.small]}>
              {b.complete ? t('woodpecker.history_clean', { pct: b.cleanPct ?? 0 }) : t('woodpecker.history_now')}
            </AppText>
          </View>
        ))}
      </View>
      {shown.some((b) => b.target != null) ? (
        <View style={styles.legend}>
          <View style={styles.legendTick} />
          <AppText variant="caption" color={eos.ash}>
            {t('woodpecker.history_target')}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 12 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  slot: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  value: { position: 'absolute', fontVariant: ['tabular-nums'] },
  bar: { width: '62%', maxWidth: 44, borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: 'hidden' },
  barNow: { backgroundColor: alpha(eos.ember, 0.45) },
  target: { position: 'absolute', width: 64, maxWidth: '90%', height: 2, borderRadius: radii.full, backgroundColor: alpha(eos.bone, 0.8) },
  axis: { height: 1, backgroundColor: eos.seam },
  labels: { flexDirection: 'row', gap: 2, marginTop: 6 },
  center: { textAlign: 'center' },
  small: { fontSize: 11, lineHeight: 14 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  legendTick: { width: 14, height: 2, borderRadius: radii.full, backgroundColor: alpha(eos.bone, 0.8) },
});

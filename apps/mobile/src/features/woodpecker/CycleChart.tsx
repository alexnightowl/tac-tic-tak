import type { WoodpeckerCycle } from '@tac/core/library';
import { alpha, eos, radii, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { daysText } from './model';

/** The last cycles shown (older ones fall off the left). */
const MAX_BARS = 8;

/**
 * Days a cycle (one series, so no legend box): a bar per cycle anchored
 * at the baseline, its own target (half the days of the one before) as a
 * bone tick across the bar's slot, the days above and the clean share
 * below. The cycle in progress is a paler bar. Phone set page and desktop
 * DxWoodpecker (`height` differs).
 */
export function CycleChart({ cycles, height = 132, testID }: { cycles: readonly WoodpeckerCycle[]; height?: number; testID: string }) {
  const t = useT();
  const tn = useTn();
  const shown = cycles.slice(-MAX_BARS);
  if (shown.length === 0) {
    return (
      <AppText variant="caption" color={eos.dust} style={styles.empty} testID={`${testID}-empty`}>
        {t('woodpecker.history_empty')}
      </AppText>
    );
  }
  const top = Math.max(1, ...shown.map((c) => Math.max(c.days, c.target ?? 0))) * 1.15;
  const y = (days: number) => Math.round((days / top) * height);
  return (
    <View testID={testID}>
      <View style={[styles.plot, { height }]}>
        {shown.map((c) => {
          const met = c.target != null && c.days <= c.target;
          // The days sit over the bar, or over the target tick when the two would touch.
          const tick = c.target != null ? y(c.target) : null;
          const labelAt = tick != null && tick >= y(c.days) - 6 && tick - y(c.days) < 22 ? tick + 4 : y(c.days) + 4;
          return (
            <View
              key={c.cycle}
              style={styles.slot}
              accessible
              accessibilityLabel={t('woodpecker.history_a11y', { n: c.cycle, days: daysText(tn, c.days), clean: c.cleanPct ?? 0 })}
              testID={`${testID}-bar-${c.cycle}`}
            >
              <AppText variant="captionStrong" color={met ? tone.sage : eos.bone} style={[styles.value, { bottom: labelAt }]} numberOfLines={1}>
                {String(c.days)}
              </AppText>
              <View style={[styles.bar, { height: Math.max(4, y(c.days)) }, !c.complete && styles.barNow]}>
                {c.complete ? <LinearGradient colors={[tone.sealTop, tone.emberDeep]} style={StyleSheet.absoluteFill} /> : null}
              </View>
              {c.target != null ? <View style={[styles.target, { bottom: y(c.target) }]} /> : null}
            </View>
          );
        })}
      </View>
      <View style={styles.axis} />
      <View style={styles.labels}>
        {shown.map((c) => (
          <View key={c.cycle} style={styles.labelSlot}>
            <AppText variant="captionStrong" color={c.complete ? eos.bone : eos.ash} numberOfLines={1} style={styles.center}>
              {t('woodpecker.cycle', { n: c.cycle })}
            </AppText>
            <AppText variant="caption" color={eos.dust} numberOfLines={1} style={[styles.center, styles.small]}>
              {c.complete ? t('woodpecker.history_clean', { pct: c.cleanPct ?? 0 }) : t('woodpecker.history_now')}
            </AppText>
          </View>
        ))}
      </View>
      {shown.some((c) => c.target != null) ? (
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
  // Labels size to their text: the bar slot's 100% height would fill the screen on native.
  labelSlot: { flex: 1, minWidth: 0, alignItems: 'center' },
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

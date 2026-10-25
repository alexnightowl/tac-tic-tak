import { UNLOCK_REWARD, type CriterionProgress, type TrainingStyle } from '@tac/core/rules';
import { control, eos, radii, semantic, space, surface, text } from '@tac/core/tokens';
import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui';
import type { PlayT } from '../strings';
import { ProgressBar, STRONG, TABULAR } from '../ui';

// The slot under the TurnCard (web CalibrationProgressBar /
// UnlockProgressBar / CriterionTick). Both share one shell so the slot
// keeps its shape when calibration ends and the level-up bar takes over.

export function CalibrationProgressBar({ done, total, style, t }: { done: number; total: number; style: TrainingStyle; t: PlayT }) {
  return (
    <View style={styles.shell} testID="runner-calibration-bar">
      <View style={styles.head}>
        <AppText variant="label">{t('calibration.bar_label')}</AppText>
        <AppText variant="caption" color={eos.ash} style={TABULAR}>
          <AppText variant="caption" color={eos.bone} style={STRONG}>
            {String(done)}
          </AppText>
          {` / ${total}`}
        </AppText>
      </View>
      <ProgressBar ratio={done / total} color={eos.ember} />
      <AppText variant="caption" color={eos.dust} numberOfLines={2}>
        {t('calibration.bar_hint', { style: t(`style.${style}.name`).toLowerCase() })}
      </AppText>
    </View>
  );
}

type Progress = { criteria: CriterionProgress[]; ratio: number; met: boolean };

/** Live level-up progress: recomputed from the runner counters after every attempt. */
export function UnlockProgressBar({ progress, unlockedTo, t }: { progress: Progress; unlockedTo: number; t: PlayT }) {
  const met = progress.met;
  return (
    <View style={[styles.shell, met ? styles.shellMet : null]} testID="runner-unlock-bar">
      <View style={styles.head}>
        <View style={styles.label}>
          {met && <Sparkles size={12} color={eos.ember} />}
          <AppText variant="label" testID="runner-unlock-label">
            {met ? t('unlock.met') : t('unlock.progress')}
          </AppText>
        </View>
        <AppText variant="caption" color={eos.dust} style={TABULAR}>
          {`${unlockedTo} → `}
          <AppText variant="caption" color={met ? eos.ember : eos.ash} style={met ? STRONG : undefined}>
            {String(unlockedTo + UNLOCK_REWARD)}
          </AppText>
        </AppText>
      </View>
      <ProgressBar ratio={progress.ratio} color={met ? eos.ember : control.gateBar[1]} testID="runner-unlock-progress" />
      <View style={styles.ticks}>
        {progress.criteria.map((c) => (
          <CriterionTick key={c.id} c={c} t={t} />
        ))}
      </View>
    </View>
  );
}

function CriterionTick({ c, t }: { c: CriterionProgress; t: PlayT }) {
  const label = t(`unlock.req_${c.id}`);
  const pct = Math.round(c.ratio * 100);
  return (
    <View
      style={[styles.tick, c.met ? styles.tickMet : null]}
      testID={`runner-criterion-${c.id}`}
      accessible
      accessibilityLabel={`${label} ${pct}%`}
    >
      <AppText variant="caption" color={c.met ? eos.sage : eos.dust} style={styles.tickLabel} numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="caption" color={c.met ? eos.sage : eos.dust} style={[STRONG, TABULAR, styles.tickLabel]} testID={`runner-criterion-${c.id}-pct`}>
        {`${pct}%`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
    backgroundColor: surface.floatCard,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    gap: space[1.5],
  },
  shellMet: { borderColor: control.dangerBorder, backgroundColor: control.dangerPressBg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  label: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], flexShrink: 1 },
  ticks: { flexDirection: 'row', gap: space[1.5], marginTop: space[0.5] },
  tick: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space[1],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  tickMet: { borderColor: control.sageTint16, backgroundColor: control.sageTint16 },
  tickLabel: { fontSize: text.label.fontSize - 1, lineHeight: text.label.fontSize + 1 },
});

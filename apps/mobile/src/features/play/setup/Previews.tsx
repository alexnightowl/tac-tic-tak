import { STYLE_FORMULAS, UNLOCK_REWARD, solvedTarget, type TrainingStyle } from '@tac/core/rules';
import { eos, radii, rank, semantic, space, surface } from '@tac/core/tokens';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/ui';
import type { TFn } from '@/ui/lang';
import { ProgressBar, STRONG, TABULAR } from '../ui';

// The card under the mode picker (web NextUnlockPreview /
// CalibrationPreview / ThemePracticeNote). One shell, so the form does not
// reflow when calibration ends and the level-up card takes over.

function Shell({ testID, children }: { testID: string; children: React.ReactNode }) {
  return (
    <View style={styles.shell} testID={testID}>
      {children}
    </View>
  );
}

export function NextUnlockPreview({ style, durationSec, unlockedTo, t }: { style: TrainingStyle; durationSec: number; unlockedTo: number; t: TFn }) {
  const f = STYLE_FORMULAS[style];
  const target = solvedTarget(style, durationSec);
  const reqs = [
    { id: 'solved', label: t('unlock.req_solved'), value: `≥ ${target}` },
    { id: 'accuracy', label: t('unlock.req_accuracy'), value: `≥ ${Math.round(f.accuracy * 100)}%` },
    { id: 'peak', label: t('unlock.req_peak'), value: `+${f.peakDelta}` },
  ];
  return (
    <Shell testID="setup-next-unlock">
      <View style={styles.head}>
        <AppText variant="label">{t('unlock.next_title')}</AppText>
        <AppText variant="body" color={eos.dust} style={styles.tabular}>
          {`${unlockedTo} → `}
          <AppText variant="body" color={eos.ember} style={styles.strong}>
            {String(unlockedTo + UNLOCK_REWARD)}
          </AppText>
        </AppText>
      </View>
      <View style={styles.reqs}>
        {reqs.map((r) => (
          <View key={r.id} style={styles.req} accessible accessibilityLabel={`${r.label} ${r.value}`} testID={`setup-req-${r.id}`}>
            <AppText variant="caption" style={styles.center}>
              {r.label}
            </AppText>
            <AppText variant="body" color={eos.bone} style={[styles.strong, styles.tabular]}>
              {r.value}
            </AppText>
          </View>
        ))}
      </View>
    </Shell>
  );
}

export function CalibrationPreview({ done, total, t }: { done: number; total: number; t: TFn }) {
  return (
    <Shell testID="setup-calibration-preview">
      <View style={styles.head}>
        <AppText variant="label">{t('calibration.preview_title')}</AppText>
        <AppText variant="body" color={eos.dust} style={styles.tabular}>
          <AppText variant="body" color={rank.intermediate.color} style={styles.strong}>
            {String(done)}
          </AppText>
          {` / ${total}`}
        </AppText>
      </View>
      <ProgressBar ratio={done / total} color={rank.intermediate.color} />
      <AppText variant="caption" color={eos.dust}>
        {t('calibration.preview_lede')}
      </AppText>
    </Shell>
  );
}

export function ThemePracticeNote({ t }: { t: TFn }) {
  return (
    <Shell testID="setup-theme-note">
      <AppText variant="label">{t('play.theme_practice_title')}</AppText>
      <AppText variant="caption">{t('play.theme_practice_hint')}</AppText>
    </Shell>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: semantic.borderSoft,
    backgroundColor: surface.floatCard,
    padding: space[4],
    gap: space[3],
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] },
  reqs: { flexDirection: 'row', gap: space[2] },
  req: {
    flex: 1,
    alignItems: 'center',
    gap: space[0.5],
    paddingVertical: space[2],
    paddingHorizontal: space[1.5],
    borderRadius: radii.lg,
    backgroundColor: eos.well,
  },
  center: { textAlign: 'center' },
  strong: STRONG,
  tabular: TABULAR,
});

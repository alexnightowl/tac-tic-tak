import { fmtResponseTime } from '@tac/core/format';
import type { FinishResponse } from '@tac/core/runner';
import { eos, layout, space } from '@tac/core/tokens';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Card, PlateButton } from '@/ui';
import type { PlayT } from '../strings';

// Basic Phase 2 summary (web SessionSummary minus the outcome cards and
// the rank ceremony, which are Phase 5): the stats grid, Home, Play again.

function Stat({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <Card style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="value" testID={`summary-${id}`}>
        {value}
      </AppText>
    </Card>
  );
}

export function Summary({
  summary,
  onHome,
  onPlayAgain,
  t,
}: {
  summary: FinishResponse;
  onHome: () => void;
  onPlayAgain: () => void;
  t: PlayT;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID="summary-screen"
      contentContainerStyle={[styles.root, { paddingTop: insets.top + space[10], paddingBottom: insets.bottom + space[6] }]}
    >
      <AppText variant="sectionTitle" style={styles.center}>
        {t('play.session_complete')}
      </AppText>
      {summary.early && (
        <Card style={styles.note} testID="summary-early">
          <AppText variant="turnTitle">{t('play.early_exit_title')}</AppText>
          <AppText variant="body" color={eos.ash}>
            {t('play.early_exit_hint')}
          </AppText>
        </Card>
      )}
      <View style={styles.grid}>
        <Stat id="solved" label={t('play.solved')} value={String(summary.solved)} />
        <Stat id="failed" label={t('play.failed')} value={String(summary.failed)} />
        <Stat id="accuracy" label={t('play.accuracy')} value={`${Math.round(summary.accuracy * 100)}%`} />
        <Stat id="avg" label={t('play.avg')} value={fmtResponseTime(summary.avgResponseMs)} />
        <Stat id="peak" label={t('play.peak')} value={String(summary.peakRating)} />
      </View>
      <View style={styles.buttons}>
        <PlateButton testID="summary-play-again" label={t('play.play_again')} onPress={onPlayAgain} size="lg" block />
        <PlateButton testID="summary-home" label={t('home')} onPress={onHome} variant="slate" block />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: layout.gutter, gap: space[5] },
  center: { textAlign: 'center' },
  note: { padding: space[4], gap: space[1] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  stat: { flexBasis: '48%', flexGrow: 1, padding: space[3], gap: space[1] },
  buttons: { gap: space[3] },
});

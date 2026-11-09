import { hasteMs, type TrainingStyle } from '@tac/core/rules';
import { eos, space, tone } from '@tac/core/tokens';
import { Gauge } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { NoteCard, STRONG, TABULAR } from '@/features/play/ui';
import { AppText } from '@/ui';
import { useLang, useT } from '@/ui/lang';
import { fmtSecs, hasteTipKey } from './model';

/**
 * Session summary (D40): "Hasty mistakes: 3 of 5", the style's threshold
 * and one tip. Shown when the session had mistakes (phone summary).
 */
export function HasteSummaryCard({ hasty, mistakes, style }: { hasty: number; mistakes: number; style: TrainingStyle }) {
  const t = useT();
  const { lang } = useLang();
  if (mistakes <= 0) return null;
  const secs = fmtSecs(hasteMs(style), lang, t);
  const lots = hasty * 2 >= mistakes && hasty > 0;
  return (
    <NoteCard tone={lots ? 'amber' : 'neutral'} style={styles.row} testID="summary-haste">
      <Gauge size={22} color={lots ? tone.gold : eos.ash} />
      <View style={styles.flex}>
        <AppText variant="body" color={lots ? tone.gold : eos.bone} style={[STRONG, TABULAR]} testID="summary-haste-title">
          {t('haste.summary_title', { hasty, total: mistakes })}
        </AppText>
        <AppText variant="caption" color={eos.ash}>
          {t('haste.summary_rule', { secs, style: t(`style.${style}.name`).toLowerCase() })}
        </AppText>
        <AppText variant="caption" color={eos.bone} style={styles.tip} testID="summary-haste-tip">
          {t(hasteTipKey(hasty, mistakes))}
        </AppText>
      </View>
    </NoteCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  flex: { flex: 1, minWidth: 0, gap: space[0.5] },
  tip: { marginTop: space[1] },
});

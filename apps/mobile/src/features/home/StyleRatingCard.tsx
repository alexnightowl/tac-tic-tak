import type { TrainingStyle } from '@tac/core/rules';
import { eos, space } from '@tac/core/tokens';
import { StyleSheet, View } from 'react-native';

import { CountTo } from '@/features/play/runner/CountTo';
import { StyleIcon, TABULAR } from '@/features/play/ui';
import { useAppStore } from '@/stores/appStore';
import { AppText, Card } from '@/ui';
import type { TFn } from '@/ui/lang';

/**
 * web dashboard StyleRatingCard: style, rating, norm. Mobile adds the
 * change since Home last showed it: the number counts up from the old
 * value and a +N / −N chip says by how much.
 */
export function StyleRatingCard({ style, seen, t }: { style: TrainingStyle; seen: number | undefined; t: TFn }) {
  const prog = useAppStore((s) => s.progressions[style]);
  const rating = prog.currentPuzzleRating;
  const delta = seen == null ? 0 : rating - seen;
  return (
    <Card style={styles.card} testID={`home-style-${style}`}>
      <View style={styles.head}>
        <StyleIcon style={style} size={15} color={eos.ash} />
        <AppText variant="label" numberOfLines={1} style={styles.shrink}>
          {t(`style.${style}.name`)}
        </AppText>
      </View>
      <View style={styles.valueRow}>
        {delta !== 0 ? (
          <CountTo from={seen!} to={rating} variant="value" testID={`home-rating-${style}`} />
        ) : (
          <AppText variant="value" testID={`home-rating-${style}`}>
            {String(rating)}
          </AppText>
        )}
        {delta !== 0 && (
          <AppText
            variant="label"
            color={delta > 0 ? eos.sage : eos.rose}
            style={[styles.delta, TABULAR]}
            testID={`home-delta-${style}`}
            accessibilityLabel={t('home.rating_delta_aria', { delta: `${delta > 0 ? '+' : '−'}${Math.abs(delta)}` })}
          >
            {`${delta > 0 ? '+' : '−'}${Math.abs(delta)}`}
          </AppText>
        )}
      </View>
      <AppText variant="label" color={eos.dust} style={[styles.norm, TABULAR]} numberOfLines={1} testID={`home-norm-${style}`}>
        {`${t('play.unlocked')} ${prog.unlockedStartRating}`}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: space[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], marginBottom: space[1.5] },
  shrink: { flexShrink: 1 },
  norm: { marginTop: space[1.5] },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
  delta: { marginLeft: 'auto' },
});

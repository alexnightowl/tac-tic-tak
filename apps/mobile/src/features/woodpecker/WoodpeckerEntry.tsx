import { eos, space } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Bird } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, CardRow, IconTile, ProgressBar } from '@/ui';
import { useT } from '@/ui/lang';
import { stateLine, stateProgress, useActiveSet } from './model';

/**
 * Play's "Woodpecker method" row (D41; no artboard, same row as Storm and
 * Review): the active set's phase and today's portion, or an invite to
 * start. Opens /woodpecker.
 */
export function WoodpeckerEntry() {
  const t = useT();
  const { view, summary, loading } = useActiveSet();
  const title = t('woodpecker.title');
  const subtitle = view ? stateLine(view, t) : summary || loading ? ' ' : t('woodpecker.entry.invite');
  const progress = view ? stateProgress(view) : null;
  return (
    <CardRow
      testID="play-woodpecker"
      accessibilityLabel={`${title}, ${subtitle}`}
      leading={
        <IconTile size={40}>
          <Bird size={20} color={eos.bone} strokeWidth={1.8} />
        </IconTile>
      }
      onPress={() => router.push('/woodpecker' as Href)}
    >
      <View style={styles.text}>
        <AppText variant="turnTitle" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" numberOfLines={1} style={styles.tabular} testID="play-woodpecker-state">
          {subtitle}
        </AppText>
        {progress != null ? <ProgressBar value={progress} height={3} style={styles.bar} /> : null}
      </View>
    </CardRow>
  );
}

const styles = StyleSheet.create({
  text: { flex: 1, minWidth: 0, gap: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
  bar: { marginTop: space[1.5] },
});

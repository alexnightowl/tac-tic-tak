import { router, type Href } from 'expo-router';
import { Bird } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ctaLabel, openSolve, stateLine, useActiveSet } from '@/features/woodpecker/model';
import { PlateButton } from '@/ui';
import { useT } from '@/ui/lang';
import { Bar, Card, DText, Hover, IconSquare } from '../kit';
import { dx } from '../tokens';

/**
 * DXPlay's "Woodpecker cycles" card (D40, under the setup): the active
 * set's cycle, progress and target, and the Continue plate; with no set,
 * the invite and Create. The text side opens /woodpecker.
 */
export function DxWoodpeckerCard() {
  const t = useT();
  const { view, summary, loading } = useActiveSet();
  const title = t('woodpecker.title');
  const sub = view ? stateLine(view, t) : summary || loading ? ' ' : t('woodpecker.entry.invite');
  const open = () => router.push('/woodpecker' as Href);
  return (
    <Card style={styles.card} testID="dx-play-woodpecker">
      <Hover testID="dx-play-woodpecker-open" accessibilityRole="link" accessibilityLabel={`${title}, ${sub}`} onPress={open} style={styles.main} hoverStyle={styles.mainHover}>
        <IconSquare icon={Bird} size={40} />
        <View style={styles.flex}>
          <DText serif weight={700} size={16} numberOfLines={1}>
            {title}
          </DText>
          <DText size={12.5} color={dx.ash} tabular numberOfLines={1} style={styles.mt2} testID="dx-play-woodpecker-state">
            {sub}
          </DText>
          {view && view.done > 0 && !view.complete ? <Bar value={view.done / view.total} height={4} style={styles.bar} /> : null}
        </View>
      </Hover>
      {view ? (
        <PlateButton testID="dx-play-woodpecker-cta" label={ctaLabel(view, t, true)} variant="slate" size="sm" onPress={() => openSolve(view.set.id, view.next)} />
      ) : !summary && !loading ? (
        <PlateButton testID="dx-play-woodpecker-create" label={t('woodpecker.entry.create')} variant="slate" size="sm" onPress={open} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt2: { marginTop: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, paddingLeft: 14, paddingRight: 20 },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 6, borderRadius: 10 },
  mainHover: { backgroundColor: dx.ghostHover },
  bar: { marginTop: 8, maxWidth: 360 },
});

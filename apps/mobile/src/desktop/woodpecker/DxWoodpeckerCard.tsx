import { router, type Href } from 'expo-router';
import { Bird } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useStartMethod } from '@/features/woodpecker/create';
import { ctaLabel, cycleToSolve, openSolve, stateLine, stateProgress, useActiveSet } from '@/features/woodpecker/model';
import { PlateButton } from '@/ui';
import { useT } from '@/ui/lang';
import { Bar, Card, DText, Hover, IconSquare } from '../kit';
import { dx } from '../tokens';

/**
 * DXPlay's "Woodpecker method" card (D41, under the setup): the active
 * set's phase and today's portion, and the Continue plate; with no set,
 * the invite and Start. The text side opens /woodpecker.
 */
export function DxWoodpeckerCard() {
  const t = useT();
  const { view, summary, loading } = useActiveSet();
  const start = useStartMethod(null, () => router.push('/woodpecker' as Href));
  const title = t('woodpecker.title');
  const sub = view ? stateLine(view, t) : summary || loading ? ' ' : t('woodpecker.entry.invite');
  const progress = view ? stateProgress(view) : null;
  const cycle = view ? cycleToSolve(view.status) : null;
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
          {progress != null ? <Bar value={progress} height={4} style={styles.bar} /> : null}
        </View>
      </Hover>
      {view ? (
        cycle != null ? (
          <PlateButton testID="dx-play-woodpecker-cta" label={ctaLabel(view, t)} variant="slate" size="sm" onPress={() => openSolve(view.set.id, cycle)} style={styles.cta} />
        ) : null
      ) : !summary && !loading ? (
        <PlateButton
          testID="dx-play-woodpecker-create"
          label={start.busy ? t('woodpecker.starting') : t('woodpecker.entry.start')}
          loading={start.busy}
          variant="slate"
          size="sm"
          onPress={start.start}
          style={styles.cta}
        />
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
  // PlateButton is inline (flex-start) by default: centre it on the row.
  cta: { alignSelf: 'center' },
});

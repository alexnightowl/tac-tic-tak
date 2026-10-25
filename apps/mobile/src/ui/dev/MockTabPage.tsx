import { eos, layout, space } from '@tac/core/tokens';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '../AppText';
import { useT } from '../lang';
import { PlateButton } from '../PlateButton';
import { useUiT } from '../strings';
import { Card, HeroCard } from '../Surfaces';
import { DevLangSwitch } from './devLang';
import { useDevT } from './devStrings';

// The five tabs of PLAN §2.3 / §8 #3, shared by both tab-bar mocks.
export const MOCK_TABS = [
  { name: 'index', key: 'home', sf: 'house.fill', md: 'home' },
  { name: 'play', key: 'play', sf: 'bolt.fill', md: 'bolt' },
  { name: 'review', key: 'review', sf: 'book.fill', md: 'menu_book' },
  { name: 'stats', key: 'stats', sf: 'chart.bar.fill', md: 'bar_chart' },
  { name: 'social', key: 'nav.social', sf: 'person.2.fill', md: 'group' },
] as const;

export type MockTabName = (typeof MOCK_TABS)[number]['name'];

/** Placeholder tab content: enough surface to judge the bar against. */
export function MockTabPage({ tab, prefix }: { tab: MockTabName; prefix: string }) {
  const t = useT();
  const ui = useUiT();
  const d = useDevT();
  const meta = MOCK_TABS.find((m) => m.name === tab)!;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.page}
      style={styles.root}
      testID={`${prefix}-page-${tab}`}
    >
      <DevLangSwitch testID={`${prefix}-lang`} />
      <HeroCard>
        <AppText variant="eyebrow">{prefix === 'tn' ? d('native') : d('custom')}</AppText>
        <AppText variant="sectionTitle">{ui(meta.key)}</AppText>
        <AppText variant="body" style={styles.mt}>
          {d('mockBody')}
        </AppText>
      </HeroCard>
      <View style={styles.row}>
        <Card style={styles.flex}>
          <AppText variant="label">{t('stats.lifetime.solved')}</AppText>
          <AppText variant="value">1 284</AppText>
        </Card>
        <Card style={styles.flex}>
          <AppText variant="label">{t('stats.lifetime.accuracy')}</AppText>
          <AppText variant="value">87%</AppText>
        </Card>
      </View>
      <PlateButton block size="lg" label={t('play.new_session')} testID={`${prefix}-cta-${tab}`} />
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={i}>
          <AppText variant="title">{t('stats.recommend')}</AppText>
          <AppText variant="body" style={styles.mt}>
            {t('stats.rating_history_hint')}
          </AppText>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  page: { padding: layout.gutter, gap: space[4], paddingBottom: space[10] },
  row: { flexDirection: 'row', gap: space[3] },
  flex: { flex: 1 },
  mt: { marginTop: space[2] },
});

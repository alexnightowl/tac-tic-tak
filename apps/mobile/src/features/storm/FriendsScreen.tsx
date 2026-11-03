import { eos, layout, space } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackLink } from '@/features/courses/parts';
import { AppText, Card } from '@/ui';
import { useT } from '@/ui/lang';
import { useStormSummary } from './api';
import { WeekRow } from './StartScreen';

// /storm/friends (app-only; the canvas has no artboard): the whole "This
// week among friends" list behind Start's "All". Same rows as Start.

export function FriendsScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const q = useStormSummary();
  const week = q.data?.week ?? [];
  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="storm-friends">
      <View style={styles.header}>
        <BackLink
          testID="storm-friends-back"
          label={t('storm.title')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/storm' as Href))}
        />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(space[6], insets.bottom) }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={eos.ash} />}
      >
        <AppText variant="heading" accessibilityRole="header">
          {t('storm.friends_title')}
        </AppText>
        <AppText variant="body" color={eos.ash} style={styles.sub}>
          {t('storm.friends_sub')}
        </AppText>
        {!q.data && q.isPending ? (
          <ActivityIndicator color={eos.ash} style={styles.spinner} />
        ) : (
          <Card padding={0} style={styles.list} testID="storm-friends-list">
            {week.length === 0 ? (
              <AppText variant="caption" color={eos.ash} style={styles.empty} testID="storm-friends-empty">
                {t('storm.week_empty')}
              </AppText>
            ) : (
              week.map((row, i) => <WeekRow key={row.user.id} row={row} pos={i + 1} seam={i > 0} />)
            )}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: layout.gutter, paddingTop: space[1] },
  sub: { marginTop: space[1] },
  spinner: { marginTop: space[8] },
  list: { marginTop: space[4], overflow: 'hidden' },
  empty: { padding: space[3.5] },
});

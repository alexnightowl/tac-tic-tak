import type { ReviewThemeRow } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { eos, layout, radii, space } from '@tac/core/tokens';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, type Href } from 'expo-router';
import { BookOpen, ChevronRight, CloudOff, PartyPopper } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { feel } from '@/feel';
import { queryClient } from '@/platform/query';
import { AppText, Card } from '@/ui';
import { useLang, useT, useTn } from '@/ui/lang';
import { platePressTiming } from '@/ui/motion';
import { Tap } from '@/ui/Tap';
import { reviewApi, reviewKeys } from './api';
import { Skeleton, StateView } from './states';
import { ThemeIcon } from './ThemeIcon';

/** B9 adds firstPuzzleId to /review/themes; until then the tap fetches the theme's list. */
type ThemeRow = ReviewThemeRow & { firstPuzzleId?: string };

const SKELETONS = [0, 1, 2, 3, 4];

/**
 * Review tab (web /review): theme cards, most-failed first. fix: the web
 * fired GET /review?theme= for every card on mount (N+1) and a tap before
 * it resolved went nowhere; here the list is fetched on tap (and reused by
 * the drill's counter), or skipped once B9 sends firstPuzzleId.
 */
export function ReviewTabScreen() {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const q = useQuery({
    queryKey: reviewKeys.themes(),
    queryFn: () => reviewApi.themes() as Promise<ThemeRow[]>,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  // Tabs stay mounted, so a mount refetch never runs again: a session that
  // just added misses would leave this list stale. Refetch on focus once
  // the cached list is past its staleTime (the web remounted the page).
  useFocusEffect(
    useCallback(() => {
      const key = reviewKeys.themes();
      if (queryClient.getQueryState(key)?.status !== 'success') return;
      void queryClient.refetchQueries({ queryKey: key, stale: true, type: 'active' });
    }, []),
  );

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const open = async (row: ThemeRow) => {
    if (opening) return;
    let id = row.firstPuzzleId ?? null;
    if (!id) {
      setOpening(row.slug);
      try {
        const list = await queryClient.fetchQuery({
          queryKey: reviewKeys.list(row.slug),
          queryFn: () => reviewApi.list(row.slug),
          staleTime: 30_000,
        });
        id = list[0]?.puzzleId ?? null;
      } catch {
        id = null;
      } finally {
        setOpening(null);
      }
    }
    if (id) router.push(`/review/${encodeURIComponent(id)}?theme=${encodeURIComponent(row.slug)}` as Href);
    else void q.refetch();
  };

  const header = (
    <View style={styles.header}>
      <AppText variant="title" accessibilityRole="header" testID="review-title">
        {t('review.title')}
      </AppText>
      <AppText variant="body" color={eos.ash}>
        {t('review.subtitle_themes')}
      </AppText>
      <HistoryLink t={t} />
    </View>
  );

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={eos.ember} colors={[eos.ember]} />;

  let body;
  if (q.isPending) {
    body = (
      <View style={styles.list} testID="review-loading">
        {header}
        {SKELETONS.map((i) => (
          <Skeleton key={i} style={styles.skeleton} />
        ))}
      </View>
    );
  } else if (q.isError && !q.data) {
    body = (
      <View style={styles.list}>
        {header}
        <StateView
          testID="review-error"
          icon={<CloudOff size={24} color={eos.ash} />}
          title={t('review.error_title')}
          body={t('review.error_hint')}
          action={{
            label: t('review.retry_load'),
            testID: 'review-retry',
            onPress: () => void q.refetch(),
          }}
        />
      </View>
    );
  } else {
    body = (
      <FlashList
        data={q.data ?? []}
        keyExtractor={(r) => r.slug}
        renderItem={({ item }) => (
          <ThemeCard
            row={item}
            label={themeLabel(item.slug, lang)}
            noun={tn('review.puzzle_word', item.count)}
            opening={opening === item.slug}
            onPress={() => void open(item)}
            t={t}
          />
        )}
        ItemSeparatorComponent={Gap}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <StateView
            testID="review-empty"
            icon={<PartyPopper size={24} color={eos.sage} />}
            title={t('review.empty')}
            body={t('review.empty_hint')}
          />
        }
        contentContainerStyle={styles.listContent}
        refreshControl={refresh}
        // FlashList 2 anchors the first visible row by default: a refetch that
        // adds or drops a theme above it (a new miss, a cleared drill) scrolled
        // the tab away from its header.
        maintainVisibleContentPosition={{ disabled: true }}
        testID="review-list"
      />
    );
  }

  return (
    <View style={styles.root} testID="screen-review">
      {body}
    </View>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

function HistoryLink({ t }: { t: (k: string) => string }) {
  const pressed = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.03 * pressed.get() }],
  }));
  return (
    <Tap
      testID="review-history"
      accessibilityRole="link"
      accessibilityLabel={t('review.history_link')}
      onPress={() => router.push('/sessions' as Href)}
      pressed={pressed}
      pressedTiming={platePressTiming}
    >
      <Animated.View style={anim}>
        <Card style={styles.historyCard}>
          <View style={styles.tile}>
            <BookOpen size={20} color={eos.ash} />
          </View>
          <View style={styles.cardText}>
            <AppText variant="turnTitle" numberOfLines={1}>
              {t('review.history_link')}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {t('review.history_hint')}
            </AppText>
          </View>
          <ChevronRight size={18} color={eos.dust} />
        </Card>
      </Animated.View>
    </Tap>
  );
}

function ThemeCard({
  row,
  label,
  noun,
  opening,
  onPress,
  t,
}: {
  row: ThemeRow;
  label: string;
  noun: string;
  opening: boolean;
  onPress: () => void;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  // Press scale on the UI thread (no React state on the touch path).
  const pressed = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.03 * pressed.get() }],
  }));
  return (
    <Tap
      testID={`review-theme-${row.slug}`}
      accessibilityRole="button"
      accessibilityLabel={t('review.theme_card_a11y', {
        theme: label,
        count: row.count,
        noun,
        rating: row.minRating,
      })}
      onPress={onPress}
      pressed={pressed}
      pressedTiming={platePressTiming}
    >
      <Animated.View style={anim}>
        <Card style={styles.card}>
          <View style={styles.tile}>
            <ThemeIcon slug={row.slug} size={20} />
          </View>
          <View style={styles.cardText}>
            <AppText variant="turnTitle" numberOfLines={1}>
              {label}
            </AppText>
            <AppText variant="caption" numberOfLines={1} style={styles.tabular} testID={`review-theme-${row.slug}-meta`}>
              {`${row.count} ${noun} · ${t('review.theme_from')} ${row.minRating}`}
            </AppText>
          </View>
          {opening ? <ActivityIndicator color={eos.ember} /> : <ChevronRight size={18} color={eos.dust} />}
        </Card>
      </Animated.View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  list: { paddingHorizontal: layout.gutter, gap: space[2.5] },
  listContent: { paddingHorizontal: layout.gutter, paddingBottom: space[8] },
  header: { gap: space[1.5], paddingTop: space[4], paddingBottom: space[4] },
  gap: { height: space[2.5] },
  skeleton: { height: space[16] + space[2] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radii['2xl'],
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radii['2xl'],
    marginTop: space[3],
  },
  tile: {
    width: layout.themeTile,
    height: layout.themeTile,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: eos.rise,
  },
  cardText: { flex: 1, gap: space[0.5] },
  tabular: { fontVariant: ['tabular-nums'] },
});

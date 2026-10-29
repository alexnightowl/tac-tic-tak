import { queryKeys } from '@tac/core/api';
import { KNOWN_THEME_SLUGS, isMetaTheme, themeLabel } from '@tac/core/themes';
import { control, eos, layout, radii, rank, semantic, space, surface } from '@tac/core/tokens';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { Repeat, Search, Target, X, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { apiClient } from '@/platform/api';
import { AppText, Input, Segmented, useLang } from '@/ui';
import { fontFamily } from '@/ui/fonts';
import { Tap } from '@/ui/Tap';
import { useThemePick } from '../startSession';
import { usePlayT } from '../strings';
import { TABULAR } from '../ui';
import { ThemeIcon } from './ThemeIcon';

/** Design: theme names in Manrope 500, selected or not. */
const MEDIUM = { fontFamily: fontFamily('en', 'body', 500) } as const;

// play/theme-picker formSheet: web components/ThemePicker.tsx (weakest /
// popular / all tabs, search by localised label, stat chip per tab) on a
// FlashList. The pick goes to the shared useThemePick store.

type Tab = 'weakest' | 'popular' | 'all';
/** GET /analytics/themes row (analytics.service.ts ThemeRow). */
export type ThemeStatRow = { slug: string; attempts: number; failureRate: number; weakness: number; rating: number };

/** Same key and body as the stats screens, so the cache is shared. */
export const themeStatsQuery = {
  queryKey: queryKeys.analyticsThemes('all'),
  queryFn: () => apiClient.get<ThemeStatRow[]>('/analytics/themes'),
};

type Item = { slug: string; row?: ThemeStatRow };

export function ThemePickerSheet() {
  const t = usePlayT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const value = useThemePick((s) => s.theme);
  const setTheme = useThemePick((s) => s.setTheme);
  const [tab, setTab] = useState<Tab>('weakest');
  const [query, setQuery] = useState('');
  const stats = useQuery(themeStatsQuery);

  const tactical = (stats.data ?? []).filter((r) => !isMetaTheme(r.slug));
  const bySlug = new Map(tactical.map((r) => [r.slug, r]));
  let items: Item[];
  if (tab === 'weakest') items = [...tactical].sort((a, b) => b.weakness - a.weakness).map((r) => ({ slug: r.slug, row: r }));
  else if (tab === 'popular') items = [...tactical].sort((a, b) => b.attempts - a.attempts).map((r) => ({ slug: r.slug, row: r }));
  else {
    items = KNOWN_THEME_SLUGS.map((slug) => ({ slug, row: bySlug.get(slug) })).sort((a, b) =>
      themeLabel(a.slug, lang).localeCompare(themeLabel(b.slug, lang), lang === 'uk' ? 'uk' : 'en'),
    );
  }
  const q = query.trim().toLowerCase();
  if (q) items = items.filter((it) => themeLabel(it.slug, lang).toLowerCase().includes(q));
  const needsStats = tab === 'weakest' || tab === 'popular';
  const emptyStats = needsStats && stats.isSuccess && tactical.length === 0;

  // Opened by deep link (or restored after a reload) there is nothing
  // under the sheet: land on the setup instead.
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/play' as Href);
  };

  const pick = (slug: string) => {
    feel.emit('segmented');
    setTheme(slug);
    close();
  };

  let body;
  if (needsStats && stats.isPending) {
    body = <ActivityIndicator color={eos.ember} style={styles.state} testID="theme-picker-loading" />;
  } else if (needsStats && stats.isError) {
    body = (
      <View style={styles.state}>
        <AppText variant="caption" color={eos.dust} style={styles.center}>
          {t('play.themes_error')}
        </AppText>
        <Tap testID="theme-picker-retry" accessibilityRole="button" accessibilityLabel={t('home.retry')} onPress={() => void stats.refetch()} style={styles.retry}>
          <AppText variant="label" color={eos.bone}>
            {t('home.retry')}
          </AppText>
        </Tap>
      </View>
    );
  } else if (emptyStats) {
    body = (
      <AppText variant="caption" color={eos.dust} style={[styles.center, styles.state]} testID="theme-picker-no-stats">
        {t('play.themes_no_stats')}
      </AppText>
    );
  } else if (items.length === 0) {
    body = (
      <AppText variant="caption" color={eos.dust} style={[styles.center, styles.state]} testID="theme-picker-no-match">
        {t('play.no_themes_match')}
      </AppText>
    );
  } else {
    body = (
      <FlashList
        data={items}
        keyExtractor={(it) => it.slug}
        extraData={`${value}|${tab}|${lang}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + space[4] }}
        renderItem={({ item }) => (
          <ThemeRowView item={item} tab={tab} active={item.slug === value} lang={lang} t={t} onPick={pick} />
        )}
      />
    );
  }

  return (
    <View style={styles.root} testID="screen-theme-picker">
      {/* The full detent stops short of the status bar (the title stays readable). */}
      <Stack.Screen options={{ sheetAllowedDetents: [0.6, 0.94] }} />
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header" style={styles.flex} testID="screen-theme-picker-title">
          {t('play.choose_theme')}
        </AppText>
        <Tap testID="screen-theme-picker-close" accessibilityRole="button" accessibilityLabel={t('play.close')} onPress={close} style={styles.close}>
          <X size={22} color={eos.bone} />
        </Tap>
      </View>
      <View style={styles.controls}>
        <Segmented
          testID="theme-picker-tab"
          accessibilityLabel={t('play.choose_theme')}
          size="tight"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'weakest', label: t('play.themes_tab_weakest') },
            { value: 'popular', label: t('play.themes_tab_popular') },
            { value: 'all', label: t('play.themes_tab_all') },
          ]}
        />
        <Input
          testID="theme-picker-search"
          accessibilityLabel={t('play.search_themes')}
          placeholder={t('play.search_themes')}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          // The magnifier gives way to iOS's clear button once there is text.
          accessory={
            query ? undefined : (
              <View style={styles.searchIcon} pointerEvents="none">
                <Search size={18} color={eos.dust} strokeWidth={2} />
              </View>
            )
          }
        />
      </View>
      <View style={styles.list}>{body}</View>
    </View>
  );
}

function ThemeRowView({
  item,
  tab,
  active,
  lang,
  t,
  onPick,
}: {
  item: Item;
  tab: Tab;
  active: boolean;
  lang: 'en' | 'uk';
  t: ReturnType<typeof usePlayT>;
  onPick: (slug: string) => void;
}) {
  const label = themeLabel(item.slug, lang);
  const r = item.row;
  // One actionable number per lens (web): fail rate, volume, or rating.
  let stat: { text: string; aria: string; color: string; Icon: typeof XCircle } | null = null;
  if (r && tab === 'weakest') {
    const pct = Math.round(r.failureRate * 100);
    stat = { text: `${pct}%`, aria: t('play.theme_fail_aria', { pct }), color: pct >= 50 ? eos.rose : pct >= 25 ? rank.intermediate.color : eos.sage, Icon: XCircle };
  } else if (r && tab === 'popular') {
    stat = { text: String(r.attempts), aria: t('play.theme_attempts_aria', { n: r.attempts }), color: eos.ash, Icon: Repeat };
  } else if (r && tab === 'all' && r.rating > 0) {
    stat = { text: String(Math.round(r.rating)), aria: t('play.theme_rating_aria', { n: Math.round(r.rating) }), color: eos.ash, Icon: Target };
  }
  return (
    <Tap
      testID={`theme-row-${item.slug}`}
      accessibilityRole="button"
      accessibilityLabel={stat ? `${label}, ${stat.aria}` : label}
      accessibilityState={{ selected: active }}
      onPress={() => onPick(item.slug)}
      style={[styles.row, active ? styles.rowOn : styles.rowOff]}
    >
      <View style={[styles.tile, active ? styles.tileOn : styles.tileOff]}>
        <ThemeIcon slug={item.slug} size={16} color={active ? control.segmentedActiveText : eos.ash} />
      </View>
      <AppText variant="body" color={eos.bone} numberOfLines={1} style={[styles.flex, MEDIUM]}>
        {label}
      </AppText>
      {stat && (
        <View style={styles.stat}>
          <stat.Icon size={13} color={stat.color} strokeWidth={2} />
          <AppText variant="caption" color={stat.color} style={TABULAR}>
            {stat.text}
          </AppText>
        </View>
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.shade, paddingTop: space[6] },
  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: layout.gutter, paddingRight: space[2] },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  controls: { paddingHorizontal: layout.gutter, paddingTop: space[3], paddingBottom: space[3], gap: space[3] },
  searchIcon: { position: 'absolute', right: space[3], top: 0, bottom: 0, justifyContent: 'center' },
  list: { flex: 1, paddingHorizontal: layout.gutter },
  state: { paddingVertical: space[6], alignItems: 'center', gap: space[3] },
  retry: { height: space[10], paddingHorizontal: space[4], borderRadius: radii.lg, justifyContent: 'center', backgroundColor: control.ghostPressBg },
  row: {
    height: space[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    marginBottom: space[1],
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  rowOn: { backgroundColor: control.emberTint16, borderColor: control.dangerBorder },
  rowOff: { backgroundColor: surface.card, borderColor: semantic.borderSoft },
  tile: { width: space[7], height: space[7], borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  tileOn: { backgroundColor: eos.ember },
  tileOff: { backgroundColor: eos.rise },
  stat: { flexDirection: 'row', alignItems: 'center', gap: space[1], width: space[14], justifyContent: 'flex-end' },
});

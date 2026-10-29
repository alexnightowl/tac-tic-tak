import {
  achievementCategoryKey,
  achievementDescKey,
  achievementNameKey,
  type Achievement,
  type AchievementCategory,
} from '@tac/core/catalogs';
import { localeFor } from '@tac/core/format';
import { alpha, control, eos, graphite, layout, radii, shadows, space, surface, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { feel } from '@/feel';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { Chip } from '@/ui/Buttons';
import { ProgressBar } from '@/ui/IconTile';
import { useLang, useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { achievementsQuery, evaluateAchievements } from './api';
import { medalRank, SECTION_ORDER } from './art';
import { Medal } from './Medal';
import { readSeen, writeSeen } from './seen';

/** "Oct 25, 2026" (sheet) or, with `short`, "Oct 25" (grid, hero). */
export function formatUnlockDate(iso: string, lang: string, short = false): string {
  try {
    return new Date(iso).toLocaleDateString(
      localeFor(lang),
      short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' },
    );
  } catch {
    return iso;
  }
}

type Filter = 'all' | AchievementCategory;

/**
 * Achievements side of the Stats tab (design v2 MobAchievements): a slate
 * hero with the latest unlock and the collection bar, category chips, then
 * one 3-column medal grid per category in the canvas order. A medal opens
 * the detail sheet. Unlocks since the last visit wear the gold halo and a
 * "New · date" line once ("seen" slugs in MMKV).
 */
export function AchievementsGrid() {
  const t = useT();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const list = useQuery(achievementsQuery());
  const [refreshing, setRefreshing] = useState(false);

  // Mount-only catch-all evaluation (web).
  useEffect(() => {
    void evaluateAchievements();
  }, []);

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    await Promise.allSettled([list.refetch(), evaluateAchievements()]);
    setRefreshing(false);
  };

  if (!list.data) {
    return (
      <View style={styles.center} testID="achievements-loading">
        <AppText variant="body" color={eos.dust}>
          {list.isError ? t('achv.error') : t('achv.loading')}
        </AppText>
        {list.isError ? (
          <Tap
            testID="achievements-retry"
            accessibilityRole="button"
            accessibilityLabel={t('stats.retry')}
            onPress={() => void list.refetch()}
            style={styles.retry}
          >
            <AppText variant="label" color={eos.bone}>
              {t('stats.retry')}
            </AppText>
          </Tap>
        ) : null}
      </View>
    );
  }

  return <Collection list={list.data} userId={userId} refreshing={refreshing} onRefresh={onRefresh} />;
}

/** Unlocks since the last visit, fixed for this mount; the stored seen set
 *  is updated right away so each one is "new" only once. */
function freshUnlocks(list: Achievement[], userId: string): Set<string> {
  const unlocked = list.filter((a) => a.unlocked).map((a) => a.slug);
  const seen = readSeen(userId);
  writeSeen(userId, [...(seen ?? []), ...unlocked]);
  // First visit on this device: nothing counts as new.
  return new Set(seen ? unlocked.filter((s) => !seen.has(s)) : []);
}

function sections(list: Achievement[]) {
  return SECTION_ORDER.map((category) => ({
    category,
    items: list.filter((a) => a.category === category).sort((a, b) => medalRank(a.slug) - medalRank(b.slug)),
  })).filter((s) => s.items.length > 0);
}

function Collection({
  list,
  userId,
  refreshing,
  onRefresh,
}: {
  list: Achievement[];
  userId: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const t = useT();
  const [fresh] = useState(() => freshUnlocks(list, userId));
  const [filter, setFilter] = useState<Filter>('all');
  // Unlocks that land while the grid is open (evaluate, refresh) are seen too.
  useEffect(() => {
    writeSeen(userId, [...(readSeen(userId) ?? []), ...list.filter((a) => a.unlocked).map((a) => a.slug)]);
  }, [list, userId]);

  const groups = sections(list);
  const done = list.filter((a) => a.unlocked).length;
  const latest = list
    .filter((a) => a.unlocked && a.unlockedAt)
    .sort((a, b) => +new Date(b.unlockedAt!) - +new Date(a.unlockedAt!))[0];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={eos.ash} />}
      testID="achievements-grid"
    >
      <Hero latest={latest ?? null} done={done} total={list.length} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroller}
        contentContainerStyle={styles.chips}
        testID="achievements-chips"
      >
        <Chip
          label={t('achv.chip_all')}
          selected={filter === 'all'}
          onPress={() => setFilter('all')}
          testID="achievements-chip-all"
        />
        {groups.map((g) => (
          <Chip
            key={g.category}
            label={t(achievementCategoryKey(g.category))}
            selected={filter === g.category}
            onPress={() => setFilter(g.category)}
            testID={`achievements-chip-${g.category}`}
          />
        ))}
      </ScrollView>
      {groups
        .filter((g) => filter === 'all' || g.category === filter)
        .map((g) => (
          <View key={g.category} style={styles.section} testID={`achievements-section-${g.category}`}>
            <View style={styles.sectionHead}>
              <AppText variant="sectionLabel" accessibilityRole="header">
                {t(achievementCategoryKey(g.category))}
              </AppText>
              <AppText variant="captionStrong" color={graphite[600]} style={styles.tabular}>
                {`${g.items.filter((a) => a.unlocked).length} / ${g.items.length}`}
              </AppText>
            </View>
            <View style={styles.grid}>
              {g.items.map((a) => (
                <Tile key={a.slug} a={a} fresh={fresh.has(a.slug)} />
              ))}
            </View>
          </View>
        ))}
    </ScrollView>
  );
}

const SLATE = require('../../../assets/textures/slate.webp');

/** `.tx-slate` hero (radius 14 here, not the card's 12): latest medal (84
 *  in 96, gold halo), then the collection bar. */
function Hero({ latest, done, total }: { latest: Achievement | null; done: number; total: number }) {
  const t = useT();
  const { lang } = useLang();
  return (
    <View style={styles.hero} testID="achievements-progress">
      <Image source={SLATE} resizeMode="repeat" style={styles.heroFill} />
      <View pointerEvents="none" style={[styles.heroFill, styles.heroVeil]} />
      <View pointerEvents="none" style={styles.heroGlow} />
      {latest ? (
        <Tap
          testID="achievements-latest"
          accessibilityRole="button"
          accessibilityLabel={t('achv.open_a11y', {
            name: t(achievementNameKey(latest.slug)),
            state: t('achv.latest', { date: formatUnlockDate(latest.unlockedAt!, lang, true) }),
          })}
          onPress={() => openAchievement(latest.slug)}
          style={styles.latest}
        >
          <Medal slug={latest.slug} unlocked disc={84} glow />
          <View style={styles.flex}>
            <AppText variant="label" color={tone.gold}>
              {t('achv.latest', { date: formatUnlockDate(latest.unlockedAt!, lang, true) })}
            </AppText>
            <AppText variant="title" style={styles.latestName} numberOfLines={2}>
              {t(achievementNameKey(latest.slug))}
            </AppText>
            <AppText variant="body" color={eos.ash} style={styles.latestDesc}>
              {t(achievementDescKey(latest.slug))}
            </AppText>
          </View>
        </Tap>
      ) : null}
      <View style={[styles.collectionRow, latest ? styles.collectionGap : null]}>
        <AppText variant="label">{t('achv.collection')}</AppText>
        <View style={styles.count} accessible accessibilityLabel={t('achv.progress_value', { done, total })}>
          <AppText variant="bodyStrong" style={styles.countDone} testID="achievements-done">
            {String(done)}
          </AppText>
          <AppText variant="body" color={eos.ash} style={styles.countRest}>
            {' / '}
          </AppText>
          <AppText variant="body" color={eos.ash} style={styles.countRest} testID="achievements-total">
            {String(total)}
          </AppText>
        </View>
      </View>
      <ProgressBar
        value={total > 0 ? done / total : 0}
        colors={control.progressFlame}
        trackColor={eos.well}
        style={styles.bar}
      />
    </View>
  );
}

export function openAchievement(slug: string) {
  router.push({ pathname: '/achievement/[slug]', params: { slug } });
}

function Tile({ a, fresh }: { a: Achievement; fresh: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const name = t(achievementNameKey(a.slug));
  const date = a.unlockedAt ? formatUnlockDate(a.unlockedAt, lang, true) : '';
  const sub = a.unlocked ? (fresh ? t('achv.new_on', { date }) : date) : t('achv.locked');
  return (
    <Tap
      testID={`achievement-${a.slug}`}
      accessibilityRole="button"
      accessibilityLabel={t('achv.open_a11y', { name, state: a.unlocked ? t('achv.state_unlocked') : t('achv.state_locked') })}
      onPress={() => openAchievement(a.slug)}
      style={styles.tile}
    >
      <Medal slug={a.slug} unlocked={a.unlocked} glow={fresh} lockBadge />
      <AppText variant="chip" color={a.unlocked ? eos.bone : tone.mist} numberOfLines={2} style={styles.tileName}>
        {name}
      </AppText>
      <AppText
        variant="captionStrong"
        color={a.unlocked ? (fresh ? tone.gold : tone.mist) : graphite[600]}
        numberOfLines={1}
        style={[styles.tileSub, fresh && styles.upper]}
        testID={fresh ? `achievement-${a.slug}-new` : undefined}
      >
        {sub}
      </AppText>
    </Tap>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingTop: space[4], paddingBottom: space[10] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2], padding: layout.gutter },
  retry: { minHeight: 44, justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  upper: { textTransform: 'uppercase' },
  hero: {
    overflow: 'hidden',
    padding: layout.heroCardPadding,
    borderRadius: 14,
    backgroundColor: eos.slate,
    boxShadow: [...shadows.heroCard],
  },
  heroFill: { ...StyleSheet.absoluteFill },
  heroVeil: { backgroundImage: `linear-gradient(${surface.heroVeilTop}, ${surface.heroVeilBottom})` },
  heroGlow: {
    position: 'absolute',
    left: -40,
    top: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundImage: `radial-gradient(circle at 50% 50%, ${alpha(tone.emberGlow, 0.28)}, ${alpha(tone.emberGlow, 0)} 65%)`,
  },
  latest: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  latestName: { marginTop: space[1] },
  latestDesc: { marginTop: 2, fontSize: 13, lineHeight: 18 },
  collectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  collectionGap: { marginTop: 18 },
  count: { flexDirection: 'row', alignItems: 'baseline' },
  countDone: { fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
  countRest: { fontSize: 13, fontVariant: ['tabular-nums'] },
  bar: { marginTop: space[2], borderRadius: radii.full },
  chipsScroller: { marginTop: 18, marginHorizontal: -layout.gutter },
  chips: { paddingHorizontal: layout.gutter, gap: space[2] },
  section: { marginTop: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: space[1] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, marginTop: space[3] },
  tile: { width: '33.333%', paddingHorizontal: space[1], alignItems: 'center', gap: space[2] },
  tileName: { lineHeight: 16, textAlign: 'center' },
  tileSub: { marginTop: -5, fontSize: 10.5, lineHeight: 14, letterSpacing: 0.4, fontVariant: ['tabular-nums'] },
});

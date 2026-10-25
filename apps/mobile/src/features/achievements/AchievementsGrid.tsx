import {
  achievementCategoryKey,
  achievementDescKey,
  achievementNameKey,
  groupAchievements,
  type Achievement,
} from '@tac/core/catalogs';
import { localeFor } from '@tac/core/format';
import { eos, graphite, layout, radii, rank, semantic, space, transitions } from '@tac/core/tokens';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { createElement, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { feel } from '@/feel';
import { GOLD } from '@/features/profile/palette';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { useLang, useT } from '@/ui/lang';
import { bezier } from '@/ui/motion';
import { Card } from '@/ui/Surfaces';
import { Tap } from '@/ui/Tap';
import { achievementsQuery, evaluateAchievements } from './api';
import { achievementIconFor } from './icons';
import { readSeen, writeSeen } from './seen';

type Item =
  | { kind: 'progress'; done: number; total: number }
  | { kind: 'header'; key: string; label: string }
  | { kind: 'tile'; a: Achievement };

export function formatUnlockDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Achievements tab (web AchievementsGrid): progress card, then categories in
 * the web order as a 2-column grid. New: a tile opens the detail sheet, and
 * unlocks since the last visit shimmer once ("seen" slugs in MMKV).
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

  return <Grid list={list.data} userId={userId} refreshing={refreshing} onRefresh={onRefresh} />;
}

/** Unlocks since the last visit, fixed for this mount; the stored seen set
 *  is updated right away so each one shimmers only once. */
function freshUnlocks(list: Achievement[], userId: string): Set<string> {
  const unlocked = list.filter((a) => a.unlocked).map((a) => a.slug);
  const seen = readSeen(userId);
  writeSeen(userId, [...(seen ?? []), ...unlocked]);
  // First visit on this device: nothing counts as new.
  return new Set(seen ? unlocked.filter((s) => !seen.has(s)) : []);
}

function Grid({
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
  // Unlocks that land while the grid is open (evaluate, refresh) are seen too.
  useEffect(() => {
    writeSeen(userId, [...(readSeen(userId) ?? []), ...list.filter((a) => a.unlocked).map((a) => a.slug)]);
  }, [list, userId]);

  const done = list.filter((a) => a.unlocked).length;
  const items: Item[] = [{ kind: 'progress', done, total: list.length }];
  for (const g of groupAchievements(list)) {
    items.push({ kind: 'header', key: g.category, label: t(achievementCategoryKey(g.category)) });
    for (const a of g.items) items.push({ kind: 'tile', a });
  }

  return (
    <FlashList
      data={items}
      numColumns={2}
      keyExtractor={(it) => (it.kind === 'tile' ? it.a.slug : it.kind === 'header' ? `h-${it.key}` : 'progress')}
      getItemType={(it) => it.kind}
      overrideItemLayout={(l, it) => {
        if (it.kind !== 'tile') l.span = 2;
      }}
      renderItem={({ item }) => {
        if (item.kind === 'progress') return <Progress done={item.done} total={item.total} />;
        if (item.kind === 'header') {
          return (
            <AppText variant="sectionLabel" style={styles.header} accessibilityRole="header">
              {item.label}
            </AppText>
          );
        }
        return <AchievementTile a={item.a} fresh={fresh.has(item.a.slug)} />;
      }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={eos.ash} />}
      testID="achievements-grid"
    />
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const t = useT();
  return (
    <Card style={styles.progress} testID="achievements-progress">
      <View style={styles.flex}>
        <AppText variant="label">{t('achv.progress_title')}</AppText>
        <AppText variant="caption" color={eos.dust}>
          {t('achv.progress_value', { done, total })}
        </AppText>
      </View>
      <View style={styles.count}>
        <AppText variant="value" color={rank.intermediate.color} testID="achievements-done">
          {String(done)}
        </AppText>
        <AppText variant="value" color={graphite[600]}>
          {'/'}
        </AppText>
        <AppText variant="value" color={graphite[400]} testID="achievements-total">
          {String(total)}
        </AppText>
      </View>
    </Card>
  );
}

/** The gold icon chip (unlocked) or the muted lock chip. */
export function AchievementChip({ slug, unlocked, size }: { slug: string; unlocked: boolean; size: number }) {
  if (!unlocked) {
    return (
      <View style={[styles.chip, styles.chipLocked, { width: size, height: size }]}>
        <Lock size={Math.round(size * 0.375)} color={graphite[600]} />
      </View>
    );
  }
  return (
    <LinearGradient
      colors={GOLD}
      locations={[0, 0.6, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.chip, styles.chipGold, { width: size, height: size }]}
    >
      {createElement(achievementIconFor(slug), { size: Math.round(size * 0.46), color: eos.embers })}
    </LinearGradient>
  );
}

const SHINE = { duration: transitions.reveal.duration, easing: bezier(transitions.reveal.easing) };

function AchievementTile({ a, fresh }: { a: Achievement; fresh: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const name = t(achievementNameKey(a.slug));
  const desc = t(achievementDescKey(a.slug));
  const state = a.unlocked ? t('achv.unlocked_on', { date: a.unlockedAt ? formatUnlockDate(a.unlockedAt, lang) : '' }) : t('achv.locked');

  // Unseen unlock: a light band sweeps the tile three times (static glow
  // under reduced motion).
  const sweep = useSharedValue(-1);
  useEffect(() => {
    if (!fresh || reduced) return;
    sweep.set(withDelay(300, withRepeat(withTiming(1, SHINE), 3, false)));
  }, [fresh, reduced, sweep]);
  const band = useAnimatedStyle(() => ({
    opacity: sweep.get() > -1 && sweep.get() < 1 ? 1 : 0,
    transform: [{ translateX: sweep.get() * 220 }, { rotate: '20deg' }],
  }));

  return (
    <Tap
      testID={`achievement-${a.slug}`}
      accessibilityRole="button"
      accessibilityLabel={t('achv.open_a11y', { name, state })}
      onPress={() => router.push({ pathname: '/achievement/[slug]', params: { slug: a.slug } })}
      style={styles.tileWrap}
    >
      <View style={[styles.tile, a.unlocked ? styles.tileOn : styles.tileOff, fresh && styles.tileFresh]}>
        {a.unlocked ? (
          <LinearGradient
            colors={[rank.intermediate.glow, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.tint]}
          />
        ) : null}
        {fresh && !reduced ? (
          <Animated.View pointerEvents="none" style={[styles.band, band]}>
            <LinearGradient
              colors={['transparent', rank.intermediate.glow, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
        <View style={styles.tileTop}>
          <AchievementChip slug={a.slug} unlocked={a.unlocked} size={44} />
          {fresh ? (
            <View style={styles.newChip} testID={`achievement-${a.slug}-new`}>
              <AppText variant="label" color={eos.ink} style={styles.newText}>
                {t('achv.new')}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="body" numberOfLines={2} color={a.unlocked ? eos.bone : graphite[400]} >
          {name}
        </AppText>
        <AppText variant="caption" numberOfLines={3} color={a.unlocked ? graphite[300] : graphite[500]}>
          {desc}
        </AppText>
        {a.unlocked && a.unlockedAt ? (
          <AppText variant="label" color={rank.intermediate.color} style={styles.date}>
            {formatUnlockDate(a.unlockedAt, lang)}
          </AppText>
        ) : null}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter - space[1], paddingTop: space[3], paddingBottom: space[10] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2], padding: layout.gutter },
  retry: { minHeight: 44, justifyContent: 'center' },
  flex: { flex: 1 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginHorizontal: space[1], marginBottom: space[2] },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: space[1] },
  header: { marginTop: space[4], marginBottom: space[2], marginHorizontal: space[1], paddingLeft: space[1] },
  tileWrap: { flex: 1, padding: space[1] },
  tile: {
    flex: 1,
    minHeight: 168,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    padding: space[3],
    gap: space[1],
    overflow: 'hidden',
  },
  tileOn: { borderColor: rank.intermediate.glow, backgroundColor: eos.slate },
  tileOff: { borderColor: semantic.borderSoft, backgroundColor: eos.well },
  tileFresh: { borderColor: rank.intermediate.color },
  tint: { opacity: 0.4 },
  band: { position: 'absolute', top: -40, bottom: -40, left: -120, width: 90 },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: space[1] },
  chip: { borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  chipGold: { borderColor: rank.intermediate.glow },
  chipLocked: { borderColor: semantic.borderSoft, backgroundColor: semantic.borderSoft },
  newChip: { borderRadius: radii.full, backgroundColor: rank.intermediate.color, paddingHorizontal: space[2], paddingVertical: 2 },
  newText: { fontSize: 9 },
  date: { marginTop: 'auto', paddingTop: space[1], opacity: 0.8 },
});

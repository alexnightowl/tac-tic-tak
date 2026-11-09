import { achievementCategoryKey, achievementDescKey, achievementNameKey, type Achievement, type AchievementCategory } from '@tac/core/catalogs';
import { tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Share as ShareIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { achievementsQuery, evaluateAchievements } from '@/features/achievements/api';
import { formatUnlockDate, freshUnlocks, openAchievement, sections } from '@/features/achievements/AchievementsGrid';
import { shareAchievement } from '@/features/achievements/AchievementSheet';
import '@/features/achievements/icons';
import { Medal } from '@/features/achievements/Medal';
import { readSeen, writeSeen } from '@/features/achievements/seen';
import { useAuthStore } from '@/stores/authStore';
import { useLang, useT } from '@/ui/lang';
import { Bar, Card, DText, GhostButton, Hover, Label } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { useWidth } from './layout';

type Filter = 'all' | AchievementCategory;

const GOLD_BAR = [dx.goldFrom, tone.gold] as const;
const SIDE = 220;
const CARD_MIN = 128;
const GAP = 12;

/**
 * Achievements on a desktop window (DXAchievements): the collection count
 * and the category list on the left, the latest unlock (with Share) over a
 * medal grid on the right. A medal opens /achievement/[slug] (the dialog).
 * Same list, evaluate-on-open and "seen" bookkeeping as the phone grid.
 */
export function DxAchievements({ switcher }: { switcher: ReactNode }) {
  const t = useT();
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const list = useQuery(achievementsQuery());
  useEffect(() => {
    void evaluateAchievements();
  }, []);
  const done = list.data?.filter((a) => a.unlocked).length ?? 0;
  const total = list.data?.length ?? 0;
  return (
    <DesktopPage
      title={t('stats.tab_achievements')}
      subtitle={list.data ? t('achv.progress_value', { done, total }) : ' '}
      right={switcher}
      testID="dx-achievements"
    >
      {list.data ? (
        <Collection list={list.data} userId={userId} />
      ) : (
        <DText size={14} color={dx.dust} testID="dx-achievements-loading">
          {list.isError ? t('achv.error') : t('achv.loading')}
        </DText>
      )}
    </DesktopPage>
  );
}

function Collection({ list, userId }: { list: Achievement[]; userId: string }) {
  const t = useT();
  const { lang } = useLang();
  const me = useAuthStore((s) => s.user);
  const [fresh] = useState(() => freshUnlocks(list, userId));
  const [filter, setFilter] = useState<Filter>('all');
  const [width, onLayout] = useWidth();
  useEffect(() => {
    writeSeen(userId, [...(readSeen(userId) ?? []), ...list.filter((a) => a.unlocked).map((a) => a.slug)]);
  }, [list, userId]);

  const groups = sections(list);
  const done = list.filter((a) => a.unlocked).length;
  const latest = list
    .filter((a) => a.unlocked && a.unlockedAt)
    .sort((a, b) => +new Date(b.unlockedAt!) - +new Date(a.unlockedAt!))[0];
  const shown = groups.filter((g) => filter === 'all' || g.category === filter).flatMap((g) => g.items);

  const cols = width > 0 ? Math.max(2, Math.min(6, Math.floor((width + GAP) / (CARD_MIN + GAP)))) : 6;
  const cardW = width > 0 ? Math.floor((width - GAP * (cols - 1)) / cols) : CARD_MIN;

  const cats: { value: Filter; label: string; done: number; total: number }[] = [
    { value: 'all', label: t('achv.chip_all'), done, total: list.length },
    ...groups.map((g) => ({
      value: g.category as Filter,
      label: t(achievementCategoryKey(g.category)),
      done: g.items.filter((a) => a.unlocked).length,
      total: g.items.length,
    })),
  ];

  return (
    <View style={styles.cols}>
      <View style={styles.side}>
        <Card texture style={styles.count} testID="dx-achievements-progress">
          <DText size={38} weight={800} tabular ls={-0.3} accessibilityLabel={t('achv.progress_value', { done, total: list.length })}>
            {String(done)}
            <DText size={20} weight={800} color={dx.dust}>{`/${list.length}`}</DText>
          </DText>
          <DText size={12.5} color={dx.ash}>
            {t('dx.rivals.achv_unlocked')}
          </DText>
          <Bar value={list.length ? done / list.length : 0} colors={GOLD_BAR} style={styles.countBar} />
        </Card>
        <View style={styles.cats} accessibilityRole="tablist">
          {cats.map((c) => {
            const on = c.value === filter;
            return (
              <Hover
                key={c.value}
                testID={`dx-achievements-cat-${c.value}`}
                accessibilityRole="tab"
                accessibilityLabel={`${c.label}, ${c.done}/${c.total}`}
                selected={on}
                onPress={() => setFilter(c.value)}
                style={[styles.cat, on && styles.catOn]}
              >
                <DText size={14} weight={700} color={on ? dx.navOnText : dx.ash} style={styles.flex} numberOfLines={1}>
                  {c.label}
                </DText>
                <DText size={12} color={dx.dust} tabular>{`${c.done}/${c.total}`}</DText>
              </Hover>
            );
          })}
        </View>
      </View>
      <View style={styles.main}>
        {latest ? (
          <Card texture style={styles.latest} testID="dx-achievements-latest">
            <Hover
              testID="dx-achievements-latest-open"
              accessibilityLabel={t('achv.open_a11y', { name: t(achievementNameKey(latest.slug)), state: t('achv.state_unlocked') })}
              onPress={() => openAchievement(latest.slug)}
              style={styles.latestOpen}
              hoverStyle={styles.noHover}
            >
              <Medal slug={latest.slug} unlocked disc={64} />
              <View style={styles.flex}>
                <Label color={tone.gold}>{t('achv.latest', { date: formatUnlockDate(latest.unlockedAt!, lang, true) })}</Label>
                <DText serif weight={700} size={22} style={styles.mt4} numberOfLines={1}>
                  {t(achievementNameKey(latest.slug))}
                </DText>
                <DText size={13} color={dx.ash} numberOfLines={2}>
                  {t(achievementDescKey(latest.slug))}
                </DText>
              </View>
            </Hover>
            <GhostButton
              label={t('achv.share')}
              icon={ShareIcon}
              testID="dx-achievements-share"
              accessibilityLabel={t('achv.share')}
              onPress={() => shareAchievement(t('achv.share_message', { name: t(achievementNameKey(latest.slug)) }), me?.nickname)}
            />
          </Card>
        ) : null}
        <View style={styles.grid} onLayout={onLayout} testID="dx-achievements-grid">
          {shown.map((a) => (
            <MedalCard key={a.slug} a={a} fresh={fresh.has(a.slug)} width={cardW} />
          ))}
        </View>
      </View>
    </View>
  );
}

function MedalCard({ a, fresh, width }: { a: Achievement; fresh: boolean; width: number }) {
  const t = useT();
  const name = t(achievementNameKey(a.slug));
  return (
    <Hover
      testID={`dx-achievement-${a.slug}`}
      accessibilityLabel={t('achv.open_a11y', { name, state: a.unlocked ? t('achv.state_unlocked') : t('achv.state_locked') })}
      onPress={() => openAchievement(a.slug)}
      style={[styles.medal, { width }, !a.unlocked && styles.locked]}
      hoverStyle={styles.medalHover}
    >
      <Medal slug={a.slug} unlocked={a.unlocked} disc={76} glow={fresh} lockBadge />
      <DText size={13.5} weight={800} align="center" numberOfLines={2} color={a.unlocked ? dx.bone : dx.ash}>
        {name}
      </DText>
      <DText size={11.5} lh={15} align="center" color={dx.dust} numberOfLines={3} testID={fresh ? `dx-achievement-${a.slug}-new` : undefined}>
        {fresh ? t('achv.new') : t(achievementDescKey(a.slug))}
      </DText>
    </Hover>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt4: { marginTop: 4 },
  noHover: {},
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  side: { width: SIDE },
  main: { flex: 1, minWidth: 0, gap: 16 },
  count: { padding: 18, alignItems: 'center' },
  countBar: { marginTop: 10, alignSelf: 'stretch' },
  cats: { marginTop: 16, gap: 4 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 40, paddingHorizontal: 12, borderRadius: 10 },
  catOn: { backgroundColor: dx.navOn },
  latest: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 20, paddingHorizontal: 22 },
  latestOpen: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  medal: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  medalHover: { backgroundColor: dx.chipHover },
  locked: { opacity: 0.75 },
});

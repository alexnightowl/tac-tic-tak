import { queryKeys } from '@tac/core/api';
import { XP_PER_MINUTE, XP_PER_REVIEW, XP_RANKS } from '@tac/core/rules';
import { eos, layout, radii, space, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { Check, ChevronRight, Clock, History, Trophy } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/platform/api';
import { AppText, Card, useLang } from '@/ui';
import { useT, type TFn } from '@/ui/lang';
import { stackHeader } from '@/ui/NavHeader';
import { Tap } from '@/ui/Tap';
import { RankTile } from './XpCard';
import { fmtXp, xpHours } from './xp';

// /experience (Profile's experience card): design PlayV2Experience. The
// current rank with the way to the next, training / mistakes / this week,
// how XP is earned, the rank ladder, and a way to the achievements.

const HEADER = stackHeader('glass', { compact: true });

function trainedLabel(sec: number, t: TFn): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return t('xp.m', { m });
  return m === 0 ? t('xp.h', { h }) : t('xp.hm', { h, m });
}

export function ExperienceScreen() {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: queryKeys.experience(), queryFn: () => api.users.experience() });
  const x = q.data;

  return (
    <View style={styles.root} testID="screen-experience">
      <Stack.Screen options={{ title: t('xp.title'), header: HEADER }} />
      {!x ? (
        <View style={styles.loading}>
          <ActivityIndicator color={eos.ember} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space[10] }]}>
          <View style={styles.hero}>
            <View style={styles.heroHead}>
              <RankTile rank={x.rank} size={64} />
              <View style={styles.flex}>
                <AppText variant="eyebrow" color={tone.rose}>
                  {t('xp.current_rank')}
                </AppText>
                <AppText variant="heading" testID="experience-rank">
                  {t(`xp.rank.${x.rank}`)}
                </AppText>
                <AppText variant="body" color={eos.ash} testID="experience-level">
                  {t('xp.trained', { level: x.level, time: trainedLabel(x.trainingSec, t) })}
                </AppText>
              </View>
            </View>
            <View style={styles.xpRow}>
              <AppText variant="value" testID="experience-xp">
                {fmtXp(x.xp, lang)}
                <AppText variant="caption" color={eos.ash}>
                  {' XP'}
                </AppText>
              </AppText>
              {x.nextRank && x.nextRankXp != null && (
                <AppText variant="captionStrong" color={eos.ash}>
                  {t('xp.to_rank_total', { xp: fmtXp(x.nextRankXp, lang), rank: t(`xp.rank.${x.nextRank}`) })}
                </AppText>
              )}
            </View>
            <RankBar ratio={x.nextRankXp != null ? (x.xp - x.rankXp) / Math.max(1, x.nextRankXp - x.rankXp) : 1} />
            <View style={styles.xpFoot}>
              <AppText variant="caption" color={eos.dust} style={styles.shrink}>
                {x.nextRankXp != null
                  ? t('xp.left', { n: fmtXp(x.nextRankXp - x.xp, lang), h: xpHours(x.nextRankXp - x.xp) })
                  : t('xp.top_rank')}
              </AppText>
              <AppText variant="caption" color={eos.dust}>
                {t('xp.level_at', { level: x.level + 1, xp: fmtXp(x.nextLevelXp, lang) })}
              </AppText>
            </View>
          </View>

          <View style={styles.tiles}>
            <Tile label={t('xp.tile_training')} value={t('xp.h', { h: Math.floor(x.trainingSec / 3600) })} sub={t('xp.all_time')} />
            <Tile label={t('xp.tile_mistakes')} value={fmtXp(x.reviewsResolved, lang)} sub={t('xp.week_n', { n: x.weekReviews })} good />
            <Tile label={t('xp.tile_week')} value={`+${fmtXp(x.weekXp, lang)}`} sub={t('xp.week_earned')} good />
          </View>

          <View>
            <AppText variant="sectionLabel">{t('xp.earn')}</AppText>
            <Card style={styles.list}>
              <EarnRow icon={<Clock size={18} color={tone.rose} />} title={t('xp.earn_time')} hint={t('xp.earn_time_hint')} amount={t('xp.per_min', { n: XP_PER_MINUTE })} />
              <View style={styles.sep} />
              <EarnRow icon={<History size={18} color={tone.rose} />} title={t('xp.earn_review')} hint={t('xp.earn_review_hint')} amount={t('xp.per_review', { n: XP_PER_REVIEW })} />
            </Card>
            <AppText variant="caption" color={eos.dust} style={styles.note}>
              {t('xp.never_down')}
            </AppText>
          </View>

          <View>
            <AppText variant="sectionLabel">{t('xp.ranks')}</AppText>
            <Card style={styles.list}>
              {XP_RANKS.map((r, i) => {
                const reached = x.xp >= r.xp;
                const here = r.key === x.rank;
                return (
                  <View key={r.key}>
                    {i > 0 && <View style={styles.sep} />}
                    <View style={[styles.rankRow, !reached && styles.dim]} testID={`experience-rank-${r.key}`}>
                      <RankTile rank={r.key} size={30} />
                      <AppText variant="turnTitle" style={styles.flex}>
                        {t(`xp.rank.${r.key}`)}
                      </AppText>
                      {here ? (
                        <View style={styles.youChip}>
                          <AppText variant="captionStrong" color={tone.onEmber}>
                            {t('xp.you_level', { level: x.level })}
                          </AppText>
                        </View>
                      ) : reached ? (
                        <Check size={14} color={eos.sage} strokeWidth={3} />
                      ) : null}
                      <AppText variant="caption" color={eos.ash} style={styles.tabular}>
                        {reached || r.xp === 0
                          ? t('xp.rank_at', { xp: fmtXp(r.xp, lang) })
                          : t('xp.rank_at_hours', { xp: fmtXp(r.xp, lang), h: xpHours(r.xp - x.xp) })}
                      </AppText>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>

          <Tap
            testID="experience-achievements"
            accessibilityRole="link"
            accessibilityLabel={t('xp.achievements')}
            onPress={() => router.push(`/stats?tab=achievements&at=${Date.now()}` as Href)}
            style={styles.link}
          >
            <View style={styles.iconTile}>
              <Trophy size={18} color={tone.rose} />
            </View>
            <AppText variant="bodyStrong" style={styles.flex}>
              {t('xp.achievements')}
            </AppText>
            <ChevronRight size={18} color={eos.dust} />
          </Tap>
        </ScrollView>
      )}
    </View>
  );
}

function RankBar({ ratio }: { ratio: number }) {
  return (
    <View style={styles.rankBar}>
      <View style={[styles.rankFill, { width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }]} />
    </View>
  );
}

function Tile({ label, value, sub, good = false }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <View style={styles.tile}>
      <AppText variant="label" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="valueSm">{value}</AppText>
      <AppText variant="caption" color={good ? tone.sageDeep : eos.dust} style={styles.tileSub} numberOfLines={1}>
        {sub}
      </AppText>
    </View>
  );
}

function EarnRow({ icon, title, hint, amount }: { icon: React.ReactNode; title: string; hint: string; amount: string }) {
  return (
    <View style={styles.earn}>
      <View style={styles.iconTile}>{icon}</View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color={eos.ash}>
          {hint}
        </AppText>
      </View>
      <AppText variant="bodyStrong" color={tone.amberLight}>
        {amount}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space[2], gap: space[4] },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  hero: {
    padding: space[5],
    borderRadius: 14,
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: eos.seam,
    gap: space[2],
  },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: space[2] },
  xpRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[2] },
  rankBar: { height: 10, borderRadius: radii.full, backgroundColor: eos.well, overflow: 'hidden' },
  rankFill: { height: 10, borderRadius: radii.full, backgroundColor: tone.copper },
  xpFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  tiles: { flexDirection: 'row', gap: space[2.5] },
  tile: { flex: 1, padding: space[3], borderRadius: radii.lg, backgroundColor: eos.slate },
  tileSub: { fontSize: 11 },
  list: { marginTop: space[2], padding: 0, overflow: 'hidden' },
  sep: { height: 1, backgroundColor: eos.rise },
  earn: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingHorizontal: 14 },
  iconTile: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: eos.rise, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: space[2] },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2.5], paddingHorizontal: 14 },
  dim: { opacity: 0.45 },
  youChip: { paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radii.full, backgroundColor: eos.embers },
  link: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: 14, paddingHorizontal: space[4], borderRadius: radii.xl, backgroundColor: eos.slate },
});

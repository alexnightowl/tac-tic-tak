import { queryKeys } from '@tac/core/api';
import type { XpStanding } from '@tac/core/rules';
import { alpha, control, eos, radii, semantic, space, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { api } from '@/platform/api';
import { AppText, Card, useLang } from '@/ui';
import type { TFn } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { fmtXp, rankPiece } from './xp';

// Experience cards (design PlayV2Sum* XP card, PlayV2ProfileXp).

/** The tile a rank's piece sits in. */
export function RankTile({ rank, size }: { rank: XpStanding['rank']; size: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.25 }]}>
      <Image source={rankPiece(rank)} style={{ width: size * 0.75, height: size * 0.75 }} contentFit="contain" transition={null} />
    </View>
  );
}

function XpBar({ ratio, height = 6 }: { ratio: number; height?: number }) {
  return (
    <View style={[styles.bar, { height }]}>
      <LinearGradient
        colors={control.progressEmberCopper}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height, borderRadius: radii.full, width: `${Math.min(1, Math.max(0, ratio)) * 100}%` }}
      />
    </View>
  );
}

const levelRatio = (s: XpStanding) => (s.xp - s.levelXp) / Math.max(1, s.nextLevelXp - s.levelXp);

/** Summary: the XP this session earned; copper with "New rank" when the rank changed. */
export function XpSummaryCard({ gained, before, after, t }: { gained: number; before: XpStanding; after: XpStanding; t: TFn }) {
  const { lang } = useLang();
  const rankUp = after.rank !== before.rank;
  return (
    <Card style={[styles.summary, rankUp && styles.rankUp]} testID="summary-xp">
      <View style={styles.row}>
        <RankTile rank={after.rank} size={40} />
        <View style={styles.flex}>
          <AppText variant="label" color={rankUp ? tone.amberLight : eos.ash} testID={rankUp ? 'summary-xp-rank-up' : undefined}>
            {rankUp ? t('xp.new_rank') : t('xp.label')}
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {t('xp.rank_level', { rank: t(`xp.rank.${after.rank}`), level: after.level })}
          </AppText>
        </View>
        <AppText variant="bodyStrong" color={tone.amberLight} style={styles.gain} testID="summary-xp-gain">
          {t('xp.gain', { n: gained })}
        </AppText>
      </View>
      <XpBar ratio={levelRatio(after)} />
      <View style={styles.foot}>
        <AppText variant="caption" color={eos.dust} style={styles.tabular}>
          {t('xp.total', { n: fmtXp(after.xp, lang) })}
        </AppText>
        <AppText variant="caption" color={eos.dust} style={styles.tabular}>
          {t('xp.to_level', { n: fmtXp(after.nextLevelXp - after.xp, lang), level: after.level + 1 })}
        </AppText>
      </View>
    </Card>
  );
}

/** Profile: rank, level and the way to the next rank; opens Experience. */
export function XpProfileCard({ t }: { t: TFn }) {
  const { lang } = useLang();
  const q = useQuery({ queryKey: queryKeys.experience(), queryFn: () => api.users.experience() });
  const x = q.data;
  if (!x) return null;
  const toRank = x.nextRankXp != null ? x.nextRankXp - x.xp : null;
  const ratio = x.nextRankXp != null ? (x.xp - x.rankXp) / Math.max(1, x.nextRankXp - x.rankXp) : 1;
  return (
    <Tap
      testID="profile-xp"
      accessibilityRole="button"
      accessibilityLabel={`${t('xp.label')}: ${t('xp.rank_level', { rank: t(`xp.rank.${x.rank}`), level: x.level })}. ${t('xp.open')}`}
      onPress={() => router.push('/experience' as Href)}
      style={styles.profile}
    >
      <View style={styles.row}>
        <RankTile rank={x.rank} size={44} />
        <View style={styles.flex}>
          <AppText variant="label">{t('xp.label')}</AppText>
          <AppText variant="navTitle" numberOfLines={1}>
            {t('xp.rank_level', { rank: t(`xp.rank.${x.rank}`), level: x.level })}
          </AppText>
        </View>
        <ChevronRight size={18} color={eos.dust} />
      </View>
      <XpBar ratio={ratio} />
      <View style={styles.foot}>
        <AppText variant="caption" color={eos.dust} style={styles.tabular}>
          {t('xp.total', { n: fmtXp(x.xp, lang) })}
        </AppText>
        <AppText variant="caption" color={eos.dust} style={styles.tabular}>
          {toRank != null && x.nextRank ? t('xp.to_rank', { n: fmtXp(toRank, lang), rank: t(`xp.rank.${x.nextRank}`) }) : t('xp.top_rank')}
        </AppText>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: eos.embers,
    borderWidth: 1,
    borderColor: control.dangerBorderSoft,
  },
  bar: { borderRadius: radii.full, backgroundColor: eos.well, overflow: 'hidden' },
  summary: { paddingVertical: 14, paddingHorizontal: space[4], gap: space[2] },
  rankUp: {
    borderColor: alpha(tone.copper, 0.55),
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 22, spreadDistance: 2, color: alpha(tone.copper, 0.25) }],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1, minWidth: 0 },
  gain: { fontSize: 16, fontVariant: ['tabular-nums'] },
  foot: { flexDirection: 'row', justifyContent: 'space-between' },
  tabular: { fontVariant: ['tabular-nums'] },
  profile: {
    gap: space[2.5],
    paddingVertical: 14,
    paddingHorizontal: space[4],
    borderRadius: radii.xl,
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
});

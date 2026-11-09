import { queryKeys } from '@tac/core/api';
import { XP_PER_MINUTE, XP_PER_REVIEW, XP_RANKS } from '@tac/core/rules';
import { eos, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { fmtXp } from '@/features/experience/xp';
import { api } from '@/platform/api';
import { useAuthStore } from '@/stores/authStore';
import { useLang, useT } from '@/ui/lang';
import { DesktopPage } from '../Page';
import { Card, DText, Label, Num, Tile } from '../kit';
import { dx } from '../tokens';
import { RankPiece, XpBar } from './parts';

/**
 * DXXP (/experience): the textured current-rank card with the way to the
 * next rank, training / mistakes / this week, how XP is earned, and the six
 * ranks as cards (yours highlighted, the ones ahead dimmed). Same data as
 * the phone screen (GET /users/me/experience).
 */
export function DxXp() {
  const t = useT();
  const { lang } = useLang();
  const nickname = useAuthStore((s) => s.user?.nickname ?? '');
  const q = useQuery({ queryKey: queryKeys.experience(), queryFn: () => api.users.experience() });
  const x = q.data;
  const back = {
    label: t('settings.tab.profile'),
    onPress: () => (router.canGoBack() ? router.back() : router.navigate(`/profile/${encodeURIComponent(nickname)}` as Href)),
  };

  return (
    <DesktopPage title={t('xp.title')} back={back} right={null} testID="dx-experience">
      {!x ? (
        <View style={styles.loading}>
          <ActivityIndicator color={eos.ember} />
        </View>
      ) : (
        <>
          <Card texture style={styles.hero} testID="experience-hero">
            <RankPiece rank={x.rank} size={84} radius={20} />
            <View style={styles.flex}>
              <Label color={eos.rose}>{t('xp.current_rank')}</Label>
              <DText serif weight={700} size={30} style={styles.mt4} testID="experience-rank" numberOfLines={1}>
                {t('xp.rank_level', { rank: t(`xp.rank.${x.rank}`), level: x.level })}
              </DText>
              <View style={styles.mt12}>
                <XpBar value={x.nextRankXp != null ? (x.xp - x.rankXp) / Math.max(1, x.nextRankXp - x.rankXp) : 1} height={8} />
              </View>
              <View style={styles.foot}>
                <DText size={12.5} color={dx.dust} tabular testID="experience-xp">
                  {t('xp.total', { n: fmtXp(x.xp, lang) })}
                </DText>
                <DText size={12.5} color={dx.dust} tabular>
                  {x.nextRank && x.nextRankXp != null
                    ? t('xp.to_rank_total', { xp: fmtXp(x.nextRankXp - x.xp, lang), rank: t(`xp.rank.${x.nextRank}`) })
                    : t('xp.top_rank')}
                </DText>
              </View>
            </View>
          </Card>

          <View style={styles.tiles}>
            <Stat label={t('xp.tile_training')} value={t('xp.h', { h: Math.floor(x.trainingSec / 3600) })} sub={t('xp.all_time')} />
            <Stat label={t('xp.tile_mistakes')} value={fmtXp(x.reviewsResolved, lang)} sub={t('xp.week_n', { n: x.weekReviews })} />
            <Stat label={t('xp.tile_week')} value={`+${fmtXp(x.weekXp, lang)}`} sub={t('xp.week_earned')} />
            <Tile style={styles.earn} testID="experience-earn">
              <Label size={10}>{t('xp.earn')}</Label>
              <EarnLine label={t('xp.earn_time')} amount={t('xp.per_min', { n: XP_PER_MINUTE })} />
              <EarnLine label={t('xp.earn_review')} amount={t('xp.per_review', { n: XP_PER_REVIEW })} />
            </Tile>
          </View>

          <Label style={styles.ranksLabel}>{t('xp.ranks')}</Label>
          <View style={styles.ranks}>
            {XP_RANKS.map((r) => {
              const here = r.key === x.rank;
              const reached = x.xp >= r.xp;
              const next = r.key === x.nextRank;
              return (
                <View key={r.key} style={[styles.rank, here && styles.rankHere, !reached && !next && styles.dim]} testID={`experience-rank-${r.key}`}>
                  <RankPiece rank={r.key} size={54} radius={14} tile={here ? dx.rankTile : dx.ghost} dim={!reached && !next} />
                  <DText size={14} weight={800} numberOfLines={1}>
                    {t(`xp.rank.${r.key}`)}
                  </DText>
                  <DText size={12} color={dx.dust} tabular>
                    {t('xp.rank_at', { xp: fmtXp(r.xp, lang) })}
                  </DText>
                  <DText size={11.5} weight={700} color={eos.rose} align="center" numberOfLines={1}>
                    {here
                      ? t('dx.account.rank_current', { level: x.level })
                      : next
                        ? t('dx.account.rank_more', { xp: fmtXp(r.xp - x.xp, lang) })
                        : ' '}
                  </DText>
                </View>
              );
            })}
          </View>
          <DText size={12.5} color={dx.dust} style={styles.note}>
            {t('xp.never_down')}
          </DText>
        </>
      )}
    </DesktopPage>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Tile style={styles.tile}>
      <Label size={10}>{label}</Label>
      <Num style={styles.mt6}>{value}</Num>
      <DText size={12} color={dx.dust} numberOfLines={1}>
        {sub}
      </DText>
    </Tile>
  );
}

function EarnLine({ label, amount }: { label: string; amount: string }) {
  return (
    <View style={styles.earnLine}>
      <DText size={13} style={styles.flex} numberOfLines={1}>
        {label}
      </DText>
      <DText size={13} weight={800} color={tone.gold}>
        {amount}
      </DText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  loading: { paddingVertical: 80, alignItems: 'center' },
  hero: { padding: 26, flexDirection: 'row', alignItems: 'center', gap: 24 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  tiles: { flexDirection: 'row', gap: 12, marginTop: 16 },
  tile: { flex: 1, minWidth: 0 },
  earn: { flex: 1.4, minWidth: 0 },
  earnLine: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9 },
  ranksLabel: { marginTop: 22 },
  ranks: { flexDirection: 'row', gap: 12, marginTop: 12 },
  rank: {
    flex: 1,
    minWidth: 0,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  rankHere: {
    backgroundColor: dx.rankOn,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: eos.ember, inset: true }],
  },
  dim: { opacity: 0.55 },
  note: { marginTop: 16 },
});

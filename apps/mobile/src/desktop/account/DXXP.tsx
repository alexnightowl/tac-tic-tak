import { queryKeys } from '@tac/core/api';
import { XP_PER_MINUTE, XP_PER_REVIEW, XP_RANKS } from '@tac/core/rules';
import { eos, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Check, ChevronRight, Trophy } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { fmtXp, xpHours } from '@/features/experience/xp';
import { api } from '@/platform/api';
import { useAuthStore } from '@/stores/authStore';
import { useLang, useT, type TFn } from '@/ui/lang';
import { DesktopPage } from '../Page';
import { Card, DText, Hover, IconSquare, Label, Num, Tile } from '../kit';
import { dx } from '../tokens';
import { RankPiece, useNarrow, XpBar } from './parts';

/**
 * DXXP (/experience): the textured current-rank card with the level and
 * time trained, the way to the next rank (XP left, hours, the next level),
 * training / mistakes / this week, how XP is earned, the six ranks as cards
 * (yours highlighted, reached ones ticked, the ones ahead dimmed with the
 * hours to reach them) and the link to the achievements. Same data as the
 * phone screen (GET /users/me/experience).
 */

/** "3 h 12 min" / "45 min" (the phone's trained label). */
function trainedLabel(sec: number, t: TFn): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return t('xp.m', { m });
  return m === 0 ? t('xp.h', { h }) : t('xp.hm', { h, m });
}
export function DxXp() {
  const t = useT();
  const { lang } = useLang();
  const nickname = useAuthStore((s) => s.user?.nickname ?? '');
  const q = useQuery({ queryKey: queryKeys.experience(), queryFn: () => api.users.experience() });
  const x = q.data;
  // Narrow windows give "how XP is earned" its own row.
  const narrow = useNarrow();
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
              <DText size={13.5} color={dx.ash} style={styles.mt4} testID="experience-level">
                {t('xp.trained', { level: x.level, time: trainedLabel(x.trainingSec, t) })}
              </DText>
              <View style={styles.mt12}>
                <XpBar value={x.nextRankXp != null ? (x.xp - x.rankXp) / Math.max(1, x.nextRankXp - x.rankXp) : 1} height={8} />
              </View>
              <View style={styles.foot}>
                <DText size={12.5} color={dx.dust} tabular testID="experience-xp">
                  {t('xp.total', { n: fmtXp(x.xp, lang) })}
                </DText>
                {x.nextRank && x.nextRankXp != null ? (
                  <DText size={12.5} color={dx.ash} weight={700} tabular testID="experience-next-rank">
                    {t('xp.to_rank_total', { xp: fmtXp(x.nextRankXp, lang), rank: t(`xp.rank.${x.nextRank}`) })}
                  </DText>
                ) : null}
              </View>
              <View style={styles.foot2}>
                <DText size={12.5} color={dx.dust} tabular style={styles.shrink} testID="experience-left">
                  {x.nextRankXp != null ? t('xp.left', { n: fmtXp(x.nextRankXp - x.xp, lang), h: xpHours(x.nextRankXp - x.xp) }) : t('xp.top_rank')}
                </DText>
                <DText size={12.5} color={dx.dust} tabular testID="experience-next-level">
                  {t('xp.level_at', { level: x.level + 1, xp: fmtXp(x.nextLevelXp, lang) })}
                </DText>
              </View>
            </View>
          </Card>

          <View style={styles.tiles}>
            <Stat label={t('xp.tile_training')} value={t('xp.h', { h: Math.floor(x.trainingSec / 3600) })} sub={t('xp.all_time')} />
            <Stat label={t('xp.tile_mistakes')} value={fmtXp(x.reviewsResolved, lang)} sub={t('xp.week_n', { n: x.weekReviews })} />
            <Stat label={t('xp.tile_week')} value={`+${fmtXp(x.weekXp, lang)}`} sub={t('xp.week_earned')} />
            <Tile style={[styles.earn, narrow && styles.earnWide]} testID="experience-earn">
              <Label size={10}>{t('xp.earn')}</Label>
              <EarnLine label={t('xp.earn_time')} hint={t('xp.earn_time_hint')} amount={t('xp.per_min', { n: XP_PER_MINUTE })} />
              <EarnLine label={t('xp.earn_review')} hint={t('xp.earn_review_hint')} amount={t('xp.per_review', { n: XP_PER_REVIEW })} />
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
                  <View style={styles.rankName}>
                    <DText size={14} weight={800} numberOfLines={1} style={styles.shrink}>
                      {t(`xp.rank.${r.key}`)}
                    </DText>
                    {reached && !here ? <Check size={14} color={dx.sage} strokeWidth={3} testID={`experience-reached-${r.key}`} /> : null}
                  </View>
                  <DText size={12} color={dx.dust} tabular align="center">
                    {reached || r.xp === 0
                      ? t('xp.rank_at', { xp: fmtXp(r.xp, lang) })
                      : t('xp.rank_at_hours', { xp: fmtXp(r.xp, lang), h: xpHours(r.xp - x.xp) })}
                  </DText>
                  <DText size={11.5} weight={700} color={eos.rose} align="center" numberOfLines={2}>
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

          <Hover
            testID="experience-achievements"
            accessibilityRole="link"
            accessibilityLabel={t('xp.achievements')}
            onPress={() => router.push(`/stats?tab=achievements&at=${Date.now()}` as Href)}
            style={styles.link}
          >
            <IconSquare icon={Trophy} size={36} />
            <DText size={14.5} weight={700} style={styles.flex}>
              {t('xp.achievements')}
            </DText>
            <ChevronRight size={18} color={dx.dust} strokeWidth={1.8} />
          </Hover>
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

function EarnLine({ label, hint, amount }: { label: string; hint: string; amount: string }) {
  return (
    <View style={styles.earnLine}>
      <View style={styles.flex}>
        <DText size={13}>
          {label}
        </DText>
        <DText size={11.5} color={dx.dust} numberOfLines={2}>
          {hint}
        </DText>
      </View>
      <DText size={13} weight={800} color={tone.gold}>
        {amount}
      </DText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  foot2: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  rankName: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: dx.card,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt12: { marginTop: 12 },
  loading: { paddingVertical: 80, alignItems: 'center' },
  hero: { padding: 26, flexDirection: 'row', alignItems: 'center', gap: 24 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  tile: { flex: 1, minWidth: 0 },
  earn: { flex: 1.4, minWidth: 0 },
  earnWide: { flexBasis: '100%' },
  earnLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 9 },
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

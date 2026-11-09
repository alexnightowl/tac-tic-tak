import type { TrainingStyle } from '@tac/core/rules';
import { alpha, eos, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { ChevronRight, Clock, Swords } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useChallengeList } from '@/features/challenge/api';
import { Avatar, VerifiedBadge } from '@/features/profile/Avatar';
import { displayNameOf } from '@/features/social/actions';
import { LEADERBOARD_LIMIT, leaderboardQuery, leagueQuery, type LeaderboardScope, type UserCard } from '@/features/social/api';
import { weekLeft } from '@/features/social/LeaderboardView';
import { readBoardScope, readBoardStyle, writeBoardScope, writeBoardStyle } from '@/features/social/prefs';
import { openProfile } from '@/features/social/UserIdentity';
import { groupInt } from '@/features/stats/CountUp';
import { StyleIcon, STYLE_ORDER } from '@/features/stats/StyleIcon';
import { useAppStore } from '@/stores/appStore';
import { PlateButton } from '@/ui';
import { useLang, useT, type TFn } from '@/ui/lang';
import { Bar, Card, DText, Hover, IconSquare, Label, Num, Seg } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { TWO_COLUMN_MIN, useWidth } from './layout';

type Period = 'week' | 'all';

/** One place on either board: weekly XP or the style rating. */
type Entry = { rank: number | null; value: number; isSelf: boolean; user: UserCard };

const GOLD_BAR = [dx.goldFrom, tone.gold] as const;
const ASIDE = 360;

/**
 * League tab on a desktop window (DXLeague): the period / scope switches
 * and the week's countdown over one ranking table, your row on an ember
 * edge; on the right "your place" with the gap to the next player, and the
 * challenges card (new challenge, incoming ones to accept). Same data as
 * the phone's RivalsScreen (weekly XP league, all-time rating board).
 */
export function DxLeague() {
  const t = useT();
  const { lang } = useLang();
  const [period, setPeriod] = useState<Period>('week');
  const [scope, setScopeState] = useState<LeaderboardScope>(readBoardScope);
  const [style, setStyleState] = useState<TrainingStyle>(readBoardStyle);
  const [width, onLayout] = useWidth();
  const wide = width === 0 || width >= TWO_COLUMN_MIN;

  const league = useQuery({ ...leagueQuery(scope), enabled: period === 'week' });
  const board = useQuery({ ...leaderboardQuery(style, scope), enabled: period === 'all' });

  const setScope = (s: LeaderboardScope) => {
    setScopeState(s);
    writeBoardScope(s);
  };
  const setStyle = (s: TrainingStyle) => {
    setStyleState(s);
    writeBoardStyle(s);
  };

  let rows: Entry[] = [];
  let self: Entry | null = null;
  let loaded = false;
  let failed = false;
  if (period === 'week') {
    rows = (league.data?.rows ?? []).map((r) => ({ rank: r.rank, value: r.xp, isSelf: r.isSelf, user: r.user }));
    const s = league.data?.self;
    self = rows.find((r) => r.isSelf) ?? (s ? { rank: s.rank, value: s.xp, isSelf: true, user: s.user } : null);
    loaded = !!league.data;
    failed = league.isError && !league.data;
  } else {
    rows = (board.data ?? []).map((r) => ({ rank: r.rank, value: r.rating, isSelf: r.isSelf, user: r.user }));
    self = rows.find((r) => r.isSelf) ?? null;
    loaded = !!board.data;
    failed = board.isError && !board.data;
  }
  const selfListed = rows.some((r) => r.isSelf);

  const unit = (v: number) => (period === 'week' ? t('dx.rivals.xp', { n: groupInt(v, lang) }) : String(v));

  const controls = (
    <View style={styles.controls}>
      <Seg
        options={[
          { value: 'week' as const, label: t('league.week') },
          { value: 'all' as const, label: t('league.all_time') },
        ]}
        value={period}
        onChange={setPeriod}
        testID="dx-league-period"
        accessibilityLabel={t('league.period_label')}
        style={styles.segPeriod}
      />
      <Seg
        options={[
          { value: 'global' as const, label: t('leaderboard.scope_global') },
          { value: 'friends' as const, label: t('leaderboard.scope_friends') },
        ]}
        value={scope}
        onChange={setScope}
        testID="dx-league-scope"
        accessibilityLabel={t('leaderboard.scope_label')}
        style={styles.segScope}
      />
      {period === 'all' ? (
        <Seg
          options={STYLE_ORDER.map((s) => ({ value: s, label: t(`style.${s}.name`) }))}
          value={style}
          onChange={setStyle}
          testID="dx-league-style"
          accessibilityLabel={t('leaderboard.style_label')}
          style={styles.segStyle}
        />
      ) : null}
      <View style={styles.flex} />
      {period === 'week' && league.data ? (
        <View style={styles.ends} testID="dx-league-ends">
          <Clock size={14} color={dx.ash} strokeWidth={1.8} />
          <DText size={13} color={dx.ash} numberOfLines={1}>
            {t('league.ends_in', { left: weekLeft(t, league.data.weekEnd) })}
          </DText>
        </View>
      ) : null}
    </View>
  );

  const table = (
    <View>
      <Card style={[styles.table, (period === 'week' ? league : board).isPlaceholderData && styles.dim]} testID="dx-league-table">
        {failed ? (
          <DText size={14} color={dx.ash} style={styles.note} testID="dx-league-error">
            {t('leaderboard.error')}
          </DText>
        ) : loaded && rows.length === 0 ? (
          <DText size={14} color={dx.ash} style={styles.note} testID="dx-league-empty">
            {period === 'week'
              ? scope === 'friends'
                ? t('league.empty_friends')
                : t('league.empty')
              : scope === 'friends'
                ? t('leaderboard.empty_friends')
                : t('leaderboard.empty')}
          </DText>
        ) : null}
        {rows.map((r, i) => (
          <PlaceRow key={r.user.id} row={r} first={i === 0} unit={unit} period={period} style={style} t={t} />
        ))}
        {self && !selfListed ? (
          <>
            <View style={styles.gapRow}>
              <DText size={12} color={dx.dust}>
                {'···'}
              </DText>
            </View>
            <PlaceRow row={self} first={false} unit={unit} period={period} style={style} t={t} />
          </>
        ) : null}
      </Card>
      <DText size={12} color={dx.dust} style={styles.foot}>
        {period === 'week' ? t('league.hint') : t('dx.rivals.all_time_hint')}
      </DText>
    </View>
  );

  const aside = (
    <>
      <YourPlace period={period} style={style} rows={rows} self={self} loaded={loaded} unit={unit} t={t} />
      <Challenges t={t} />
    </>
  );

  return (
    <DesktopPage
      title={t('dx.rivals.league_title')}
      subtitle={period === 'week' ? t('dx.rivals.league_sub') : t('dx.rivals.board_sub')}
      testID="dx-league"
    >
      <View onLayout={onLayout} style={wide ? styles.cols : styles.stack}>
        <View style={styles.main}>
          {controls}
          {!wide ? <View style={styles.asideRow}>{aside}</View> : null}
          {table}
        </View>
        {wide ? <View style={styles.aside}>{aside}</View> : null}
      </View>
    </DesktopPage>
  );
}

function PlaceRow({
  row,
  first,
  unit,
  period,
  style,
  t,
}: {
  row: Entry;
  first: boolean;
  unit: (v: number) => string;
  period: Period;
  style: TrainingStyle;
  t: TFn;
}) {
  const name = displayNameOf(row.user);
  const place = row.rank != null ? String(row.rank) : '—';
  const top = row.rank != null && row.rank <= 3;
  const label =
    period === 'week'
      ? t('league.rank_a11y', { rank: place, name, xp: row.value })
      : t('leaderboard.rank_a11y', { rank: place, name, rating: row.value });
  return (
    <Hover
      testID={row.isSelf ? 'dx-league-row-self' : `dx-league-row-${row.user.nickname}`}
      accessibilityLabel={label}
      onPress={() => openProfile(row.user.nickname)}
      style={[styles.row, !first && styles.rowRule, row.isSelf && styles.rowSelf]}
    >
      <DText size={14} weight={800} tabular color={top ? tone.gold : dx.dust} style={styles.place}>
        {place}
      </DText>
      <Avatar nickname={row.user.nickname} avatarUrl={row.user.avatarUrl} size={34} />
      <View style={styles.nameCell}>
        <DText size={14.5} weight={700} numberOfLines={1} style={styles.shrink}>
          {row.isSelf ? t('dx.rivals.you_name', { name }) : name}
        </DText>
        <VerifiedBadge verified={row.user.verified} size={13} />
      </View>
      <View style={styles.valueCell}>
        {period === 'all' ? <StyleIcon style={style} size={14} color={dx.ash} /> : null}
        <DText size={14} weight={800} tabular align="right">
          {unit(row.value)}
        </DText>
      </View>
    </Hover>
  );
}

/** "Твоя ліга": place, value, the gap to the player one place up. */
function YourPlace({
  period,
  style,
  rows,
  self,
  loaded,
  unit,
  t,
}: {
  period: Period;
  style: TrainingStyle;
  rows: Entry[];
  self: Entry | null;
  loaded: boolean;
  unit: (v: number) => string;
  t: TFn;
}) {
  const myRating = useAppStore((s) => s.progressions[style].currentPuzzleRating);
  const idx = rows.findIndex((r) => r.isSelf);
  const ahead = idx > 0 ? rows[idx - 1] : null;
  const ranked = self?.rank != null;
  let caption: string;
  let fill = 0;
  if (!loaded) caption = ' ';
  else if (period === 'all' && !self && rows.length >= LEADERBOARD_LIMIT) caption = t('dx.rivals.outside', { rating: myRating, n: LEADERBOARD_LIMIT });
  else if (!self || !ranked) caption = period === 'week' ? t('league.no_rank') : t('dx.rivals.no_rating');
  else if (self.rank === 1) {
    caption = t('dx.rivals.leader', { value: unit(self.value) });
    fill = 1;
  } else if (ahead) {
    caption = t('dx.rivals.behind', { value: unit(self.value), gap: unit(Math.max(0, ahead.value - self.value)), name: displayNameOf(ahead.user) });
    fill = ahead.value > 0 ? self.value / ahead.value : 0;
  } else caption = unit(self.value);
  return (
    <Card texture style={styles.place_card} testID="dx-league-you">
      <Label>{t('dx.rivals.your_place')}</Label>
      <DText serif weight={700} size={26} style={styles.mt6} numberOfLines={1}>
        {period === 'week' ? t('league.week') : t(`style.${style}.name`)}
      </DText>
      <Num size={44} style={styles.mt6}>
        {ranked ? `#${self!.rank}` : '—'}
      </Num>
      <DText size={13} color={dx.ash} align="center" testID="dx-league-gap">
        {caption}
      </DText>
      <Bar value={fill} colors={GOLD_BAR} style={styles.mt14} />
    </Card>
  );
}

/** "Виклики": a new race, then the challenges waiting for my run. */
function Challenges({ t }: { t: TFn }) {
  const q = useChallengeList();
  const incoming = q.data?.incoming ?? [];
  return (
    <Card style={styles.chal} testID="dx-league-challenges">
      <Label>{t('challenge.section')}</Label>
      <Hover
        testID="dx-league-challenge-new"
        accessibilityLabel={t('challenge.cta')}
        onPress={() => router.push('/challenge/new' as Href)}
        style={styles.chalRow}
      >
        <IconSquare icon={Swords} size={38} />
        <View style={styles.flex}>
          <DText size={14} weight={800}>
            {t('challenge.cta')}
          </DText>
          <DText size={12.5} color={dx.ash} numberOfLines={1}>
            {t('challenge.cta_hint')}
          </DText>
        </View>
        <ChevronRight size={16} color={dx.dust} strokeWidth={1.8} />
      </Hover>
      {incoming.slice(0, 3).map((c) => {
        const name = displayNameOf(c.other);
        return (
          <View key={c.id} style={styles.incoming} testID={`dx-league-incoming-${c.id}`}>
            <Avatar nickname={c.other.nickname} avatarUrl={c.other.avatarUrl} size={30} />
            <DText size={13} color={dx.ash} style={styles.flex} numberOfLines={2}>
              <DText size={13} weight={800}>
                {name}
              </DText>
              {` ${t('dx.rivals.waits_for_you')}`}
            </DText>
            <PlateButton
              label={t('dx.rivals.accept')}
              accessibilityLabel={`${t('challenge.accept')}: ${name}`}
              testID={`dx-league-accept-${c.id}`}
              variant="ember"
              size="sm"
              onPress={() => router.push(`/challenge/${c.id}` as Href)}
            />
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  dim: { opacity: 0.6 },
  mt6: { marginTop: 6 },
  mt14: { marginTop: 14, alignSelf: 'stretch' },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  stack: { gap: 16 },
  main: { flex: 1, minWidth: 0, gap: 16 },
  aside: { width: ASIDE, gap: 16 },
  asideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  segPeriod: { width: 300 },
  segScope: { width: 240 },
  segStyle: { width: 300 },
  ends: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  table: { paddingVertical: 0 },
  note: { padding: 18, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 18 },
  rowRule: { borderTopWidth: 1, borderTopColor: dx.rowRule },
  rowSelf: {
    backgroundColor: alpha(eos.ember, 0.14),
    boxShadow: [{ offsetX: 3, offsetY: 0, blurRadius: 0, spreadDistance: 0, color: eos.ember, inset: true }],
  },
  place: { width: 26 },
  nameCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  valueCell: { minWidth: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  gapRow: { paddingVertical: 6, paddingHorizontal: 18, alignItems: 'center', borderTopWidth: 1, borderTopColor: dx.rowRule, backgroundColor: dx.track },
  foot: { marginTop: 10 },
  place_card: { flex: 1, padding: 22, alignItems: 'center' },
  chal: { flex: 1, paddingVertical: 18, paddingHorizontal: 20 },
  chalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, marginHorizontal: -8, padding: 8, borderRadius: 10 },
  incoming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
});

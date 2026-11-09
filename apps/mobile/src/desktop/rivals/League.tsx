import { streakState } from '@tac/core/format';
import type { TrainingStyle } from '@tac/core/rules';
import type { ChallengeSummary } from '@tac/core/storm';
import { alpha, eos, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { ChevronRight, Clock, Medal, Swords, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useChallengeList } from '@/features/challenge/api';
import { OutcomeChip, PresenceAvatar } from '@/features/challenge/parts';
import { challengeRemoveLabel, challengeRowText, FINISHED_FIRST, removeChallenge } from '@/features/challenge/rowModel';
import { Avatar, VerifiedBadge } from '@/features/profile/Avatar';
import { displayNameOf } from '@/features/social/actions';
import { LEADERBOARD_LIMIT, leaderboardQuery, leagueQuery, type LeaderboardScope, type UserCard } from '@/features/social/api';
import { MEDAL, weekLeft } from '@/features/social/LeaderboardView';
import { readBoardScope, readBoardStyle, writeBoardScope, writeBoardStyle } from '@/features/social/prefs';
import { StreakBadge } from '@/features/social/StreakBadge';
import { openProfile } from '@/features/social/UserIdentity';
import { groupInt } from '@/features/stats/CountUp';
import { StyleIcon, STYLE_ORDER } from '@/features/stats/StyleIcon';
import { useStormLaunch } from '@/features/storm/launch';
import { useAppStore } from '@/stores/appStore';
import { PlateButton } from '@/ui';
import { useLang, useT, type TFn } from '@/ui/lang';
import { Bar, Card, DText, GhostButton, Hover, IconSquare, Label, Num, Seg, TextButton } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { TWO_COLUMN_MIN, useWidth } from './layout';

type Period = 'week' | 'all';

/** One place on either board: weekly XP or the style rating. */
type Entry = { rank: number | null; value: number; isSelf: boolean; streakDays: number; streakLastDay: string | null; user: UserCard };

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
    rows = (league.data?.rows ?? []).map((r) => ({ ...r, value: r.xp }));
    const s = league.data?.self;
    self = rows.find((r) => r.isSelf) ?? (s ? { ...s, value: s.xp, isSelf: true } : null);
    loaded = !!league.data;
    failed = league.isError && !league.data;
  } else {
    rows = (board.data ?? []).map((r) => ({ ...r, value: r.rating }));
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
  const showStreak = useAppStore((st) => st.settings.showStreak);
  const streak = streakState(row.streakDays, row.streakLastDay);
  const name = displayNameOf(row.user);
  const place = row.rank != null ? String(row.rank) : '—';
  const medal = row.rank != null && row.rank >= 1 && row.rank <= 3 ? MEDAL[row.rank - 1] : null;
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
      <View style={styles.place}>
        {medal ? (
          <Medal size={18} color={medal} strokeWidth={1.8} testID={`dx-league-medal-${row.rank}`} />
        ) : (
          <DText size={14} weight={800} tabular color={dx.dust}>
            {place}
          </DText>
        )}
      </View>
      <Avatar nickname={row.user.nickname} avatarUrl={row.user.avatarUrl} size={34} />
      <View style={styles.nameCol}>
        <View style={styles.nameCell}>
          <DText size={14.5} weight={700} numberOfLines={1} style={styles.shrink}>
            {row.isSelf ? t('dx.rivals.you_name', { name }) : name}
            {row.user.displayName ? (
              <DText size={13} weight={500} color={dx.dust}>{`  @${row.user.nickname}`}</DText>
            ) : null}
          </DText>
          <VerifiedBadge verified={row.user.verified} size={13} />
        </View>
        {row.user.country ? (
          <DText size={10} weight={700} ls={1} color={dx.dust} style={styles.country}>
            {row.user.country.toUpperCase()}
          </DText>
        ) : null}
      </View>
      {showStreak && (streak === 'secured' || streak === 'at_risk') ? <StreakBadge days={row.streakDays} size="sm" /> : null}
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

/**
 * "Виклики": a new race, then everything the phone's Rivals section lists
 * (RivalsChallenges): incoming ones (format, time left, New, Accept & play
 * or Decline), mine still waiting (Withdraw), the last finished / declined /
 * expired with W/L/D and the score (Remove), "N more". A row opens
 * /challenge/[id]; decline and withdraw ask first, as on the phone.
 */
function Challenges({ t }: { t: TFn }) {
  const q = useChallengeList();
  const [more, setMore] = useState(false);
  const d = q.data;
  const finished = d ? (more ? d.finished : d.finished.slice(0, FINISHED_FIRST)) : [];
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
      {d?.incoming.map((c) => <Incoming key={c.id} c={c} t={t} />)}
      {d && d.outgoing.length + finished.length > 0 ? (
        <View style={styles.chalList}>
          {d.outgoing.map((c) => (
            <ChallengeLine key={c.id} c={c} kind="outgoing" t={t} />
          ))}
          {finished.map((c) => (
            <ChallengeLine key={c.id} c={c} kind="finished" t={t} />
          ))}
        </View>
      ) : null}
      {d && !more && d.finished.length > FINISHED_FIRST ? (
        <TextButton
          label={t('challenge.more', { n: d.finished.length - FINISHED_FIRST })}
          testID="dx-league-challenges-more"
          accessibilityLabel={t('challenge.more', { n: d.finished.length - FINISHED_FIRST })}
          onPress={() => setMore(true)}
          style={styles.more}
        />
      ) : null}
    </Card>
  );
}

/** An incoming challenge: who, format and time left, New; Accept & play / Decline. */
function Incoming({ c, t }: { c: ChallengeSummary; t: TFn }) {
  const { launching, launch } = useStormLaunch();
  const name = displayNameOf(c.other);
  const { subtitle, chip } = challengeRowText(c, 'incoming', t);
  return (
    <View style={styles.incoming} testID={`dx-league-incoming-${c.id}`}>
      <Hover
        testID={`dx-league-challenge-${c.id}`}
        accessibilityLabel={`${name}, ${subtitle}`}
        onPress={() => router.push(`/challenge/${c.id}` as Href)}
        style={styles.incomingHead}
        hoverStyle={styles.noHover}
      >
        <PresenceAvatar nickname={c.other.nickname} avatarUrl={c.other.avatarUrl} size={32} />
        <View style={styles.flex}>
          <DText size={13} color={dx.ash} numberOfLines={2}>
            <DText size={13} weight={800}>
              {name}
            </DText>
            {` ${t('dx.rivals.waits_for_you')}`}
          </DText>
          <DText size={12} color={dx.dust} numberOfLines={1} testID={`dx-league-challenge-${c.id}-sub`}>
            {subtitle}
          </DText>
        </View>
        {chip ? <OutcomeChip label={chip.label} kind={chip.kind} /> : null}
      </Hover>
      <View style={styles.incomingActions}>
        <PlateButton
          label={t('dx.rivals.accept')}
          accessibilityLabel={`${t('challenge.accept')}: ${name}`}
          testID={`dx-league-accept-${c.id}`}
          variant="ember"
          size="sm"
          loading={launching}
          style={styles.flex}
          onPress={() => void launch({ challengeId: c.id, format: c.format })}
        />
        <GhostButton
          label={challengeRemoveLabel('incoming', t)}
          testID={`dx-league-decline-${c.id}`}
          accessibilityLabel={`${challengeRemoveLabel('incoming', t)}: ${name}`}
          height={36}
          onPress={() => void removeChallenge(c, 'incoming', t)}
        />
      </View>
    </View>
  );
}

/** A sent challenge still waiting, or a closed one with W/L/D; × takes it off. */
function ChallengeLine({ c, kind, t }: { c: ChallengeSummary; kind: 'outgoing' | 'finished'; t: TFn }) {
  const name = displayNameOf(c.other);
  const { subtitle, chip } = challengeRowText(c, kind, t);
  const removeLabel = challengeRemoveLabel(kind, t);
  return (
    <View style={styles.line} testID={`dx-league-${kind}-${c.id}`}>
      <Hover
        testID={`dx-league-challenge-${c.id}`}
        accessibilityLabel={`${name}, ${subtitle}`}
        onPress={() => router.push(`/challenge/${c.id}` as Href)}
        style={styles.lineOpen}
      >
        <PresenceAvatar nickname={c.other.nickname} avatarUrl={c.other.avatarUrl} size={30} />
        <View style={styles.flex}>
          <DText size={13} weight={800} numberOfLines={1}>
            {name}
          </DText>
          <DText size={12} color={dx.ash} numberOfLines={1} testID={`dx-league-challenge-${c.id}-sub`}>
            {subtitle}
          </DText>
        </View>
        {chip ? <OutcomeChip label={chip.label} kind={chip.kind} /> : null}
      </Hover>
      <Hover
        testID={`dx-league-remove-${c.id}`}
        accessibilityLabel={`${removeLabel}: ${name}`}
        onPress={() => void removeChallenge(c, kind, t)}
        style={styles.remove}
        hoverStyle={styles.removeHover}
      >
        <X size={15} color={dx.ash} strokeWidth={1.8} />
      </Hover>
    </View>
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
  place: { width: 26, alignItems: 'flex-start' },
  nameCol: { flex: 1, minWidth: 0 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  country: { marginTop: 1 },
  valueCell: { minWidth: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  gapRow: { paddingVertical: 6, paddingHorizontal: 18, alignItems: 'center', borderTopWidth: 1, borderTopColor: dx.rowRule, backgroundColor: dx.track },
  foot: { marginTop: 10 },
  place_card: { flex: 1, padding: 22, alignItems: 'center' },
  chal: { flex: 1, paddingVertical: 18, paddingHorizontal: 20 },
  noHover: {},
  chalList: { marginTop: 8, marginHorizontal: -8 },
  more: { alignSelf: 'center', marginTop: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lineOpen: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10 },
  remove: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  removeHover: { backgroundColor: dx.ghostHover },
  incomingHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  incomingActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  chalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, marginHorizontal: -8, padding: 8, borderRadius: 10 },
  incoming: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
});

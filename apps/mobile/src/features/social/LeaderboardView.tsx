import { streakState } from '@tac/core/format';
import type { TrainingStyle } from '@tac/core/rules';
import { levelFor } from '@tac/core/runner';
import { eos, graphite, layout, radii, rank, semantic, shadows, space } from '@tac/core/tokens';
import { FlashList, type FlashListRef, type ViewToken } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Medal, Zap } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { feel } from '@/feel';
import { Avatar, VerifiedBadge } from '@/features/profile/Avatar';
import { StyleIcon, STYLE_ORDER } from '@/features/stats/StyleIcon';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { useT, type TFn } from '@/ui/lang';
import { Segmented } from '@/ui/Segmented';
import { Card } from '@/ui/Surfaces';
import { Tap } from '@/ui/Tap';
import { displayNameOf } from './actions';
import {
  LEADERBOARD_LIMIT,
  leaderboardQuery,
  leagueQuery,
  type LeaderboardRow,
  type LeaderboardScope,
  type LeagueRow,
  type UserCard,
} from './api';
import { LEADERBOARD_ME_ROW } from './flags';
import { readBoardScope, readBoardStyle, writeBoardScope, writeBoardStyle } from './prefs';
import { StreakBadge } from './StreakBadge';
import { openProfile, UserIdentity } from './UserIdentity';

/** Web medal colours (gold, silver, bronze) from the nearest tokens. */
export const MEDAL = [rank.intermediate.color, graphite[300], rank.advanced.color];
/** Own-row highlight (web: inset ember/55 ring on #2e262c). */
const SELF_RING = semantic.accent;

/** One place on either board: the all-time board's level (D39) or the league's weekly XP. */
type Entry = {
  rank: number | null;
  value: number;
  isSelf: boolean;
  streakDays: number;
  streakLastDay: string | null;
  user: UserCard;
};

/** How a board draws its number: the style icon + level, or a bolt + XP. */
type Metric = {
  icon: (size: number) => ReactNode;
  a11y: (rank: number | string, name: string, value: number) => string;
};

const fromBoard = (r: LeaderboardRow): Entry => ({ ...r, value: r.level ?? r.rating });
const fromLeague = (r: LeagueRow): Entry => ({ ...r, value: r.xp });

/**
 * The all-time board (web /leaderboard; ranked by level since D39): style + scope switches
 * (remembered on the device), a top-3 podium, then a virtualised list.
 * `top` scrolls above the switches (Rivals' Challenges, the period switch).
 */
export function LeaderboardView({ top }: { top?: ReactNode } = {}) {
  const t = useT();
  const [style, setStyle] = useState<TrainingStyle>(readBoardStyle);
  const [scope, setScope] = useState<LeaderboardScope>(readBoardScope);
  const q = useQuery(leaderboardQuery(style, scope));
  const rows = (q.data ?? []).map(fromBoard);

  // Outside the top N on the global board (B13 pending) only the level is known.
  const myLevel = useAppStore((s) => levelFor(s.progressions[style]));
  const me = useAuthStore((s) => s.user);
  const outside =
    !rows.some((r) => r.isSelf) && !LEADERBOARD_ME_ROW && q.data && scope === 'global' && rows.length >= LEADERBOARD_LIMIT && me
      ? {
          entry: {
            rank: null,
            value: myLevel,
            isSelf: true,
            streakDays: 0,
            streakLastDay: null,
            user: { id: me.id, nickname: me.nickname, displayName: me.displayName ?? null, avatarUrl: me.avatarUrl ?? null, country: null, verified: me.verified },
          },
          rankLabel: `${LEADERBOARD_LIMIT}+`,
        }
      : null;

  const metric: Metric = {
    icon: (size) => <StyleIcon style={style} size={size} color={eos.ash} />,
    a11y: (rank, name, rating) => t('leaderboard.rank_a11y', { rank, name, rating }),
  };

  return (
    <RankedList
      rows={rows}
      outside={outside}
      metric={metric}
      loaded={!!q.data}
      dim={q.isPlaceholderData}
      refetch={q.refetch}
      testID="leaderboard"
      header={
        <>
          {top}
          <Segmented
            options={STYLE_ORDER.map((s) => ({ value: s, label: t(`style.${s}.name`) }))}
            value={style}
            onChange={(s) => {
              setStyle(s);
              writeBoardStyle(s);
            }}
            testID="board-style"
            accessibilityLabel={t('leaderboard.style_label')}
          />
          <ScopeSwitch scope={scope} onChange={setScope} t={t} />
          {q.isError && !q.data ? <ErrorCard t={t} /> : null}
          {q.data && rows.length === 0 ? (
            <EmptyCard text={scope === 'friends' ? t('leaderboard.empty_friends') : t('leaderboard.empty')} />
          ) : null}
        </>
      }
    />
  );
}

/**
 * The weekly league (owner, 2026-11-04): XP earned since Monday 00:00
 * Kyiv time, all modes, for everyone or friends. The viewer's own row docks
 * at the bottom when it is off the list (server `self`).
 */
export function LeagueView({ top }: { top?: ReactNode } = {}) {
  const t = useT();
  const [scope, setScope] = useState<LeaderboardScope>(readBoardScope);
  const q = useQuery(leagueQuery(scope));
  const rows = (q.data?.rows ?? []).map(fromLeague);
  const self = q.data?.self ? fromLeague(q.data.self) : null;

  const metric: Metric = {
    icon: (size) => <Zap size={size} color={eos.ash} strokeWidth={1.8} />,
    a11y: (rank, name, xp) => t('league.rank_a11y', { rank, name, xp }),
  };

  return (
    <RankedList
      rows={rows}
      outside={self ? { entry: self, rankLabel: self.rank != null ? String(self.rank) : '—' } : null}
      metric={metric}
      loaded={!!q.data}
      dim={q.isPlaceholderData}
      refetch={q.refetch}
      testID="league"
      header={
        <>
          {top}
          <View style={styles.leagueHead}>
            <ScopeSwitch scope={scope} onChange={setScope} t={t} />
            {q.data ? (
              <AppText variant="captionStrong" color={eos.ash} testID="league-ends">
                {t('league.ends_in', { left: weekLeft(t, q.data.weekEnd) })}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" color={eos.dust}>
            {t('league.hint')}
          </AppText>
          {q.isError && !q.data ? <ErrorCard t={t} /> : null}
          {q.data && rows.length === 0 ? (
            <EmptyCard text={scope === 'friends' ? t('league.empty_friends') : t('league.empty')} />
          ) : null}
        </>
      }
    />
  );
}

export function weekLeft(t: TFn, endIso: string, now = Date.now()): string {
  const h = Math.max(0, Math.floor((new Date(endIso).getTime() - now) / 3600_000));
  return h >= 24 ? t('league.left_dh', { d: Math.floor(h / 24), h: h % 24 }) : t('league.left_h', { h: Math.max(1, h) });
}

function ScopeSwitch({ scope, onChange, t }: { scope: LeaderboardScope; onChange: (s: LeaderboardScope) => void; t: TFn }) {
  return (
    <View style={styles.scope}>
      <Segmented
        options={[
          { value: 'global' as const, label: t('leaderboard.scope_global') },
          { value: 'friends' as const, label: t('leaderboard.scope_friends') },
        ]}
        value={scope}
        onChange={(s) => {
          onChange(s);
          writeBoardScope(s);
        }}
        size="sm"
        testID="board-scope"
        accessibilityLabel={t('leaderboard.scope_label')}
      />
    </View>
  );
}

function ErrorCard({ t }: { t: TFn }) {
  return (
    <Card testID="board-error">
      <AppText variant="body" color={eos.ash}>
        {t('leaderboard.error')}
      </AppText>
    </Card>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card testID="board-empty">
      <AppText variant="body" color={eos.ash} style={styles.center}>
        {text}
      </AppText>
    </Card>
  );
}

/**
 * Podium + virtualised rows shared by both boards. Your own row is ringed;
 * when it is scrolled away (or off the list: `outside`) it docks at the
 * bottom, tap to jump back.
 */
function RankedList({
  rows,
  outside,
  metric,
  header,
  loaded,
  dim,
  refetch,
  testID,
}: {
  rows: Entry[];
  outside: { entry: Entry; rankLabel: string } | null;
  metric: Metric;
  header: ReactNode;
  loaded: boolean;
  dim: boolean;
  refetch: () => Promise<unknown>;
  testID: string;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [selfVisible, setSelfVisible] = useState(true);
  const list = useRef<FlashListRef<Entry>>(null);

  const podium = rows.length >= 3 ? rows.slice(0, 3) : [];
  const rest = rows.length >= 3 ? rows.slice(3) : rows;
  const selfIndex = rest.findIndex((r) => r.isSelf);
  const selfRow = rows.find((r) => r.isSelf) ?? null;
  const selfOnPodium = podium.some((r) => r.isSelf);

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const onViewable = ({ viewableItems }: { viewableItems: ViewToken<Entry>[] }) => {
    const seen = viewableItems.some((v) => v.item?.isSelf);
    setSelfVisible((prev) => (prev === seen ? prev : seen));
  };

  let dock: { entry: Entry; rankLabel: string } | null = null;
  if (selfRow && !selfOnPodium && !selfVisible) dock = { entry: selfRow, rankLabel: String(selfRow.rank) };
  else if (!selfRow && loaded && outside) dock = outside;

  return (
    <View style={styles.root} testID={testID}>
      <FlashList
        ref={list}
        data={rest}
        keyExtractor={(r) => r.user.id}
        renderItem={({ item }) => <BoardRow row={item} metric={metric} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {header}
            {podium.length === 3 ? <Podium rows={podium} metric={metric} /> : null}
          </View>
        }
        ItemSeparatorComponent={Gap}
        contentContainerStyle={[styles.content, dim && styles.dim]}
        onViewableItemsChanged={onViewable}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={eos.ash} />}
        testID="board-list"
      />
      {dock ? (
        <View style={styles.dock} testID="board-self-dock">
          <BoardRow
            row={dock.entry}
            metric={metric}
            rankLabel={dock.rankLabel}
            onPress={
              selfIndex >= 0
                ? () => list.current?.scrollToIndex({ index: selfIndex, animated: true, viewPosition: 0.5 })
                : undefined
            }
          />
        </View>
      ) : null}
    </View>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

function Podium({ rows, metric }: { rows: Entry[]; metric: Metric }) {
  // 2nd · 1st · 3rd, the winner raised.
  const order = [rows[1], rows[0], rows[2]];
  return (
    <View style={styles.podium} testID="board-podium">
      {order.map((r) => (
        <PodiumPlace key={r.user.id} row={r} metric={metric} first={r.rank === 1} />
      ))}
    </View>
  );
}

function PodiumPlace({ row, metric, first }: { row: Entry; metric: Metric; first: boolean }) {
  const name = displayNameOf(row.user);
  const place = row.rank ?? 0;
  return (
    <Tap
      testID={`board-podium-${place}`}
      accessibilityRole="button"
      accessibilityLabel={metric.a11y(place, name, row.value)}
      onPress={() => openProfile(row.user.nickname)}
      style={[styles.place, first && styles.placeFirst]}
    >
      <View style={[styles.placeCard, first && styles.placeCardFirst, row.isSelf && styles.selfRing]}>
        <Medal size={first ? 22 : 18} color={MEDAL[place - 1]} />
        <Avatar nickname={row.user.nickname} avatarUrl={row.user.avatarUrl} size={first ? 60 : 48} />
        <View style={styles.placeName}>
          <AppText variant="body" numberOfLines={1} style={styles.shrink}>
            {name}
          </AppText>
          <VerifiedBadge verified={row.user.verified} size={12} />
        </View>
        <View style={styles.rating}>
          {metric.icon(14)}
          <AppText variant="value" style={first ? undefined : styles.placeValue}>
            {String(row.value)}
          </AppText>
        </View>
      </View>
    </Tap>
  );
}

function BoardRow({
  row,
  metric,
  rankLabel,
  onPress,
}: {
  row: Entry;
  metric: Metric;
  rankLabel?: string;
  onPress?: () => void;
}) {
  const showStreak = useAppStore((s) => s.settings.showStreak);
  const st = streakState(row.streakDays, row.streakLastDay);
  const name = displayNameOf(row.user);
  const medal = row.rank != null && row.rank >= 1 && row.rank <= 3 ? MEDAL[row.rank - 1] : null;
  const label = rankLabel ?? String(row.rank ?? '—');
  return (
    <Tap
      testID={row.isSelf ? 'board-row-self' : `board-row-${row.user.nickname}`}
      accessibilityRole="button"
      accessibilityLabel={metric.a11y(label, name, row.value)}
      onPress={onPress ?? (() => openProfile(row.user.nickname))}
    >
      <View style={[styles.row, row.isSelf && styles.selfRow]}>
        <View style={styles.rankCol}>
          {medal ? (
            <Medal size={18} color={medal} />
          ) : (
            <AppText variant="body" color={eos.dust} style={styles.tabular} numberOfLines={1} adjustsFontSizeToFit>
              {label}
            </AppText>
          )}
        </View>
        <UserIdentity user={row.user} />
        {showStreak && (st === 'secured' || st === 'at_risk') ? <StreakBadge days={row.streakDays} size="sm" /> : null}
        <View style={styles.rating}>
          {metric.icon(16)}
          <AppText variant="body" style={styles.ratingText}>
            {String(row.value)}
          </AppText>
        </View>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, paddingBottom: space[20] },
  dim: { opacity: 0.6 },
  header: { gap: space[3], paddingTop: space[3], paddingBottom: space[3] },
  scope: { alignSelf: 'flex-start', minWidth: 220 },
  leagueHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  center: { textAlign: 'center' },
  gap: { height: space[1.5] },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2], marginTop: space[2] },
  place: { flex: 1 },
  placeFirst: { marginBottom: space[3] },
  placeCard: {
    alignItems: 'center',
    gap: space[1.5],
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    borderRadius: radii.cardComponent,
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  placeCardFirst: { paddingVertical: space[4], borderColor: rank.intermediate.glow },
  placeName: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  placeValue: { fontSize: 20, lineHeight: 26 },
  selfRing: { borderColor: SELF_RING },
  shrink: { flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radii.card,
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  selfRow: { borderColor: SELF_RING, backgroundColor: eos.embers },
  rankCol: { width: 32, alignItems: 'center' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontVariant: ['tabular-nums'], fontSize: 16 },
  tabular: { fontVariant: ['tabular-nums'] },
  dock: {
    position: 'absolute',
    left: layout.gutter,
    right: layout.gutter,
    bottom: space[2],
    borderRadius: radii.card,
    boxShadow: [shadows.heroCard[1]],
  },
});

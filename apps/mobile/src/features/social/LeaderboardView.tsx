import { streakState } from '@tac/core/format';
import type { TrainingStyle } from '@tac/core/rules';
import { eos, graphite, layout, radii, rank, semantic, shadows, space } from '@tac/core/tokens';
import { FlashList, type FlashListRef, type ViewToken } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Medal } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { feel } from '@/feel';
import { Avatar, VerifiedBadge } from '@/features/profile/Avatar';
import { StyleIcon, STYLE_ORDER } from '@/features/stats/StyleIcon';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { useT } from '@/ui/lang';
import { Segmented } from '@/ui/Segmented';
import { Card } from '@/ui/Surfaces';
import { Tap } from '@/ui/Tap';
import { displayNameOf } from './actions';
import { LEADERBOARD_LIMIT, leaderboardQuery, type LeaderboardRow, type LeaderboardScope } from './api';
import { LEADERBOARD_ME_ROW } from './flags';
import { readBoardScope, readBoardStyle, writeBoardScope, writeBoardStyle } from './prefs';
import { StreakBadge } from './StreakBadge';
import { openProfile, UserIdentity } from './UserIdentity';

/** Web medal colours (gold, silver, bronze) from the nearest tokens. */
const MEDAL = [rank.intermediate.color, graphite[300], rank.advanced.color];
/** Own-row highlight (web: inset ember/55 ring on #2e262c). */
const SELF_RING = semantic.accent;

/**
 * Leaderboard (web /leaderboard): style + scope switches (remembered on the
 * device), a top-3 podium, then a virtualised list. Your own row is ringed;
 * when it is scrolled away it docks at the bottom, tap to jump back.
 */
export function LeaderboardView() {
  const t = useT();
  const [style, setStyle] = useState<TrainingStyle>(readBoardStyle);
  const [scope, setScope] = useState<LeaderboardScope>(readBoardScope);
  const q = useQuery(leaderboardQuery(style, scope));
  const [refreshing, setRefreshing] = useState(false);
  const [selfVisible, setSelfVisible] = useState(true);
  const list = useRef<FlashListRef<LeaderboardRow>>(null);

  const rows = q.data ?? [];
  const podium = rows.length >= 3 ? rows.slice(0, 3) : [];
  const rest = rows.length >= 3 ? rows.slice(3) : rows;
  const selfIndex = rest.findIndex((r) => r.isSelf);
  const selfRow = rows.find((r) => r.isSelf) ?? null;
  const selfOnPodium = podium.some((r) => r.isSelf);

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    await q.refetch();
    setRefreshing(false);
  };

  const onViewable = ({ viewableItems }: { viewableItems: ViewToken<LeaderboardRow>[] }) => {
    const seen = viewableItems.some((v) => v.item?.isSelf);
    setSelfVisible((prev) => (prev === seen ? prev : seen));
  };

  const header = (
    <View style={styles.header}>
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
      <View style={styles.scope}>
        <Segmented
          options={[
            { value: 'global' as const, label: t('leaderboard.scope_global') },
            { value: 'friends' as const, label: t('leaderboard.scope_friends') },
          ]}
          value={scope}
          onChange={(s) => {
            setScope(s);
            writeBoardScope(s);
          }}
          size="sm"
          testID="board-scope"
          accessibilityLabel={t('leaderboard.scope_label')}
        />
      </View>
      {q.isError && !q.data ? (
        <Card testID="board-error">
          <AppText variant="body" color={eos.ash}>
            {t('leaderboard.error')}
          </AppText>
        </Card>
      ) : null}
      {q.data && rows.length === 0 ? (
        <Card testID="board-empty">
          <AppText variant="body" color={eos.ash} style={styles.center}>
            {scope === 'friends' ? t('leaderboard.empty_friends') : t('leaderboard.empty')}
          </AppText>
        </Card>
      ) : null}
      {podium.length === 3 ? <Podium rows={podium} style={style} /> : null}
    </View>
  );

  // Docked self row: in the list but scrolled away, or (B13 pending) outside
  // the top N on the global board, where only the rating is known.
  const myRating = useAppStore((s) => s.progressions[style].currentPuzzleRating);
  const me = useAuthStore((s) => s.user);
  let dock: { row: LeaderboardRow; rankLabel: string } | null = null;
  if (selfRow && !selfOnPodium && !selfVisible) {
    dock = { row: selfRow, rankLabel: String(selfRow.rank) };
  } else if (!selfRow && !LEADERBOARD_ME_ROW && q.data && scope === 'global' && rows.length >= LEADERBOARD_LIMIT && me) {
    dock = {
      row: {
        rank: 0,
        rating: myRating,
        unlocked: 0,
        isSelf: true,
        streakDays: 0,
        streakLastDay: null,
        user: { id: me.id, nickname: me.nickname, displayName: me.displayName ?? null, avatarUrl: me.avatarUrl ?? null, country: null, verified: me.verified },
      },
      rankLabel: `${LEADERBOARD_LIMIT}+`,
    };
  }

  return (
    <View style={styles.root} testID="leaderboard">
      <FlashList
        ref={list}
        data={rest}
        keyExtractor={(r) => r.user.id}
        renderItem={({ item }) => <BoardRow row={item} style={style} />}
        ListHeaderComponent={header}
        ItemSeparatorComponent={Gap}
        contentContainerStyle={[styles.content, q.isPlaceholderData && styles.dim]}
        onViewableItemsChanged={onViewable}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={eos.ash} />}
        testID="board-list"
      />
      {dock ? (
        <View style={styles.dock} testID="board-self-dock">
          <BoardRow
            row={dock.row}
            style={style}
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

function Podium({ rows, style }: { rows: LeaderboardRow[]; style: TrainingStyle }) {
  // 2nd · 1st · 3rd, the winner raised.
  const order = [rows[1], rows[0], rows[2]];
  return (
    <View style={styles.podium} testID="board-podium">
      {order.map((r) => (
        <PodiumPlace key={r.user.id} row={r} style={style} first={r.rank === 1} />
      ))}
    </View>
  );
}

function PodiumPlace({ row, style, first }: { row: LeaderboardRow; style: TrainingStyle; first: boolean }) {
  const t = useT();
  const name = displayNameOf(row.user);
  return (
    <Tap
      testID={`board-podium-${row.rank}`}
      accessibilityRole="button"
      accessibilityLabel={t('leaderboard.rank_a11y', { rank: row.rank, name, rating: row.rating })}
      onPress={() => openProfile(row.user.nickname)}
      style={[styles.place, first && styles.placeFirst]}
    >
      <View style={[styles.placeCard, first && styles.placeCardFirst, row.isSelf && styles.selfRing]}>
        <Medal size={first ? 22 : 18} color={MEDAL[row.rank - 1]} />
        <Avatar nickname={row.user.nickname} avatarUrl={row.user.avatarUrl} size={first ? 60 : 48} />
        <View style={styles.placeName}>
          <AppText variant="body" numberOfLines={1} style={styles.shrink}>
            {name}
          </AppText>
          <VerifiedBadge verified={row.user.verified} size={12} />
        </View>
        <View style={styles.rating}>
          <StyleIcon style={style} size={14} color={eos.ash} />
          <AppText variant="value" style={first ? undefined : styles.placeValue}>
            {String(row.rating)}
          </AppText>
        </View>
      </View>
    </Tap>
  );
}

function BoardRow({
  row,
  style,
  rankLabel,
  onPress,
}: {
  row: LeaderboardRow;
  style: TrainingStyle;
  rankLabel?: string;
  onPress?: () => void;
}) {
  const t = useT();
  const showStreak = useAppStore((s) => s.settings.showStreak);
  const st = streakState(row.streakDays, row.streakLastDay);
  const name = displayNameOf(row.user);
  const medal = row.rank >= 1 && row.rank <= 3 ? MEDAL[row.rank - 1] : null;
  return (
    <Tap
      testID={row.isSelf ? 'board-row-self' : `board-row-${row.user.nickname}`}
      accessibilityRole="button"
      accessibilityLabel={t('leaderboard.rank_a11y', { rank: rankLabel ?? row.rank, name, rating: row.rating })}
      onPress={onPress ?? (() => openProfile(row.user.nickname))}
    >
      <View style={[styles.row, row.isSelf && styles.selfRow]}>
        <View style={styles.rankCol}>
          {medal ? (
            <Medal size={18} color={medal} />
          ) : (
            <AppText variant="body" color={eos.dust} style={styles.tabular} numberOfLines={1} adjustsFontSizeToFit>
              {rankLabel ?? String(row.rank)}
            </AppText>
          )}
        </View>
        <UserIdentity user={row.user} />
        {showStreak && (st === 'secured' || st === 'at_risk') ? <StreakBadge days={row.streakDays} size="sm" /> : null}
        <View style={styles.rating}>
          <StyleIcon style={style} size={16} color={eos.ash} />
          <AppText variant="body" style={styles.ratingText}>
            {String(row.rating)}
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

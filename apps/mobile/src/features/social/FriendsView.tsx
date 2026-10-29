import { eos, layout, radii, semantic, space } from '@tac/core/tokens';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, Clock, Search, UserMinus, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { feel } from '@/feel';
import { AppText } from '@/ui/AppText';
import { MiniButton } from '@/ui/Buttons';
import { useT } from '@/ui/lang';
import { Card } from '@/ui/Surfaces';
import { Tap } from '@/ui/Tap';
import { acceptRequest, confirmUnfriend, displayNameOf, removeRequest } from './actions';
import { friendsQuery, pendingQuery, type FriendRow, type PendingRow } from './api';
import { SwipeRow } from './SwipeRow';
import { openProfile, UserIdentity } from './UserIdentity';

type Item =
  | { kind: 'find' }
  | { kind: 'header'; key: string; label: string }
  | { kind: 'hint' }
  | { kind: 'incoming'; r: PendingRow }
  | { kind: 'outgoing'; r: PendingRow }
  | { kind: 'friend'; r: FriendRow }
  | { kind: 'empty' }
  | { kind: 'error' };

/**
 * Friends (web /friends): search entry, incoming requests (swipe right to
 * accept, left to decline), sent requests, friends (unfriend behind a
 * confirm). Shared by the Social tab's Friends side and the pushed
 * /friends route from the avatar menu.
 */
export function FriendsView() {
  const t = useT();
  const friends = useQuery(friendsQuery());
  const pending = useQuery(pendingQuery());
  const [refreshing, setRefreshing] = useState(false);
  // Rows acted on stay hidden until the refetch, so they never pop back.
  // Keys are prefixed: an accepted request keeps its id as the friendship.
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const hide = (key: string) => setGone((s) => new Set(s).add(key));

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    await Promise.allSettled([friends.refetch(), pending.refetch()]);
    setRefreshing(false);
  };

  const incoming = (pending.data?.incoming ?? []).filter((r) => !gone.has(`req:${r.id}`));
  const outgoing = (pending.data?.outgoing ?? []).filter((r) => !gone.has(`req:${r.id}`));
  const mine = (friends.data ?? []).filter((r) => !gone.has(`friend:${r.friendshipId}`));

  const items: Item[] = [{ kind: 'find' }];
  if (friends.isError && pending.isError && !friends.data) items.push({ kind: 'error' });
  if (incoming.length > 0) {
    items.push({ kind: 'header', key: 'in', label: `${t('friends.incoming')} (${incoming.length})` });
    items.push({ kind: 'hint' });
    for (const r of incoming) items.push({ kind: 'incoming', r });
  }
  if (outgoing.length > 0) {
    items.push({ kind: 'header', key: 'out', label: `${t('friends.outgoing')} (${outgoing.length})` });
    for (const r of outgoing) items.push({ kind: 'outgoing', r });
  }
  items.push({ kind: 'header', key: 'my', label: `${t('friends.my')} (${mine.length})` });
  if (friends.data && mine.length === 0) items.push({ kind: 'empty' });
  for (const r of mine) items.push({ kind: 'friend', r });

  const render = (it: Item) => {
    switch (it.kind) {
      case 'find':
        return (
          <Tap
            testID="friends-find"
            accessibilityRole="search"
            accessibilityLabel={t('friends.find')}
            onPress={() => router.push('/friends/search')}
          >
            <View style={styles.find}>
              <Search size={16} color={eos.dust} />
              <AppText variant="body" color={eos.dust}>
                {t('friends.search_placeholder')}
              </AppText>
            </View>
          </Tap>
        );
      case 'header':
        return (
          <AppText variant="sectionLabel" style={styles.header} accessibilityRole="header" testID={`friends-h-${it.key}`}>
            {it.label}
          </AppText>
        );
      case 'hint':
        return (
          <AppText variant="caption" color={eos.dust} style={styles.hint}>
            {t('friends.swipe_hint')}
          </AppText>
        );
      case 'error':
        return (
          <Card testID="friends-error">
            <AppText variant="body" color={eos.ash}>
              {t('friends.error')}
            </AppText>
            <MiniButton testID="friends-retry" label={t('friends.retry')} onPress={() => void onRefresh()} />
          </Card>
        );
      case 'empty':
        return (
          <Card testID="friends-empty">
            <AppText variant="body" color={eos.ash} style={styles.center}>
              {t('friends.empty')}
            </AppText>
          </Card>
        );
      case 'incoming': {
        const { r } = it;
        const accept = async () => {
          const ok = await acceptRequest(r.id, r.user);
          if (ok) hide(`req:${r.id}`);
          return ok;
        };
        const decline = async () => {
          const ok = await removeRequest(r.id, r.user, 'decline');
          if (ok) hide(`req:${r.id}`);
          return ok;
        };
        return (
          <SwipeRow
            testID={`friends-in-${r.user.nickname}`}
            acceptLabel={t('friends.accept')}
            declineLabel={t('friends.decline')}
            onAccept={accept}
            onDecline={decline}
          >
            <Row onOpen={() => openProfile(r.user.nickname)} nickname={r.user.nickname} identity={<UserIdentity user={r.user} />}>
              <MiniButton
                testID={`friends-accept-${r.user.nickname}`}
                label={t('friends.accept')}
                icon={Check}
                variant="ember"
                onPress={() => void accept()}
              />
              <MiniButton
                testID={`friends-decline-${r.user.nickname}`}
                label={t('friends.decline')}
                icon={X}
                iconOnly
                onPress={() => void decline()}
              />
            </Row>
          </SwipeRow>
        );
      }
      case 'outgoing': {
        const { r } = it;
        return (
          <Row
            onOpen={() => openProfile(r.user.nickname)}
            nickname={r.user.nickname}
            identity={
              <UserIdentity
                user={r.user}
                extra={
                  <View style={styles.waiting}>
                    <Clock size={10} color={eos.dust} />
                    <AppText variant="caption" color={eos.dust}>
                      {t('friends.waiting')}
                    </AppText>
                  </View>
                }
              />
            }
          >
            <MiniButton
              testID={`friends-cancel-${r.user.nickname}`}
              label={t('friends.cancel')}
              icon={X}
              onPress={() =>
                void removeRequest(r.id, r.user, 'cancel').then((ok) => {
                  if (ok) hide(`req:${r.id}`);
                })
              }
            />
          </Row>
        );
      }
      case 'friend': {
        const { r } = it;
        return (
          <Row onOpen={() => openProfile(r.user.nickname)} nickname={r.user.nickname} identity={<UserIdentity user={r.user} />}>
            <MiniButton
              testID={`friends-unfriend-${r.user.nickname}`}
              label={t('friends.unfriend')}
              accessibilityLabel={`${t('friends.unfriend')}: ${displayNameOf(r.user)}`}
              icon={UserMinus}
              iconOnly
              onPress={() =>
                confirmUnfriend(r.user, (ok) => {
                  if (ok) hide(`friend:${r.friendshipId}`);
                })
              }
            />
          </Row>
        );
      }
    }
  };

  return (
    <FlashList
      data={items}
      keyExtractor={(it, i) =>
        it.kind === 'incoming' || it.kind === 'outgoing'
          ? it.r.id
          : it.kind === 'friend'
            ? it.r.friendshipId
            : it.kind === 'header'
              ? `h-${it.key}`
              : `${it.kind}-${i}`
      }
      getItemType={(it) => it.kind}
      renderItem={({ item }) => render(item)}
      ItemSeparatorComponent={Gap}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={eos.ash} />}
      keyboardDismissMode="on-drag"
      testID="friends-list"
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

/** Glass row: the identity half opens the profile; actions sit on the right. */
function Row({
  identity,
  children,
  onOpen,
  nickname,
}: {
  identity: ReactNode;
  children: ReactNode;
  onOpen: () => void;
  nickname: string;
}) {
  const t = useT();
  return (
    <View style={styles.row}>
      <Tap
        testID={`friends-open-${nickname}`}
        accessibilityRole="link"
        accessibilityLabel={`${nickname}, ${t('shell.menu.profile')}`}
        onPress={onOpen}
        style={styles.open}
      >
        {identity}
      </Tap>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingTop: space[3], paddingBottom: space[10] },
  gap: { height: space[1.5] },
  find: {
    height: layout.inputHeight,
    borderRadius: radii.control,
    backgroundColor: eos.well,
    borderWidth: 1,
    borderColor: semantic.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: layout.inputPaddingX,
  },
  header: { marginTop: space[4] },
  hint: { marginTop: -2 },
  center: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[2.5],
    borderRadius: radii.card,
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
  },
  open: { flex: 1, minWidth: 0 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
});

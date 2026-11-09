import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { Search, Swords, UserRound, X } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import "@/features/achievements/icons";
import { Avatar, VerifiedBadge } from "@/features/profile/Avatar";
import {
  acceptRequest,
  displayNameOf,
  removeRequest,
} from "@/features/social/actions";
import {
  friendsQuery,
  pendingQuery,
  type FriendRow,
  type PendingRow,
  type UserCard,
} from "@/features/social/api";
import { openProfile } from "@/features/social/UserIdentity";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/ui/lang";
import { PlateButton } from "@/ui/PlateButton";
import { DesktopPage } from "../Page";
import { Card, DText, GhostButton, Hover, Label, Pill } from "../kit";
import { dx } from "../tokens";
import { useNarrow } from "./parts";

/**
 * DXFriends (/friends): the search field (opens the app's player search),
 * your friends with Challenge + profile, and on the right the incoming
 * requests (accept / decline) and the requests you sent (cancel). Same
 * queries and actions as the phone Friends list.
 */
export function DxFriends() {
  const t = useT();
  const nickname = useAuthStore((s) => s.user?.nickname ?? "");
  const friends = useQuery(friendsQuery());
  const pending = useQuery(pendingQuery());
  // Rows acted on stay hidden until the refetch, so they never pop back.
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const hide = (id: string) => setGone((s) => new Set(s).add(id));
  // Narrow windows stack the requests under the list.
  const narrow = useNarrow();
  const incoming = (pending.data?.incoming ?? []).filter(
    (r) => !gone.has(r.id),
  );
  const outgoing = (pending.data?.outgoing ?? []).filter(
    (r) => !gone.has(r.id),
  );
  const mine = friends.data ?? [];
  const back = {
    label: t("settings.tab.profile"),
    onPress: () =>
      router.canGoBack()
        ? router.back()
        : router.navigate(`/profile/${encodeURIComponent(nickname)}` as Href),
  };

  const aside = (
    <>
      <Card style={styles.side} testID="friends-requests">
        <View style={styles.head}>
          <Label style={styles.flex}>{t("dx.account.requests")}</Label>
          {incoming.length > 0 ? (
            <Pill label={String(incoming.length)} tone="rose" />
          ) : null}
        </View>
        {incoming.length === 0 ? (
          <DText size={13} color={dx.dust} style={styles.mt10}>
            {t("dx.account.no_requests")}
          </DText>
        ) : (
          incoming.map((r, i) => (
            <SmallRow
              key={r.id}
              user={r.user}
              sub={t("dx.account.wants_to_add")}
              first={i === 0}
            >
              <GhostButton
                testID={`friends-decline-${r.user.nickname}`}
                accessibilityLabel={`${t("friends.decline")}: ${displayNameOf(r.user)}`}
                icon={X}
                square
                height={34}
                onPress={() =>
                  void removeRequest(r.id, r.user, "decline").then(
                    (ok) => ok && hide(r.id),
                  )
                }
              />
              <PlateButton
                testID={`friends-accept-${r.user.nickname}`}
                accessibilityLabel={`${t("friends.accept")}: ${displayNameOf(r.user)}`}
                label={t("friends.accept")}
                size="sm"
                onPress={() =>
                  void acceptRequest(r.id, r.user).then(
                    (ok) => ok && hide(r.id),
                  )
                }
              />
            </SmallRow>
          ))
        )}
      </Card>
      {outgoing.length > 0 ? (
        <Card style={styles.side} testID="friends-outgoing">
          <Label>{t("friends.outgoing")}</Label>
          {outgoing.map((r: PendingRow, i) => (
            <SmallRow
              key={r.id}
              user={r.user}
              sub={t("friends.waiting")}
              first={i === 0}
            >
              <GhostButton
                testID={`friends-cancel-${r.user.nickname}`}
                accessibilityLabel={`${t("friends.cancel")}: ${displayNameOf(r.user)}`}
                label={t("friends.cancel")}
                height={32}
                onPress={() =>
                  void removeRequest(r.id, r.user, "cancel").then(
                    (ok) => ok && hide(r.id),
                  )
                }
              />
            </SmallRow>
          ))}
        </Card>
      ) : null}
    </>
  );

  return (
    <DesktopPage
      title={t("friends.title")}
      back={back}
      aside={narrow ? undefined : aside}
      asideWidth={380}
      testID="dx-friends"
    >
      <View>
        <Hover
          testID="friends-find"
          accessibilityRole="button"
          accessibilityLabel={t("friends.find")}
          onPress={() => router.push("/friends/search")}
          style={styles.search}
          hoverStyle={styles.searchHover}
        >
          <Search size={16} color={dx.dust} strokeWidth={1.8} />
          <DText size={14.5} color={dx.dust} numberOfLines={1}>
            {t("friends.search_placeholder")}
          </DText>
        </Hover>

        <Label style={styles.mine}>
          {t("dx.account.your_friends", { n: mine.length })}
        </Label>
        {friends.isError && !friends.data ? (
          <Card style={styles.empty} testID="friends-error">
            <DText size={14} color={dx.ash}>
              {t("friends.error")}
            </DText>
            <GhostButton
              testID="friends-retry"
              accessibilityLabel={t("friends.retry")}
              label={t("friends.retry")}
              onPress={() => void friends.refetch()}
            />
          </Card>
        ) : friends.data && mine.length === 0 ? (
          <Card style={styles.empty} testID="friends-empty">
            <DText size={14} color={dx.ash}>
              {t("friends.empty")}
            </DText>
          </Card>
        ) : (
          <Card testID="friends-list" style={styles.list}>
            {mine.map((r, i) => (
              <FriendLine key={r.friendshipId} r={r} first={i === 0} />
            ))}
          </Card>
        )}
        {narrow ? <View style={styles.stacked}>{aside}</View> : null}
      </View>
    </DesktopPage>
  );
}

function subline(u: UserCard, extra?: string | null): string {
  return [
    u.displayName ? `@${u.nickname}` : null,
    u.country ? u.country.toUpperCase() : null,
    extra,
  ]
    .filter(Boolean)
    .join(" · ");
}

function FriendLine({ r, first }: { r: FriendRow; first: boolean }) {
  const t = useT();
  const u = r.user;
  const name = displayNameOf(u);
  const sub = subline(u, r.online ? t("dx.account.online") : null);
  return (
    <View
      style={[styles.friend, !first && styles.rule]}
      testID={`friends-row-${u.nickname}`}
    >
      <Hover
        testID={`friends-open-${u.nickname}`}
        accessibilityRole="link"
        accessibilityLabel={`${name}, ${t("shell.menu.profile")}`}
        onPress={() => openProfile(u.nickname)}
        style={styles.identity}
        hoverStyle={styles.none}
      >
        <View>
          <Avatar nickname={u.nickname} avatarUrl={u.avatarUrl} size={40} />
          {r.online ? (
            <View
              style={styles.online}
              testID={`friends-online-${u.nickname}`}
            />
          ) : null}
        </View>
        <View style={styles.flex}>
          <View style={styles.nameLine}>
            <DText weight={800} numberOfLines={1} style={styles.shrink}>
              {name}
            </DText>
            <VerifiedBadge verified={u.verified} size={13} />
          </View>
          {sub ? (
            <DText size={12.5} color={dx.dust} numberOfLines={1}>
              {sub}
            </DText>
          ) : null}
        </View>
      </Hover>
      <GhostButton
        testID={`friends-challenge-${u.nickname}`}
        accessibilityLabel={`${t("challenge.profile_action")}: ${name}`}
        icon={Swords}
        label={t("challenge.profile_action")}
        height={36}
        onPress={() =>
          router.push(
            `/challenge/new?friend=${encodeURIComponent(u.id)}` as Href,
          )
        }
      />
      <GhostButton
        testID={`friends-profile-${u.nickname}`}
        accessibilityLabel={`${name}, ${t("shell.menu.profile")}`}
        icon={UserRound}
        square
        height={36}
        onPress={() => openProfile(u.nickname)}
      />
    </View>
  );
}

/** Right-column row: 34 px avatar, name, a dim line, actions. */
function SmallRow({
  user,
  sub,
  first,
  children,
}: {
  user: UserCard;
  sub: string;
  first: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const name = displayNameOf(user);
  return (
    <View style={[styles.small, !first && styles.rule]}>
      <Hover
        testID={`friends-open-${user.nickname}`}
        accessibilityRole="link"
        accessibilityLabel={`${name}, ${t("shell.menu.profile")}`}
        onPress={() => openProfile(user.nickname)}
        style={styles.identity}
        hoverStyle={styles.none}
      >
        <Avatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={34} />
        <View style={styles.flex}>
          <DText size={13.5} weight={700} numberOfLines={1}>
            {name}
          </DText>
          <DText size={12} color={dx.dust} numberOfLines={1}>
            {sub}
          </DText>
        </View>
      </Hover>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  none: {},
  mt10: { marginTop: 10 },
  search: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: dx.input,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 0,
        blurRadius: 0,
        spreadDistance: 1,
        color: dx.inputEdge,
        inset: true,
      },
    ],
  },
  searchHover: { backgroundColor: dx.track },
  mine: { marginTop: 20 },
  list: { marginTop: 10 },
  stacked: { gap: 16, marginTop: 20 },
  empty: { marginTop: 10, padding: 20, gap: 12, alignItems: "flex-start" },
  friend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  rule: { borderTopWidth: 1, borderTopColor: dx.rowRule },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  online: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: dx.sage,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 0,
        blurRadius: 0,
        spreadDistance: 2,
        color: dx.card,
      },
    ],
  },
  side: { paddingVertical: 18, paddingHorizontal: 20 },
  head: { flexDirection: "row", alignItems: "center" },
  small: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    marginTop: 2,
  },
});

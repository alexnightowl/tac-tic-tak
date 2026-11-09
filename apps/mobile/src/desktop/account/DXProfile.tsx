import { achievementNameKey } from '@tac/core/catalogs';
import { queryKeys } from '@tac/core/api';
import { groupSessionsByDay, localeFor, type SessionRow } from '@tac/core/format';
import { isTrainingStyle } from '@tac/core/rules';
import { levelFor } from '@tac/core/runner';
import { alpha, eos, graphite, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { ChevronRight, Pencil, Share2, Swords, Users, X, Check, UserMinus, UserPlus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import '@/features/achievements/icons';
import { achievementsQuery } from '@/features/achievements/api';
import { openAchievement } from '@/features/achievements/AchievementsGrid';
import { Medal } from '@/features/achievements/Medal';
import { fmtXp } from '@/features/experience/xp';
import { Avatar, VerifiedBadge } from '@/features/profile/Avatar';
import { shareProfile } from '@/features/profile/ProfileScreen';
import { sessionThemeLabel } from '@/features/sessions/format';
import { acceptRequest, confirmUnfriend, removeRequest, sendRequest } from '@/features/social/actions';
import { friendshipQuery, friendsQuery, profileQuery, type PublicProfile, type UserCard } from '@/features/social/api';
import { StyleIcon, STYLE_ORDER } from '@/features/stats/StyleIcon';
import { api } from '@/platform/api';
import { useAuthStore } from '@/stores/authStore';
import { scriptLang } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { DesktopPage } from '../Page';
import { Card, DText, GhostButton, Hover, Label, Num, Tile } from '../kit';
import { dx } from '../tokens';
import { DxProfileEdit } from './DXProfileEdit';
import { RankPiece, useNarrow, XpBar } from './parts';

const DASH = '—';

/** "October 2026" / "жовтня 2026" (uk wants the genitive after "з"). */
function monthYear(iso: string, lang: 'en' | 'uk'): string {
  const d = new Date(iso);
  const locale = localeFor(lang);
  if (lang !== 'uk') return d.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
  const month = d.toLocaleDateString(locale, { day: 'numeric', month: 'long' }).replace(/^\d+\s*/, '');
  return `${month} ${d.getFullYear()}`;
}
/** Medals shown on the profile card (the latest unlocks). */
const MEDALS = 6;

/**
 * DXProfile (/profile/:nickname): the textured header card (avatar, name,
 * country, @nick · member since, bio; Friends · N, Share, Edit for you,
 * the friendship actions for another player), the three style ratings,
 * your XP card (→ /experience), recent sessions and, for you, the
 * achievements card. Data and actions are the phone profile's.
 */
export function DxProfile({ nickname }: { nickname: string }) {
  const t = useT();
  const me = useAuthStore((s) => s.user);
  const isSelf = !!me && me.nickname.toLowerCase() === nickname.toLowerCase();
  const profile = useQuery(profileQuery(nickname));
  const [editing, setEditing] = useState(false);
  const narrow = useNarrow();
  const data = profile.data;

  if (!data) {
    const notFound = (profile.error as { status?: number } | null)?.status === 404;
    return (
      <DesktopPage title={t('settings.tab.profile')} right={null} testID="dx-profile">
        {profile.isPending ? (
          <View testID="profile-loading">
            <View style={[styles.skel, { height: 152 }]} />
            <View style={[styles.skel, { height: 110, marginTop: 20 }]} />
          </View>
        ) : (
          <Card style={styles.missing} testID={notFound ? 'profile-not-found' : 'profile-error'}>
            <DText serif weight={700} size={20}>
              {notFound ? t('profile.not_found_title') : t('profile.error')}
            </DText>
            {notFound ? (
              <DText size={14} color={dx.ash}>
                {t('profile.not_found_hint', { nickname })}
              </DText>
            ) : (
              <GhostButton testID="profile-retry" accessibilityLabel={t('profile.retry')} label={t('profile.retry')} onPress={() => void profile.refetch()} />
            )}
          </Card>
        )}
      </DesktopPage>
    );
  }

  return (
    <DesktopPage title={t('settings.tab.profile')} right={null} testID="dx-profile">
      <Hero data={data} isSelf={isSelf} onEdit={() => setEditing(true)} />
      <View style={[styles.grid, narrow && styles.stack]}>
        <View style={narrow ? styles.mainStacked : styles.main}>
          <Ratings data={data} />
          {isSelf ? <XpCard /> : null}
          <Recent data={data} isSelf={isSelf} />
        </View>
        {isSelf ? (
          <View style={narrow ? styles.asideStacked : styles.aside}>
            <Achievements />
          </View>
        ) : null}
      </View>
      {editing ? (
        <DxProfileEdit
          initial={{ displayName: data.displayName, bio: data.bio, country: data.country }}
          onClose={() => {
            setEditing(false);
            void profile.refetch();
          }}
        />
      ) : null}
    </DesktopPage>
  );
}

function Hero({ data, isSelf, onEdit }: { data: PublicProfile; isSelf: boolean; onEdit: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const friends = useQuery({ ...friendsQuery(), enabled: isSelf });
  const name = data.displayName?.trim() || data.nickname;
  const since = monthYear(data.createdAt, lang);
  return (
    <Card texture style={styles.hero} testID="profile-hero">
      <View style={styles.glow} pointerEvents="none" />
      <View style={styles.avatarRing}>
        <Avatar nickname={data.nickname} avatarUrl={data.avatarUrl} size={96} testID="profile-avatar" />
      </View>
      <View style={styles.heroText}>
        <View style={styles.nameLine}>
          <DText serif weight={700} size={30} lang={scriptLang(name)} numberOfLines={1} style={styles.shrink} testID="profile-name">
            {name}
          </DText>
          <VerifiedBadge verified={data.verified} size={18} />
          {data.country ? (
            <View style={styles.countryPill}>
              <DText size={11.5} weight={800} color={graphite[300]}>
                {data.country.toUpperCase()}
              </DText>
            </View>
          ) : null}
        </View>
        <DText size={14} color={dx.ash} numberOfLines={1} testID="profile-nickname">
          {t('dx.account.member_since', { nickname: data.nickname, date: since })}
        </DText>
        {data.bio ? (
          <DText size={14} color={graphite[300]} style={styles.bio} numberOfLines={3} testID="profile-bio">
            {data.bio}
          </DText>
        ) : null}
      </View>
      <View style={styles.heroActions}>
        {isSelf ? (
          <GhostButton
            testID="profile-friends"
            accessibilityLabel={t('nav.friends')}
            icon={Users}
            label={friends.data ? t('dx.account.friends_n', { n: friends.data.length }) : t('nav.friends')}
            onPress={() => router.push('/friends')}
          />
        ) : null}
        <GhostButton testID="profile-share" accessibilityLabel={t('profile.share')} icon={Share2} label={t('dx.account.share')} onPress={() => shareProfile(data.nickname, name, t)} />
        {isSelf ? (
          <PlateButton
            testID="profile-edit"
            label={t('profile.edit')}
            variant="slate"
            size="sm"
            icon={<Pencil size={14} color={eos.bone} strokeWidth={2} />}
            onPress={onEdit}
          />
        ) : (
          <FriendActions user={data} />
        )}
      </View>
    </Card>
  );
}

/** Another player's friendship actions (the phone FriendActionButton's states and actions). */
function FriendActions({ user }: { user: UserCard }) {
  const t = useT();
  const q = useQuery(friendshipQuery(user.nickname));
  const [busy, setBusy] = useState<string | null>(null);
  const s = q.data;
  if (!s || s.state === 'self') return null;
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };
  const off = busy !== null;
  const id = s.friendshipId;
  switch (s.state) {
    case 'none':
      return (
        <PlateButton
          testID="profile-add-friend"
          label={t('profile.add_friend')}
          size="sm"
          icon={<UserPlus size={14} color={eos.bone} strokeWidth={2} />}
          loading={busy === 'add'}
          disabled={off}
          onPress={() => void run('add', () => sendRequest(user))}
        />
      );
    case 'outgoing':
      return (
        <GhostButton
          testID="profile-cancel-request"
          accessibilityLabel={t('profile.cancel_request')}
          icon={X}
          label={t('profile.cancel_request')}
          disabled={off}
          onPress={() => id && void run('cancel', () => removeRequest(id, user, 'cancel'))}
        />
      );
    case 'incoming':
      return (
        <>
          <GhostButton
            testID="profile-decline"
            accessibilityLabel={t('friends.decline')}
            icon={X}
            label={t('friends.decline')}
            disabled={off}
            onPress={() => id && void run('decline', () => removeRequest(id, user, 'decline'))}
          />
          <PlateButton
            testID="profile-accept"
            label={t('friends.accept')}
            size="sm"
            icon={<Check size={14} color={eos.bone} strokeWidth={2} />}
            loading={busy === 'accept'}
            disabled={off}
            onPress={() => id && void run('accept', () => acceptRequest(id, user))}
          />
        </>
      );
    case 'friends':
      return (
        <>
          <GhostButton
            testID="profile-unfriend"
            accessibilityLabel={`${t('profile.friends')}. ${t('profile.unfriend')}`}
            icon={UserMinus}
            label={t('profile.unfriend')}
            disabled={off}
            onPress={() => confirmUnfriend(user)}
          />
          <PlateButton
            testID="profile-challenge"
            label={t('challenge.profile_action')}
            size="sm"
            icon={<Swords size={14} color={eos.bone} strokeWidth={2} />}
            disabled={off}
            onPress={() => router.push(`/challenge/new?friend=${encodeURIComponent(user.id)}` as Href)}
          />
        </>
      );
    default:
      return null;
  }
}

function Ratings({ data }: { data: PublicProfile }) {
  const t = useT();
  return (
    <View style={styles.tiles}>
      {STYLE_ORDER.map((s) => {
        const p = data.progressions[s];
        return (
          <Tile key={s} style={styles.tile} testID={`profile-rating-${s}`}>
            <View style={styles.row8}>
              <StyleIcon style={s} size={14} color={dx.ash} />
              <Label size={10}>{t(`style.${s}.name`)}</Label>
            </View>
            <Num style={styles.mt6}>{p ? String(p.currentPuzzleRating) : DASH}</Num>
            <DText size={12} color={dx.dust}>
              {p ? t('play.level', { level: levelFor(p) }) : DASH}
            </DText>
          </Tile>
        );
      })}
    </View>
  );
}

function XpCard() {
  const t = useT();
  const { lang } = useLang();
  const q = useQuery({ queryKey: queryKeys.experience(), queryFn: () => api.users.experience() });
  const x = q.data;
  if (!x) return null;
  const ratio = x.nextRankXp != null ? (x.xp - x.rankXp) / Math.max(1, x.nextRankXp - x.rankXp) : 1;
  const title = t('xp.rank_level', { rank: t(`xp.rank.${x.rank}`), level: x.level });
  return (
    <Hover
      testID="profile-xp"
      accessibilityRole="link"
      accessibilityLabel={`${t('xp.label')}: ${title}. ${t('xp.open')}`}
      onPress={() => router.push('/experience' as Href)}
      style={styles.xpCard}
    >
      <RankPiece rank={x.rank} size={52} radius={13} />
      <View style={styles.flex}>
        <Label size={10}>{t('xp.label')}</Label>
        <DText size={16} weight={800} style={styles.mt2} numberOfLines={1}>
          {title}
        </DText>
        <View style={styles.mt8}>
          <XpBar value={ratio} />
        </View>
      </View>
      <View style={styles.right}>
        <Num size={20}>{t('xp.total', { n: fmtXp(x.xp, lang) })}</Num>
        <DText size={12} color={dx.dust}>
          {x.nextRank && x.nextRankXp != null
            ? t('xp.to_rank', { n: fmtXp(x.nextRankXp - x.xp, lang), rank: t(`xp.rank.${x.nextRank}`) })
            : t('xp.top_rank')}
        </DText>
      </View>
      <ChevronRight size={18} color={dx.dust} strokeWidth={1.8} />
    </Hover>
  );
}

function Recent({ data, isSelf }: { data: PublicProfile; isSelf: boolean }) {
  const t = useT();
  return (
    <Card style={styles.card} testID="profile-sessions">
      <Label>{t('profile.recent')}</Label>
      {data.recentSessions.length === 0 ? (
        <DText size={13.5} color={dx.ash} style={styles.mt12} testID="profile-no-sessions">
          {t('profile.no_sessions')}
        </DText>
      ) : (
        <View style={styles.mt4}>
          {data.recentSessions.slice(0, 8).map((row, i) => (
            <SessionLine key={row.id} row={row} first={i === 0} open={isSelf} />
          ))}
        </View>
      )}
    </Card>
  );
}

/** "Rated · Blitz   Today   +18": style, theme, day, rating change. */
function SessionLine({ row, first, open }: { row: SessionRow; first: boolean; open: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const style = row.style && isTrainingStyle(row.style) ? row.style : null;
  const title = [style ? t(`style.${style}.name`) : null, sessionThemeLabel(row.theme, lang, t('sessions.mixed'))].filter(Boolean).join(' · ');
  const day = groupSessionsByDay([row], lang)[0]?.[0] ?? '';
  const delta = row.peakRating - row.startRating;
  const deltaText = delta === 0 ? DASH : `${delta > 0 ? '+' : ''}${delta}`;
  const deltaColor = delta > 0 ? dx.sage : delta < 0 ? dx.rose : dx.dust;
  const body: ReactNode = (
    <>
      {style ? <StyleIcon style={style} size={14} color={dx.ash} /> : <View style={styles.iconGap} />}
      <DText size={13.5} weight={700} style={styles.flex} numberOfLines={1}>
        {title}
      </DText>
      <DText size={13} color={dx.ash} style={styles.day} numberOfLines={1}>
        {day}
      </DText>
      <DText size={13.5} weight={800} color={deltaColor} tabular align="right" style={styles.delta}>
        {deltaText}
      </DText>
    </>
  );
  // Session detail is owner-only on the server: others' rows are display-only.
  return open ? (
    <Hover
      testID={`history-open-${row.id}`}
      accessibilityRole="link"
      accessibilityLabel={t('profile.session_a11y', { time: day, solved: row.solved, start: row.startRating, peak: row.peakRating })}
      onPress={() => router.push(`/sessions/${encodeURIComponent(row.id)}` as Href)}
      style={[styles.sessionRow, !first && styles.rule]}
    >
      {body}
    </Hover>
  ) : (
    <View style={[styles.sessionRow, !first && styles.rule]}>{body}</View>
  );
}

function Achievements() {
  const t = useT();
  const q = useQuery(achievementsQuery());
  const list = q.data ?? [];
  const unlocked = list
    .filter((a) => a.unlocked)
    .sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? ''))
    .slice(0, MEDALS);
  const done = list.filter((a) => a.unlocked).length;
  return (
    <Card style={styles.card} testID="profile-achievements">
      <Hover
        testID="profile-achievements-open"
        accessibilityRole="link"
        accessibilityLabel={t('xp.achievements')}
        onPress={() => router.push(`/stats?tab=achievements&at=${Date.now()}` as Href)}
        style={styles.achHead}
      >
        <Label style={styles.flex}>{t('xp.achievements')}</Label>
        {q.data ? (
          <DText size={12} color={dx.dust} tabular>
            {`${done}/${list.length}`}
          </DText>
        ) : null}
      </Hover>
      {q.data && unlocked.length === 0 ? (
        <DText size={13} color={dx.ash} style={styles.mt12}>
          {t('dx.account.no_achievements')}
        </DText>
      ) : (
        <View style={styles.medals}>
          {unlocked.map((a) => {
            const name = t(achievementNameKey(a.slug));
            return (
              <Hover
                key={a.slug}
                testID={`profile-achievement-${a.slug}`}
                accessibilityLabel={name}
                onPress={() => openAchievement(a.slug)}
                style={styles.medal}
                hoverStyle={styles.medalHover}
              >
                <Medal slug={a.slug} unlocked disc={52} />
                <DText size={11.5} weight={700} align="center" numberOfLines={2}>
                  {name}
                </DText>
              </Hover>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skel: { borderRadius: 14, backgroundColor: dx.card },
  missing: { padding: 28, gap: 12, alignItems: 'flex-start' },
  hero: { padding: 28, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 24, rowGap: 18 },
  glow: {
    position: 'absolute',
    left: -80,
    top: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundImage: `radial-gradient(circle, ${alpha(tone.emberGlow, 0.22)}, ${alpha(eos.ink, 0)} 65%)`,
  },
  avatarRing: {
    borderRadius: 999,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 2, color: eos.ember },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: eos.ink },
    ],
  },
  heroText: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countryPill: { height: 24, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center', backgroundColor: dx.ghost },
  bio: { marginTop: 10 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  grid: { flexDirection: 'row', alignItems: 'flex-start', gap: 20, marginTop: 20 },
  main: { flex: 1, minWidth: 0, gap: 16 },
  aside: { width: 380 },
  stack: { flexDirection: 'column', alignItems: 'stretch' },
  mainStacked: { gap: 16 },
  asideStacked: {},
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minWidth: 0 },
  xpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: dx.card,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  right: { alignItems: 'flex-end' },
  card: { paddingVertical: 18, paddingHorizontal: 20 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderRadius: 6 },
  rule: { borderTopWidth: 1, borderTopColor: dx.rowRule },
  iconGap: { width: 14 },
  day: { width: 90 },
  delta: { width: 50 },
  achHead: { flexDirection: 'row', alignItems: 'center', borderRadius: 6 },
  medals: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 16 },
  medal: { width: '33.333%', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 4, borderRadius: 10 },
  medalHover: { backgroundColor: alpha(eos.bone, 0.035) },
});

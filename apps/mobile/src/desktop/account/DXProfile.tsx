import type { Language } from '@tac/core/i18n';
import { achievementNameKey } from '@tac/core/catalogs';
import { queryKeys } from '@tac/core/api';
import { bucketByLocalDay, RADAR_MIN_THEMES, selectRadarThemes } from '@tac/core/charts';
import { localeFor, streakState } from '@tac/core/format';
import { bandFor } from '@tac/core/rules';
import { levelFor } from '@tac/core/runner';
import { alpha, eos, graphite, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Camera, ChevronRight, Pencil, Share2, Swords, Trophy, Users, X, Check, UserMinus, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import '@/features/achievements/icons';
import { achievementsQuery } from '@/features/achievements/api';
import { openAchievement } from '@/features/achievements/AchievementsGrid';
import { Medal } from '@/features/achievements/Medal';
import { fmtXp } from '@/features/experience/xp';
import { Avatar, VerifiedBadge } from '@/features/profile/Avatar';
import { chooseAvatar, useAvatarUpload } from '@/features/profile/avatarUpload';
import { profileRadarBounds, shareProfile } from '@/features/profile/ProfileScreen';
import { acceptRequest, confirmUnfriend, removeRequest, sendRequest } from '@/features/social/actions';
import { friendshipQuery, friendsQuery, profileQuery, type PublicProfile, type UserCard } from '@/features/social/api';
import { FlameGlyph } from '@/features/social/glyphs';
import { ActivityHeatmap } from '@/features/stats/ActivityHeatmap';
import { profileThemesQuery, profileTimelineQuery, type TimelinePoint } from '@/features/stats/api';
import { RadarChart } from '@/features/stats/RadarChart';
import { RatingHistoryChart } from '@/features/stats/RatingHistoryChart';
import { StyleIcon, STYLE_ORDER } from '@/features/stats/StyleIcon';
import { api } from '@/platform/api';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { scriptLang } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { DesktopPage } from '../Page';
import { Card, DText, GhostButton, Hover, Label, Num, Tile } from '../kit';
import { toLevelPoints } from '../level';
import { dx } from '../tokens';
import { DxProfileEdit } from './DXProfileEdit';
import { useWidth } from '../rivals/layout';
import { RankPiece, useNarrow, XpBar } from './parts';
import { DxSessionRow } from './SessionRow';

const DASH = '—';

/** "October 2026" / "жовтня 2026" (uk / ru want the genitive after "з" / "с"). */
function monthYear(iso: string, lang: Language): string {
  const d = new Date(iso);
  const locale = localeFor(lang);
  if (lang !== 'uk' && lang !== 'ru') return d.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
  const month = d.toLocaleDateString(locale, { day: 'numeric', month: 'long' }).replace(/^\d+\s*/, '');
  return `${month} ${d.getFullYear()}`;
}
/** Medals shown on the profile card (the latest unlocks). */
const MEDALS = 6;

/** The phone ActivityHeatmap's geometry: a 26 px day column, 12 px cells 3 apart. */
const HEAT_DAY_COL = 26;
const HEAT_PITCH = 15;

/** As many week columns as the card is wide (the phone draws 52 and scrolls). */
function heatWeeks(width: number): number {
  return Math.max(8, Math.min(52, Math.floor((width - HEAT_DAY_COL - 4) / HEAT_PITCH)));
}

/**
 * DXProfile (/profile/:nickname): the textured header card (avatar, name,
 * country, @nick · member since, peak and streak, bio; Friends · N, Share,
 * Edit for you, the friendship actions for another player; your own avatar
 * opens the picker), the three style ratings, your XP card (→ /experience),
 * the activity heatmap, the rating history, every recent session and, on
 * the right, your achievements and the themes radar. Data and actions are
 * the phone profile's (same queries and components).
 */
export function DxProfile({ nickname }: { nickname: string }) {
  const t = useT();
  const { lang } = useLang();
  const me = useAuthStore((s) => s.user);
  const isSelf = !!me && me.nickname.toLowerCase() === nickname.toLowerCase();
  const profile = useQuery(profileQuery(nickname));
  const themes = useQuery(profileThemesQuery(nickname));
  const timeline = useQuery(profileTimelineQuery(nickname));
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

  const radar = selectRadarThemes(themes.data ?? [], lang);
  const showRadar = radar.length >= RADAR_MIN_THEMES;
  const hasAside = isSelf || showRadar;
  return (
    <DesktopPage title={t('settings.tab.profile')} right={null} testID="dx-profile">
      <Hero data={data} isSelf={isSelf} onEdit={() => setEditing(true)} />
      <View style={[styles.grid, narrow && styles.stack]}>
        <View style={narrow ? styles.mainStacked : styles.main}>
          <Ratings data={data} />
          {isSelf ? <XpCard /> : null}
          <Activity timeline={timeline.data} />
          <RatingHistory timeline={timeline.data} />
          {narrow ? null : <Recent data={data} isSelf={isSelf} />}
        </View>
        {hasAside ? (
          <View style={narrow ? styles.mainStacked : styles.aside}>
            {isSelf ? <Achievements /> : null}
            {showRadar ? <ThemesRadar data={radar} /> : null}
          </View>
        ) : null}
        {narrow ? <Recent data={data} isSelf={isSelf} /> : null}
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
  const showStreak = useAppStore((s) => s.settings.showStreak);
  const preview = useAvatarUpload((s) => s.previewUri);
  const name = data.displayName?.trim() || data.nickname;
  const since = monthYear(data.createdAt, lang);
  // The phone's rule: a live streak only (secured today or at risk), and only with the setting on.
  const st = data.streak ? streakState(data.streak.days, data.streak.lastDay) : 'none';
  const streakDays = showStreak && data.streak && data.streak.days > 0 && (st === 'secured' || st === 'at_risk') ? data.streak.days : null;
  // D39: the peak line shows the best level across the styles (once the player has played).
  const levels = STYLE_ORDER.flatMap((s) => {
    const p = data.progressions[s];
    return p ? [levelFor(p)] : [];
  });
  const bestLevel = data.allTimePeak != null && levels.length ? Math.max(...levels) : null;
  const avatar = <Avatar nickname={data.nickname} avatarUrl={data.avatarUrl} previewUri={isSelf ? preview : null} size={96} />;
  return (
    <Card texture style={styles.hero} testID="profile-hero">
      <View style={styles.glow} pointerEvents="none" />
      {isSelf ? (
        <Hover
          testID="profile-avatar"
          accessibilityLabel={t('profile.change_avatar')}
          onPress={chooseAvatar}
          style={styles.avatarRing}
          hoverStyle={styles.avatarHover}
        >
          {avatar}
          <View style={styles.camera} pointerEvents="none">
            <Camera size={14} color={eos.bone} strokeWidth={2} />
          </View>
        </Hover>
      ) : (
        <View style={styles.avatarRing} testID="profile-avatar">
          {avatar}
        </View>
      )}
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
        {bestLevel != null || streakDays != null ? (
          <View style={styles.meta}>
            {bestLevel != null ? (
              <View style={styles.metaItem} testID="profile-peak">
                <Trophy size={13} color={dx.dust} strokeWidth={2} />
                <DText size={13} color={dx.ash} tabular>
                  {t('dx.account.best_level', { level: bestLevel })}
                </DText>
              </View>
            ) : null}
            {streakDays != null ? (
              <View style={styles.metaItem} testID="profile-streak">
                <FlameGlyph size={13} color={tone.gold} />
                <DText size={13} weight={700} color={tone.gold} tabular>{`${t('profile.streak')} ${streakDays}`}</DText>
              </View>
            ) : null}
          </View>
        ) : null}
        {data.bio ? (
          <DText size={14} color={graphite[300]} style={styles.bio} numberOfLines={3} testID="profile-bio">
            {data.bio}
          </DText>
        ) : null}
      </View>
      <View style={styles.heroActions}>
        {isSelf ? (
          <GhostButton
            height={44}
            testID="profile-friends"
            accessibilityLabel={t('nav.friends')}
            icon={Users}
            label={friends.data ? t('dx.account.friends_n', { n: friends.data.length }) : t('nav.friends')}
            onPress={() => router.push('/friends')}
          />
        ) : null}
        <GhostButton height={44} testID="profile-share" accessibilityLabel={t('profile.share')} icon={Share2} label={t('dx.account.share')} onPress={() => shareProfile(data.nickname, name, t)} />
        {isSelf ? (
          <PlateButton
            testID="profile-edit"
            label={t('profile.edit')}
            variant="slate"
            size="md"
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
          size="md"
          icon={<UserPlus size={14} color={eos.bone} strokeWidth={2} />}
          loading={busy === 'add'}
          disabled={off}
          onPress={() => void run('add', () => sendRequest(user))}
        />
      );
    case 'outgoing':
      return (
        <GhostButton
            height={44}
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
            height={44}
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
            size="md"
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
            height={44}
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
            size="md"
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
            <Num style={styles.mt6}>{p ? String(levelFor(p)) : DASH}</Num>
            <DText size={12} color={dx.dust}>
              {p ? t(`levels.${bandFor(levelFor(p)).key}`) : DASH}
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

/** The phone's activity card: sessions per day, as many weeks as fit. */
function Activity({ timeline }: { timeline: TimelinePoint[] | undefined }) {
  const t = useT();
  const [width, onLayout] = useWidth();
  const heat = timeline ? bucketByLocalDay(timeline) : [];
  if (heat.length === 0) return null;
  return (
    <Card style={styles.card} testID="profile-activity">
      <Label>{t('stats.activity')}</Label>
      <DText size={12.5} color={dx.dust} style={styles.mt4}>
        {t('stats.activity_hint')}
      </DText>
      <View style={styles.mt12} onLayout={onLayout}>
        {width > 0 ? <ActivityHeatmap data={heat} weeks={heatWeeks(width)} testID="profile-heatmap" /> : <View style={styles.ph} />}
      </View>
    </Card>
  );
}

/** "Level over time" (D39): each session at the difficulty it started at, a line per style. */
function RatingHistory({ timeline }: { timeline: TimelinePoint[] | undefined }) {
  const t = useT();
  const points = toLevelPoints(timeline);
  if (points.length === 0) return null;
  return (
    <Card style={styles.card} testID="profile-rating-card">
      <Label>{t('dx.account.level_history')}</Label>
      <DText size={12.5} color={dx.dust} style={styles.mt4}>
        {t('dx.account.level_history_hint')}
      </DText>
      <View style={styles.mt12}>
        <RatingHistoryChart data={points} testID="profile-rating" />
      </View>
    </Card>
  );
}

/** The phone's "Themes profile" radar, with the profile's own bounds. */
function ThemesRadar({ data }: { data: ReturnType<typeof selectRadarThemes> }) {
  const t = useT();
  const bounds = profileRadarBounds(data);
  return (
    <Card style={styles.card} testID="profile-radar-card">
      <Label>{t('stats.by_theme')}</Label>
      <View style={styles.mt12}>
        <RadarChart data={data} min={bounds.min} max={bounds.max} testID="profile-radar" />
      </View>
    </Card>
  );
}

/** Every recent session the profile returns, with the phone row's details. */
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
          {data.recentSessions.map((row, i) => (
            <DxSessionRow key={row.id} row={row} first={i === 0} open={isSelf} />
          ))}
        </View>
      )}
    </Card>
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
  avatarHover: { opacity: 0.88 },
  camera: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dx.ghost,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 2, color: dx.card }],
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ph: { height: 130 },
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
  aside: { width: 380, gap: 16 },
  stack: { flexDirection: 'column', alignItems: 'stretch' },
  mainStacked: { gap: 16 },
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
  achHead: { flexDirection: 'row', alignItems: 'center', borderRadius: 6 },
  medals: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 16 },
  medal: { width: '33.333%', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 4, borderRadius: 10 },
  medalHover: { backgroundColor: alpha(eos.bone, 0.035) },
});

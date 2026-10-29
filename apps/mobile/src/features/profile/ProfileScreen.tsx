import { bucketByLocalDay, selectRadarThemes, RADAR_MIN_THEMES, type RadarDatum } from '@tac/core/charts';
import { localeFor, streakState } from '@tac/core/format';
import { eos, fontSize, graphite, layout, radii, space, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { Calendar, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, RefreshControl, Share, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { feel } from '@/feel';
import '@/features/achievements/icons';
import { SessionRow } from '@/features/sessions/SessionRow';
import { profileQuery, type PublicProfile } from '@/features/social/api';
import { FriendActionButton } from '@/features/social/FriendActionButton';
import { FlameGlyph } from '@/features/social/glyphs';
import { ActivityHeatmap } from '@/features/stats/ActivityHeatmap';
import { profileThemesQuery, profileTimelineQuery, toRatingPoints } from '@/features/stats/api';
import { RadarChart } from '@/features/stats/RadarChart';
import { RatingHistoryChart } from '@/features/stats/RatingHistoryChart';
import { StyleIcon, STYLE_ORDER } from '@/features/stats/StyleIcon';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { AppText } from '@/ui/AppText';
import { IconButton } from '@/ui/Buttons';
import { fontFamily, scriptLang } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { stackHeader } from '@/ui/NavHeader';
import { PlateButton } from '@/ui/PlateButton';
import { Card, HeroCard } from '@/ui/Surfaces';
import { Tap } from '@/ui/Tap';
import { Avatar, VerifiedBadge } from './Avatar';
import { chooseAvatar, useAvatarUpload } from './avatarUpload';
import { ProfileEditorSheet } from './ProfileEditorSheet';

/** Public profile URL (universal links land in Phase 10; the web page exists today). */
export const PROFILE_URL = (nickname: string) => `https://tactictak.online/profile/${encodeURIComponent(nickname)}`;

/** Web's no-value mark (not copy). */
const DASH = '—';

/** Hero collapse: the header title fades in as the name scrolls under it. */
const COLLAPSE = [40, 110];

/** Design v2 MobProfile: compact 44 pt header, `.glass` back and share. */
const PROFILE_HEADER = stackHeader('glass', { compact: true });

/** Web profile radar bounds (differs from the analytics page on purpose). */
function profileRadarBounds(data: RadarDatum[]) {
  if (data.length === 0) return { min: 1200, max: 2000 };
  const values = data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max(50, Math.round((hi - lo) * 0.2));
  return { min: Math.max(0, lo - pad), max: hi + pad };
}

/**
 * Public profile (web /profile/:nickname). Native: a collapsing hero whose
 * name hands over to the nav-bar title, a Share button, pull to refresh,
 * and the shared Stats charts. Fixes: streak from streakState (the web
 * showed a stale count after a break); sessions are read-only on other
 * players' profiles (the web showed a dead swipe-to-delete there).
 */
export function ProfileScreen({ nickname }: { nickname: string }) {
  const t = useT();
  const { lang } = useLang();
  const me = useAuthStore((s) => s.user);
  const isSelf = !!me && me.nickname.toLowerCase() === nickname.toLowerCase();
  const profile = useQuery(profileQuery(nickname));
  const themes = useQuery(profileThemesQuery(nickname));
  const timeline = useQuery(profileTimelineQuery(nickname));
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.set(e.contentOffset.y);
  });

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    await Promise.allSettled([profile.refetch(), themes.refetch(), timeline.refetch()]);
    setRefreshing(false);
  };

  const data = profile.data;
  const name = data ? data.displayName?.trim() || data.nickname : nickname;

  const share = () => {
    const url = PROFILE_URL(data?.nickname ?? nickname);
    void Share.share(
      Platform.OS === 'ios'
        ? { url, message: t('profile.share_title', { name }) }
        : { message: t('profile.share_message', { name, url }), title: t('profile.share_title', { name }) },
    );
  };

  const header = (
    <Stack.Screen
      options={{
        title: name,
        header: PROFILE_HEADER,
        headerTitle: () => <HeaderTitle y={y} text={name} />,
        headerRight: () => (
          <IconButton
            variant="glass"
            onPress={share}
            accessibilityLabel={t('profile.share')}
            testID="profile-share"
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={eos.bone} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </Svg>
            }
          />
        ),
      }}
    />
  );

  if (!data) {
    const notFound = (profile.error as { status?: number } | null)?.status === 404;
    return (
      <View style={styles.root} testID="screen-profile">
        {header}
        {profile.isPending ? (
          <View style={styles.skeleton} testID="profile-loading">
            <View style={[styles.skelBlock, { height: 150 }]} />
            <View style={[styles.skelBlock, { height: 90 }]} />
            <View style={[styles.skelBlock, { height: 160 }]} />
          </View>
        ) : (
          <View style={styles.center} testID={notFound ? 'profile-not-found' : 'profile-error'}>
            <AppText variant="title" style={styles.centerText}>
              {notFound ? t('profile.not_found_title') : t('profile.error')}
            </AppText>
            {notFound ? (
              <AppText variant="body" color={eos.ash} style={styles.centerText}>
                {t('profile.not_found_hint', { nickname })}
              </AppText>
            ) : (
              <PlateButton label={t('profile.retry')} variant="slate" size="sm" onPress={() => void profile.refetch()} testID="profile-retry" />
            )}
          </View>
        )}
      </View>
    );
  }

  const ratingPoints = toRatingPoints(timeline.data);
  const heat = timeline.data ? bucketByLocalDay(timeline.data) : [];
  const radar = selectRadarThemes(themes.data ?? [], lang);
  const bounds = profileRadarBounds(radar);

  return (
    <View style={styles.root} testID="screen-profile">
      {header}
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={eos.ash} />}
        testID="profile-scroll"
      >
        <Hero data={data} isSelf={isSelf} y={y} onEdit={() => setEditing(true)} />
        <Ratings data={data} />

        {heat.length > 0 ? (
          <Card style={styles.card}>
            <AppText variant="label">{t('stats.activity')}</AppText>
            <AppText variant="caption" color={eos.dust} style={styles.hint}>
              {t('stats.activity_hint')}
            </AppText>
            <ActivityHeatmap data={heat} weeks={52} testID="profile-heatmap" />
          </Card>
        ) : null}

        {ratingPoints.length > 0 ? (
          <Card style={styles.card}>
            <AppText variant="label">{t('stats.rating_history')}</AppText>
            <AppText variant="caption" color={eos.dust} style={styles.hint}>
              {t('stats.rating_history_hint')}
            </AppText>
            <RatingHistoryChart data={ratingPoints} testID="profile-rating" />
          </Card>
        ) : null}

        {radar.length >= RADAR_MIN_THEMES ? (
          <Card style={styles.card}>
            <AppText variant="label">{t('stats.by_theme')}</AppText>
            <RadarChart data={radar} min={bounds.min} max={bounds.max} testID="profile-radar" />
          </Card>
        ) : null}

        <AppText variant="sectionLabel" style={styles.section}>
          {t('profile.recent')}
        </AppText>
        <RecentSessions data={data} isSelf={isSelf} />
      </Animated.ScrollView>
      {isSelf ? (
        <ProfileEditorSheet
          visible={editing}
          initial={{ displayName: data.displayName, bio: data.bio, country: data.country }}
          onClose={() => {
            setEditing(false);
            void profile.refetch();
          }}
        />
      ) : null}
    </View>
  );
}

function HeaderTitle({ y, text }: { y: SharedValue<number>; text: string }) {
  const { lang } = useLang();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), COLLAPSE, [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(y.get(), COLLAPSE, [6, 0], 'clamp') }],
  }));
  return (
    <Animated.Text
      numberOfLines={1}
      style={[{ fontFamily: fontFamily(lang, 'display', 700), fontSize: fontSize.lg[0], color: eos.bone, maxWidth: 220 }, style]}
      testID="profile-header-title"
    >
      {text}
    </Animated.Text>
  );
}

function Hero({
  data,
  isSelf,
  y,
  onEdit,
}: {
  data: PublicProfile;
  isSelf: boolean;
  y: SharedValue<number>;
  onEdit: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const showStreak = useAppStore((s) => s.settings.showStreak);
  const preview = useAvatarUpload((s) => s.previewUri);
  const name = data.displayName?.trim() || data.nickname;
  const joined = new Date(data.createdAt).toLocaleDateString(localeFor(lang), { year: 'numeric', month: 'long' });
  const st = data.streak ? streakState(data.streak.days, data.streak.lastDay) : 'none';
  const streakLive = showStreak && data.streak && data.streak.days > 0 && (st === 'secured' || st === 'at_risk');

  // The hero shrinks and fades as it scrolls away under the nav bar.
  const avatarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, COLLAPSE[1]], [1, 0.2], 'clamp'),
    transform: [{ scale: interpolate(y.get(), [-80, 0, COLLAPSE[1]], [1.15, 1, 0.7], 'clamp') }],
  }));

  const avatar = (
    <Animated.View style={avatarStyle}>
      <Avatar nickname={data.nickname} avatarUrl={data.avatarUrl} previewUri={isSelf ? preview : null} size={72} />
    </Animated.View>
  );

  return (
    <HeroCard testID="profile-hero">
      <View style={styles.heroTop}>
        {isSelf ? (
          // The tap target overlays the avatar rather than wrapping it, so the
          // image (testID avatar-image) stays visible to tests.
          <View>
            {avatar}
            <Tap
              testID="profile-avatar"
              accessibilityRole="button"
              accessibilityLabel={t('profile.change_avatar')}
              onPress={chooseAvatar}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : (
          avatar
        )}
        <View style={styles.flex}>
          <View style={styles.nameLine}>
            <AppText variant="title" lang={scriptLang(name)} numberOfLines={2} style={styles.shrink} testID="profile-name">
              {name}
            </AppText>
            <VerifiedBadge verified={data.verified} size={18} />
          </View>
          <AppText variant="body" color={eos.dust} numberOfLines={1} testID="profile-nickname">
            {[data.displayName ? `@${data.nickname}` : null, data.country ? data.country.toUpperCase() : null]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
      </View>
      {data.bio ? (
        <AppText variant="body" color={graphite[300]} style={styles.bio} testID="profile-bio">
          {data.bio}
        </AppText>
      ) : null}
      <View style={styles.meta}>
        <Meta icon={<Calendar size={12} color={eos.dust} strokeWidth={2} />} text={`${t('profile.joined')} ${joined}`} />
        {data.allTimePeak != null ? (
          <Meta icon={<Trophy size={12} color={eos.dust} strokeWidth={2} />} text={`${t('profile.peak')} ${data.allTimePeak}`} testID="profile-peak" />
        ) : null}
        {streakLive ? (
          <Meta
            icon={<FlameGlyph size={12} color={tone.gold} />}
            text={`${t('profile.streak')} ${data.streak!.days}`}
            color={tone.gold}
            testID="profile-streak"
          />
        ) : null}
      </View>
      <View style={styles.actions}>
        {isSelf ? (
          <>
            <PlateButton label={t('nav.friends')} variant="slate" size="sm" onPress={() => router.push('/friends')} testID="profile-friends" />
            <PlateButton label={t('profile.edit')} variant="slate" size="sm" onPress={onEdit} testID="profile-edit" />
          </>
        ) : (
          <FriendActionButton user={data} />
        )}
      </View>
    </HeroCard>
  );
}

function Meta({ icon, text, color = eos.dust, testID }: { icon: React.ReactNode; text: string; color?: string; testID?: string }) {
  return (
    <View style={styles.metaItem} testID={testID}>
      {icon}
      <AppText variant="caption" color={color}>
        {text}
      </AppText>
    </View>
  );
}

function Ratings({ data }: { data: PublicProfile }) {
  const t = useT();
  return (
    <View>
      <AppText variant="sectionLabel" style={styles.section}>
        {t('profile.ratings')}
      </AppText>
      <View style={styles.ratings}>
        {STYLE_ORDER.map((s) => {
          const p = data.progressions[s];
          return (
            <Card key={s} style={styles.ratingCard} testID={`profile-rating-${s}`}>
              <View style={styles.ratingHead}>
                <StyleIcon style={s} size={14} color={eos.ash} />
                <AppText variant="label" numberOfLines={1} style={styles.shrink}>
                  {t(`style.${s}.name`)}
                </AppText>
              </View>
              <AppText variant="value">{p ? String(p.currentPuzzleRating) : DASH}</AppText>
              <AppText variant="caption" color={eos.dust}>
                {`${t('play.unlocked')} ${p ? p.unlockedStartRating : DASH}`}
              </AppText>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

function RecentSessions({ data, isSelf }: { data: PublicProfile; isSelf: boolean }) {
  const t = useT();
  const { lang } = useLang();
  if (data.recentSessions.length === 0) {
    return (
      <Card testID="profile-no-sessions">
        <AppText variant="body" color={eos.ash} style={styles.centerText}>
          {t('profile.no_sessions')}
        </AppText>
      </Card>
    );
  }
  return (
    <View style={styles.sessions} testID="profile-sessions">
      {data.recentSessions.map((row) =>
        // Session detail is owner-only on the server: others' rows are display-only.
        isSelf ? (
          <SessionRow key={row.id} row={row} lang={lang} t={t} />
        ) : (
          <View key={row.id} pointerEvents="none">
            <SessionRow row={row} lang={lang} t={t} />
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  scroll: { padding: layout.gutter, gap: space[5], paddingBottom: space[12] },
  skeleton: { padding: layout.gutter, gap: space[4] },
  skelBlock: { borderRadius: radii.cardComponent, backgroundColor: eos.slate },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: layout.gutter },
  centerText: { textAlign: 'center' },
  card: { gap: space[1] },
  hint: { marginBottom: space[2] },
  section: { marginBottom: space[2] },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  bio: { marginTop: space[3] },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space[4], rowGap: space[1], marginTop: space[3] },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] },
  ratings: { flexDirection: 'row', gap: space[3] },
  ratingCard: { flex: 1, padding: space[3], gap: 2 },
  ratingHead: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  sessions: { gap: space[2] },
});

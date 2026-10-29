import { UI_STYLE_ORDER } from '@tac/core/rules';
import type { RunnerSnapshot } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { eos, fontSize, layout, radii, semantic, space } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, type Href } from 'expo-router';
import { ChevronRight, Zap } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { meQuery } from '@/features/auth/session';
import { readLastSetup, repeatStartRating, type SessionSetup } from '@/features/play/setupPrefs';
import { startSession } from '@/features/play/startSession';
import { startErrorKey } from '@/features/play/strings';
import { StyleIcon } from '@/features/play/ui';
import { VerifiedBadge } from '@/features/profile/Avatar';
import { SessionRow } from '@/features/sessions/SessionRow';
import { feel } from '@/feel';
import { readActiveSnapshot } from '@/runner';
import { toast } from '@/shell/toast/store';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { AppText, Card, HeroCard, PlateButton, useLang, useT } from '@/ui';
import { scriptLang } from '@/ui/fonts';
import { Tap } from '@/ui/Tap';
import { overviewQuery, readLastSeenRatings, writeLastSeenRatings, type SeenRatings } from './api';
import { HomeStreak } from './HomeStreak';
import { ResumeCard } from './ResumeCard';
import { StyleRatingCard } from './StyleRatingCard';

// Home tab (web /dashboard): greeting, streak, the resume card for a
// killed session, the hero Start (+ quick start with the last setup),
// the three style ratings with their change since the last visit, the
// lifetime tiles and the recent sessions.

// Cinzel has no Cyrillic: the display face follows the nickname's script, not the UI language.
const RECENT = 5;

export function HomeScreen() {
  const t = useT();
  const { lang } = useLang();
  const user = useAuthStore((s) => s.user);
  const nickname = user?.nickname ?? '';
  const progressions = useAppStore((s) => s.progressions);
  // ['me'] revalidates the MMKV-cached ratings on mount and on foreground;
  // its queryFn writes into the stores this screen reads.
  const me = useQuery(meQuery);
  const overview = useQuery({ ...overviewQuery, enabled: !!user });

  const [snap, setSnap] = useState<RunnerSnapshot | null>(readActiveSnapshot);
  const [setup, setSetup] = useState<SessionSetup | null>(readLastSetup);
  const [seen, setSeen] = useState<SeenRatings>({});
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Each visit: the resume card and quick start re-read the device, and
  // the rating deltas compare against what the previous visit showed.
  useFocusEffect(
    useCallback(() => {
      setSnap(readActiveSnapshot());
      setSetup(readLastSetup());
      const uid = useAuthStore.getState().user?.id ?? '';
      const now = useAppStore.getState().progressions;
      setSeen(readLastSeenRatings(uid));
      writeLastSeenRatings(uid, { bullet: now.bullet.currentPuzzleRating, blitz: now.blitz.currentPuzzleRating, rapid: now.rapid.currentPuzzleRating });
    }, []),
  );

  const onRefresh = async () => {
    feel.emit('refresh');
    setRefreshing(true);
    try {
      await Promise.all([me.refetch(), overview.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const quickStart = async () => {
    if (!setup) return;
    setStarting(true);
    try {
      const id = await startSession({ ...setup, startRating: repeatStartRating(setup, progressions[setup.style]) });
      router.push(`/play/${id}` as Href);
    } catch (e) {
      toast.show({ title: t(startErrorKey(e)) });
    } finally {
      setStarting(false);
    }
  };

  const setupLabel = setup
    ? [
        t(`style.${setup.style}.name`),
        `${Math.round(setup.durationSec / 60)} ${t('play.minutes')}`,
        setup.mode === 'theme' && setup.theme ? themeLabel(setup.theme, lang) : t('play.mode.mixed'),
      ].join(' · ')
    : null;

  const data = overview.data;
  const recent = data?.recentSessions.slice(0, RECENT) ?? [];

  return (
    <View style={styles.root} testID="home-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={eos.ember} />}
      >
        <View style={styles.header}>
          <View style={styles.flex}>
            <AppText variant="sectionLabel">{t('dashboard.welcome')}</AppText>
            <View style={styles.nameRow}>
              <AppText
                variant="heading"
                lang={scriptLang(nickname)}
                style={styles.nickname}
                testID="home-nickname"
                numberOfLines={1}
              >
                {nickname}
              </AppText>
              <VerifiedBadge verified={user?.verified} size={20} />
            </View>
          </View>
          <HomeStreak t={t} />
        </View>

        {snap && <ResumeCard snap={snap} onGone={() => setSnap(null)} t={t} />}

        <HeroCard testID="home-hero">
          <AppText variant="sectionLabel">{t('dashboard.ready')}</AppText>
          <PlateButton testID="home-play" label={t('dashboard.start')} onPress={() => router.navigate('/play')} size="lg" block style={styles.heroCta} />
          {setupLabel && (
            <Tap
              testID="home-quick-start"
              accessibilityRole="button"
              accessibilityLabel={t('home.quick_start_aria', { setup: setupLabel })}
              onPress={() => void quickStart()}
              disabled={starting}
              pressFeel="segmented"
              style={styles.quick}
            >
              {starting ? <ActivityIndicator size="small" color={eos.ember} /> : <Zap size={16} color={eos.ember} />}
              {setup && <StyleIcon style={setup.style} size={14} color={eos.ash} />}
              <View style={styles.flex}>
                <AppText variant="label" color={eos.bone}>
                  {t('home.quick_start')}
                </AppText>
                <AppText variant="caption" numberOfLines={1} testID="home-quick-start-setup">
                  {setupLabel}
                </AppText>
              </View>
              <ChevronRight size={16} color={eos.dust} />
            </Tap>
          )}
        </HeroCard>

        <View style={styles.ratings}>
          {UI_STYLE_ORDER.map((s) => (
            <StyleRatingCard key={s} style={s} seen={seen[s]} t={t} />
          ))}
        </View>

        <View style={styles.tiles}>
          <Card style={styles.tile}>
            <AppText variant="label">{t('dashboard.peak')}</AppText>
            <AppText variant="value" testID="home-peak">
              {data ? String(data.allTimePeak || '—') : '—'}
            </AppText>
          </Card>
          <Card style={styles.tile}>
            <AppText variant="label">{t('dashboard.sessions')}</AppText>
            {/* fix: lifetime.sessions, not the take-20 recent list (web bug). */}
            <AppText variant="value" testID="home-sessions">
              {String(data?.lifetime?.sessions ?? data?.recentSessions.length ?? 0)}
            </AppText>
          </Card>
        </View>

        <View style={styles.recent}>
          <View style={styles.recentHead}>
            <AppText variant="body" color={eos.bone} style={styles.recentTitle} accessibilityRole="header">
              {t('dashboard.recent')}
            </AppText>
            {recent.length > 0 && (
              <Tap
                testID="home-all-sessions"
                accessibilityRole="link"
                accessibilityLabel={t('home.all_sessions')}
                onPress={() => router.push('/sessions' as Href)}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                style={styles.allLink}
              >
                <AppText variant="label" color={eos.ember}>
                  {t('home.all_sessions')}
                </AppText>
                <ChevronRight size={14} color={eos.ember} />
              </Tap>
            )}
          </View>
          {overview.isPending && !data ? (
            <ActivityIndicator color={eos.ember} style={styles.state} testID="home-recent-loading" />
          ) : overview.isError && !data ? (
            <View style={styles.state}>
              <AppText variant="caption" color={eos.dust}>
                {t('home.error')}
              </AppText>
              <Tap testID="home-retry" accessibilityRole="button" accessibilityLabel={t('home.retry')} onPress={() => void overview.refetch()} style={styles.retry}>
                <AppText variant="label" color={eos.bone}>
                  {t('home.retry')}
                </AppText>
              </Tap>
            </View>
          ) : recent.length === 0 ? (
            <AppText variant="body" color={eos.dust} testID="home-empty">
              {t('dashboard.empty')}
            </AppText>
          ) : (
            <View style={styles.list} testID="home-recent">
              {recent.map((row) => (
                <SessionRow key={row.id} row={row} lang={lang} t={t} />
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space[5], paddingBottom: space[8], gap: space[5] },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], marginTop: space[1.5] },
  nickname: { flexShrink: 1 },
  heroCta: { marginTop: space[4] },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2.5],
    marginTop: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[2.5],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: semantic.borderSoft,
    backgroundColor: eos.well,
  },
  ratings: { flexDirection: 'row', gap: space[3] },
  tiles: { flexDirection: 'row', gap: space[3] },
  tile: { flex: 1, gap: space[1] },
  recent: { gap: space[2.5] },
  recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentTitle: { fontSize: fontSize.base[0] },
  allLink: { flexDirection: 'row', alignItems: 'center', gap: space[0.5], minHeight: 32 },
  list: { gap: space[2] },
  state: { paddingVertical: space[4], alignItems: 'flex-start', gap: space[3] },
  retry: { height: space[10], paddingHorizontal: space[4], borderRadius: radii.lg, justifyContent: 'center', backgroundColor: eos.rise },
});

import { raceBase, STORM_FORMATS, STORM_NOTE_MAX, type StormFormat } from '@tac/core/storm';
import { alpha, eos, layout, radii, space, surface, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Search, Send, Users, Zap } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { BackLink } from '@/features/courses/parts';
import { displayNameOf } from '@/features/social/actions';
import { friendsQuery, profileQuery, type FriendRow } from '@/features/social/api';
import { isApiError } from '@tac/core/api';
import { toast } from '@/shell/toast/store';
import { AppText, Input, PlateButton, Segmented, Tap, TextLink } from '@/ui';
import { useT } from '@/ui/lang';
import { challengeApi, invalidateChallenges } from './api';
import { PresenceAvatar, useMyRating } from './parts';

/** GET /friends rows carry presence since the Storm backend. */
type Friend = FriendRow & { online?: boolean };

const isFormat = (f: string | undefined): f is StormFormat => !!f && (STORM_FORMATS as readonly string[]).includes(f);

/**
 * /challenge/new?friend&format&run&score (canvas ChallengeCreate). Who
 * (friends only, online first), How (Race; Together is stage B, shown
 * disabled with "Soon"), Format, Difficulty "Between you both · ~avg",
 * When, an optional note (app-only), then "Send to {name}".
 * Without `run` the challenger plays first: POST, then straight into the
 * runner. With `run` (a dare from Storm Result) the run's own stream and
 * format are used and the challenge goes out at once.
 */
export function CreateScreen({
  friend,
  format: formatParam,
  run,
  score,
}: {
  friend?: string;
  format?: string;
  run?: string;
  score?: string;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const dare = !!run;
  const friends = useQuery(friendsQuery());
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(friend ?? null);
  const [format, setFormat] = useState<StormFormat>(dare ? 'time3' : isFormat(formatParam) ? formatParam : 'time3');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const all = ((friends.data ?? []) as Friend[]).slice();
    // Online first, then by name; the preselected friend leads.
    all.sort((a, b) => Number(!!b.online) - Number(!!a.online) || displayNameOf(a.user).localeCompare(displayNameOf(b.user)));
    if (friend) {
      const i = all.findIndex((f) => f.user.id === friend);
      if (i > 0) all.unshift(...all.splice(i, 1));
    }
    const q = query.trim().replace(/^@/, '').toLowerCase();
    return q ? all.filter((f) => f.user.nickname.toLowerCase().includes(q) || (f.user.displayName ?? '').toLowerCase().includes(q)) : all;
  }, [friends.data, query, friend]);

  const selected = ((friends.data ?? []) as Friend[]).find((f) => f.user.id === picked) ?? null;
  const name = selected ? displayNameOf(selected.user) : '';

  // The friend's rating: their highest style rating from the public profile.
  const profile = useQuery({ ...profileQuery(selected?.user.nickname ?? ''), enabled: !!selected });
  const mine = useMyRating();
  const theirs = profile.data
    ? Math.max(0, ...Object.values(profile.data.progressions).map((p) => p?.currentPuzzleRating ?? 0))
    : 0;
  const avg = selected && theirs > 0 ? raceBase(mine, theirs).avg : null;

  const send = async () => {
    if (!selected || sending) return;
    setSending(true);
    setError(null);
    try {
      const trimmed = note.trim();
      const r = await challengeApi.create({
        opponentId: selected.user.id,
        format,
        ...(trimmed ? { note: trimmed } : {}),
        ...(run ? { runId: run } : {}),
      });
      invalidateChallenges();
      const id = r.challenge.id;
      if (dare) {
        feel.emit('achievementToast');
        toast.show({ title: t('challenge.sent', { name }), icon: Send, ...(score ? { description: t('challenge.sent_body', { name, n: score }) } : {}) });
        router.replace(`/challenge/${id}` as Href);
      } else {
        router.replace(`/storm/run?challenge=${encodeURIComponent(id)}&format=${format}` as Href);
      }
    } catch (e) {
      feel.emit('formError');
      const status = isApiError(e) ? e.status : 0;
      setError(
        status === 403
          ? t('challenge.err.friends')
          : status === 429
            ? t('challenge.err.limit')
            : status === 404 && dare
              ? t('challenge.err.run')
              : t('challenge.err.generic'),
      );
      setSending(false);
    }
  };

  const dock = space[4] + layout.plateHeight.lg + Math.max(insets.bottom, space[4]) + space[2];
  const hint = dare ? t('challenge.hint.dare', { n: score ?? '' }) : t(`challenge.hint.${format}`);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="challenge-create">
      <View style={styles.header}>
        <BackLink testID="challenge-back" label={t('challenge.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/play' as Href))} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: dock }]} keyboardShouldPersistTaps="handled">
          <AppText variant="heading" accessibilityRole="header">
            {t('challenge.create.title')}
          </AppText>

          {/* WHO */}
          <View>
            <AppText variant="sectionLabel" accessibilityRole="header">
              {t('challenge.who')}
            </AppText>
            <View style={styles.gap8} />
            <Input
              testID="challenge-search"
              accessibilityLabel={t('challenge.search_a11y')}
              placeholder={t('challenge.search')}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              leading={<Search size={16} strokeWidth={1.8} color={eos.dust} />}
            />
            {friends.isPending ? (
              <ActivityIndicator color={eos.ash} style={styles.friendsLoading} />
            ) : (friends.data ?? []).length === 0 ? (
              <View style={styles.noFriends} testID="challenge-no-friends">
                <AppText variant="body" color={eos.ash}>
                  {t('challenge.no_friends')}
                </AppText>
                <TextLink testID="challenge-find-friends" label={t('challenge.find_friends')} onPress={() => router.push('/friends/search' as Href)} />
              </View>
            ) : rows.length === 0 ? (
              <AppText variant="body" color={eos.ash} style={styles.noMatch}>
                {t('challenge.no_match', { q: query.trim() })}
              </AppText>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friends} keyboardShouldPersistTaps="handled">
                {rows.map((f) => {
                  const on = f.user.id === picked;
                  const n = displayNameOf(f.user);
                  return (
                    <Tap
                      key={f.user.id}
                      testID={`challenge-friend-${f.user.nickname}`}
                      accessibilityRole="button"
                      accessibilityLabel={t(f.online ? 'challenge.friend_online_a11y' : 'challenge.friend_a11y', { name: n })}
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        feel.emit('toggle');
                        setPicked(f.user.id);
                        setError(null);
                      }}
                      style={styles.friend}
                    >
                      <PresenceAvatar nickname={f.user.nickname} avatarUrl={f.user.avatarUrl} size={52} online={f.online} ring={on ? eos.ember : undefined} />
                      <AppText variant="captionStrong" color={on ? eos.bone : eos.ash} numberOfLines={1} style={styles.friendName}>
                        {n}
                      </AppText>
                    </Tap>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* HOW */}
          <View>
            <AppText variant="sectionLabel" accessibilityRole="header">
              {t('challenge.how')}
            </AppText>
            <View style={styles.modes}>
              <ModeCard
                testID="challenge-mode-race"
                title={t('challenge.mode.race')}
                sub={t('challenge.mode.race_sub')}
                icon={<Zap size={20} strokeWidth={1.8} color={tone.rose} />}
                on
              />
              <ModeCard
                testID="challenge-mode-together"
                title={t('challenge.mode.together')}
                sub={t('challenge.mode.together_sub')}
                icon={<Users size={20} strokeWidth={1.8} color={tone.rose} />}
                soon={t('challenge.soon')}
              />
            </View>
          </View>

          {/* FORMAT · DIFFICULTY · WHEN */}
          <View style={styles.facts}>
            <View style={styles.factRow}>
              <AppText variant="bodyStrong">{t('challenge.format')}</AppText>
              {dare ? (
                <AppText variant="bodyStrong" color={eos.ash} testID="challenge-format-fixed">
                  {t('challenge.format.time3')}
                </AppText>
              ) : (
                <Segmented
                  options={STORM_FORMATS.map((f) => ({ value: f, label: t(`challenge.format.${f}`) }))}
                  value={format}
                  onChange={setFormat}
                  size="sm"
                  testID="challenge-format"
                  accessibilityLabel={t('challenge.format')}
                  style={styles.segmented}
                />
              )}
            </View>
            <AppText variant="caption" color={eos.dust} style={styles.hint} testID="challenge-format-hint">
              {hint}
            </AppText>
            <View style={styles.factRow}>
              <AppText variant="bodyStrong">{t('challenge.difficulty')}</AppText>
              <AppText variant="captionStrong" color={eos.ash} style={styles.factValue} testID="challenge-difficulty">
                {avg != null ? t('challenge.between', { avg }) : t('challenge.between_plain')}
              </AppText>
            </View>
            <View style={styles.factRow}>
              <AppText variant="bodyStrong">{t('challenge.when')}</AppText>
              <AppText variant="captionStrong" color={eos.ash} style={styles.factValue}>
                {t('challenge.within')}
              </AppText>
            </View>
          </View>

          {/* NOTE (app-only) */}
          <Input
            testID="challenge-note"
            accessibilityLabel={t('challenge.note')}
            label={t('challenge.note')}
            labelRight={`${note.length}/${STORM_NOTE_MAX}`}
            placeholder={t('challenge.note_placeholder')}
            value={note}
            onChangeText={(v) => setNote(v.replace(/\n/g, ' '))}
            maxLength={STORM_NOTE_MAX}
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
          />

          {error ? (
            <AppText variant="body" color={tone.danger} testID="challenge-error" accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : null}
        </ScrollView>
        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]}>
          <PlateButton
            testID="challenge-send"
            label={selected ? t('challenge.send', { name }) : t('challenge.send_pick')}
            size="lg"
            block
            disabled={!selected}
            loading={sending}
            icon={<Send size={18} strokeWidth={1.8} color={tone.plateInk} />}
            onPress={send}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ModeCard({
  title,
  sub,
  icon,
  on = false,
  soon,
  testID,
}: {
  title: string;
  sub: string;
  icon: React.ReactNode;
  on?: boolean;
  soon?: string;
  testID: string;
}) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="radio"
      accessibilityLabel={soon ? `${title}, ${soon}. ${sub}` : `${title}. ${sub}`}
      accessibilityState={{ checked: on, disabled: !!soon }}
      style={[styles.mode, on ? styles.modeOn : styles.modeOff, soon ? styles.modeSoon : null]}
    >
      <View style={styles.modeIcon}>{icon}</View>
      <View style={styles.modeText}>
        <View style={styles.modeTitleRow}>
          <AppText variant="turnTitle" style={styles.modeTitle}>
            {title}
          </AppText>
          {soon ? (
            <View style={styles.soon}>
              <AppText variant="label" color={tone.gold}>
                {soon}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="body" color={eos.ash} style={styles.modeSub}>
          {sub}
        </AppText>
      </View>
      <View style={[styles.radio, { borderColor: on ? eos.ember : tone.iron }]}>
        {on ? <View style={styles.radioDot} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1 },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  scroll: { paddingHorizontal: layout.gutter, gap: 18 },
  gap8: { height: space[2] },
  friendsLoading: { marginTop: space[3], alignSelf: 'flex-start' },
  noFriends: { marginTop: space[3], gap: space[2], alignItems: 'flex-start' },
  noMatch: { marginTop: space[3] },
  friends: { gap: space[3], paddingTop: space[3], paddingBottom: space[1], paddingHorizontal: space[1] },
  friend: { width: 60, alignItems: 'center', gap: 6 },
  friendName: { maxWidth: 64, textAlign: 'center' },
  modes: { marginTop: space[2], gap: 10 },
  mode: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], padding: 14, borderRadius: radii.cardComponent },
  modeOn: { backgroundColor: tone.warmCardTop, borderWidth: 1, borderColor: alpha(eos.ember, 0.7) },
  modeOff: { backgroundColor: eos.slate, borderWidth: 1, borderColor: surface.cardBorder },
  modeSoon: { opacity: 0.55 },
  modeIcon: { width: 40, height: 40, borderRadius: radii.xl, backgroundColor: eos.rise, alignItems: 'center', justifyContent: 'center' },
  modeText: { flex: 1, minWidth: 0 },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  modeTitle: { fontSize: 17, lineHeight: 22 },
  modeSub: { marginTop: space[1], fontSize: 13, lineHeight: 18 },
  soon: { paddingHorizontal: space[2], height: 20, borderRadius: radii.full, backgroundColor: alpha(tone.gold, 0.16), justifyContent: 'center' },
  radio: { width: 20, height: 20, borderRadius: radii.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: radii.full, backgroundColor: eos.ember },
  facts: { gap: space[3] },
  factRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], minHeight: 32 },
  factValue: { flexShrink: 1, textAlign: 'right', fontSize: 13 },
  segmented: { width: 270 },
  hint: { marginTop: -space[1] },
  dock: { paddingTop: space[4], paddingHorizontal: layout.gutter, backgroundColor: eos.ink },
});

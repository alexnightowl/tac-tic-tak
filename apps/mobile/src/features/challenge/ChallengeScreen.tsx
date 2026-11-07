import type { ChallengeDetail, ChallengeRun, StormFormat } from '@tac/core/storm';
import { eos, layout, radii, space, surface, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { BackLink, Glow } from '@/features/courses/parts';
import { displayNameOf } from '@/features/social/actions';
import { toast } from '@/shell/toast/store';
import { AppText, BackButton, confirm, HeroCard, PlateButton, Tap, TextLink } from '@/ui';
import { useT, useTn, type TFn } from '@/ui/lang';
import { challengeApi, challengeDetailQuery, invalidateChallenges } from './api';
import { clock, ExpiryCountdown, playedLine, PresenceAvatar, RunStrip, StripLegend } from './parts';
import { useStormLaunch } from '@/features/storm/launch';

const newHref = (friendId: string, f: StormFormat) => `/challenge/new?friend=${encodeURIComponent(friendId)}&format=${f}` as Href;

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/rivals' as Href));

/** Results already celebrated this app session (the haptic plays once). */
const celebrated = new Set<string>();

/**
 * /challenge/[id]: one route, the state from GET /challenges/:id —
 * opponent + pending → Incoming (canvas ChallengeIncoming); finished →
 * Result (ChallengeResult); challenger + pending → Waiting (app-only);
 * challenger + draft → "Play your run first" (app-only); declined /
 * expired → a short closed state (app-only).
 */
export function ChallengeScreen({ id }: { id: string }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const q = useQuery(challengeDetailQuery(id));
  const { refetch } = q;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const c = q.data;
  if (!c) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="challenge-loading">
        {q.isError ? (
          <>
            <AppText variant="body" color={eos.ash} style={styles.centerText}>
              {t('challenge.load_error')}
            </AppText>
            <PlateButton testID="challenge-retry" label={t('challenge.retry')} variant="slate" size="sm" onPress={() => void refetch()} />
            <TextLink testID="challenge-error-back" label={t('challenge.back')} chevron={false} onPress={goBack} />
          </>
        ) : (
          <ActivityIndicator color={eos.ash} />
        )}
      </View>
    );
  }
  if (c.status === 'finished') return <Result c={c} />;
  if (c.status === 'pending' && c.role === 'opponent') return <Incoming c={c} onExpire={() => void refetch()} />;
  if (c.status === 'pending') return <Waiting c={c} onExpire={() => void refetch()} />;
  if (c.status === 'draft') return <Draft c={c} />;
  return <Closed c={c} />;
}

// ─── Shared frame ────────────────────────────────────────────────────────

function Frame({
  testID,
  header,
  dock,
  glow = false,
  children,
}: {
  testID: string;
  header: ReactNode;
  dock?: ReactNode;
  glow?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, space[4]) + space[2];
  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID={testID}>
      {glow ? <Glow color={tone.warmCardTop} size={720} stop={0.6} style={styles.glow} /> : null}
      <View style={styles.header}>{header}</View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: dock ? bottom + 140 : bottom }]}>{children}</ScrollView>
      {dock ? <View style={[styles.dock, { paddingBottom: bottom }]}>{dock}</View> : null}
    </View>
  );
}

const Back = ({ t }: { t: TFn }) => <BackLink testID="challenge-back" label={t('challenge.back')} onPress={goBack} />;

/** Me, the big score (or "?"), them: the Result / Waiting hero row. */
function Versus({ c, me, them, meRing }: { c: ChallengeDetail; me: string; them: string; meRing?: string }) {
  const t = useT();
  const name = displayNameOf(c.other);
  return (
    <View style={styles.versus} accessible accessibilityLabel={t('challenge.score_a11y', { me, them, name })} testID="challenge-score">
      <View style={styles.side}>
        <PresenceAvatar nickname={c.me.nickname} avatarUrl={c.me.avatarUrl} size={56} ring={meRing} />
        <AppText variant="captionStrong" style={styles.sideName} numberOfLines={1}>
          {t('challenge.you')}
        </AppText>
      </View>
      <AppText variant="display" style={styles.score}>
        {me}
        <AppText variant="display" color={eos.dust} style={styles.score}>
          {' – '}
        </AppText>
        {them}
      </AppText>
      <View style={styles.side}>
        <PresenceAvatar nickname={c.other.nickname} avatarUrl={c.other.avatarUrl} size={56} />
        <AppText variant="captionStrong" style={styles.sideName} numberOfLines={1}>
          {name}
        </AppText>
      </View>
    </View>
  );
}

// ─── Incoming ────────────────────────────────────────────────────────────

function Incoming({ c, onExpire }: { c: ChallengeDetail; onExpire: () => void }) {
  const t = useT();
  const { launching, launch } = useStormLaunch();
  const tn = useTn();
  const name = displayNameOf(c.other);
  const [declining, setDeclining] = useState(false);

  const decline = () => {
    feel.emit('exitSheet');
    confirm({
      testID: 'challenge-decline',
      title: t('challenge.decline_title'),
      body: t('challenge.decline_body', { name }),
      confirmLabel: t('challenge.decline'),
      cancelLabel: t('challenge.decline_keep'),
      onConfirm: async () => {
        setDeclining(true);
        try {
          await challengeApi.decline(c.id);
          feel.emit('discard');
          invalidateChallenges();
          goBack();
        } catch {
          feel.emit('formError');
          toast.show({ title: t('challenge.decline_error') });
          invalidateChallenges();
          setDeclining(false);
        }
      },
    });
  };

  return (
    <Frame
      testID="challenge-incoming"
      glow
      header={<BackButton variant="back" glyph="close" testID="challenge-close" accessibilityLabel={t('challenge.close')} onPress={goBack} />}
      dock={
        <>
          <PlateButton testID="challenge-accept" label={t('challenge.accept')} size="lg" block loading={launching} onPress={() => void launch({ challengeId: c.id, format: c.format, replace: true })} />
          <View style={styles.dockRow}>
            <PlateButton testID="challenge-later" label={t('challenge.later')} variant="slate" block style={styles.half} onPress={goBack} />
            <View style={styles.half}>
              <PlateButtonGhost testID="challenge-decline" label={t('challenge.decline')} onPress={decline} disabled={declining} />
            </View>
          </View>
        </>
      }
    >
      <View style={styles.centerCol}>
        <AppText variant="kicker" color={tone.rose} style={styles.centerText}>
          {t('challenge.incoming.kicker')}
        </AppText>
        <View style={styles.duel}>
          <Duelist nickname={c.other.nickname} avatarUrl={c.other.avatarUrl} name={name} rating={c.other.rating} ring t={t} />
          <AppText variant="title" color={eos.dust} style={styles.vs}>
            {t('challenge.vs')}
          </AppText>
          <Duelist nickname={c.me.nickname} avatarUrl={c.me.avatarUrl} name={t('challenge.you')} rating={c.me.rating} t={t} />
        </View>
        <AppText variant="heading" accessibilityRole="header" style={styles.incomingTitle} testID="challenge-title">
          {t(`challenge.title.${c.format}`)}
        </AppText>
        {c.theirScore != null ? (
          <AppText variant="body" color={eos.ash} style={styles.lede} testID="challenge-already">
            {t('challenge.incoming.already', { name })}
            <AppText variant="bodyStrong">{playedLine(tn, c.format, c.theirScore)}</AppText>
            {t('challenge.incoming.beat')}
          </AppText>
        ) : null}
        {c.note ? (
          <HeroCard style={styles.noteCard} testID="challenge-note-card">
            <View style={styles.noteRow}>
              <PresenceAvatar nickname={c.other.nickname} avatarUrl={c.other.avatarUrl} size={28} />
              <View style={styles.flex}>
                <AppText variant="captionStrong" color={eos.ash}>
                  {name}
                </AppText>
                <AppText variant="body" style={styles.noteText}>{`“${c.note}”`}</AppText>
              </View>
            </View>
          </HeroCard>
        ) : null}
        {c.expiresAt ? (
          <View style={styles.expiry}>
            <ExpiryCountdown expiresAt={c.expiresAt} t={t} onExpire={onExpire} testID="challenge-expiry" />
          </View>
        ) : null}
      </View>
    </Frame>
  );
}

function Duelist({ nickname, avatarUrl, name, rating, ring = false, t }: { nickname: string; avatarUrl: string | null; name: string; rating: number; ring?: boolean; t: TFn }) {
  return (
    <View style={styles.duelist}>
      <PresenceAvatar nickname={nickname} avatarUrl={avatarUrl} size={84} ring={ring ? eos.ember : undefined} />
      <AppText variant="bodyStrong" numberOfLines={1} style={styles.duelName}>
        {name}
      </AppText>
      <AppText variant="caption" color={eos.ash} style={styles.tabular}>
        {t('challenge.rating', { n: rating })}
      </AppText>
    </View>
  );
}

/** The artboard's plain "Decline" text button: 14 pt bold ash, 48 pt tall. */
function PlateButtonGhost({ label, onPress, testID, disabled }: { label: string; onPress: () => void; testID: string; disabled?: boolean }) {
  return (
    <Tap testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={styles.ghost}>
      <AppText variant="bodyStrong" color={eos.ash}>
        {label}
      </AppText>
    </Tap>
  );
}

// ─── Result ──────────────────────────────────────────────────────────────

function Result({ c }: { c: ChallengeDetail }) {
  const t = useT();
  const name = displayNameOf(c.other);
  const verdict = c.verdict ?? 'draw';
  const mine = c.myRun;
  const theirs = c.theirRun;

  useEffect(() => {
    if (celebrated.has(c.id)) return;
    celebrated.add(c.id);
    if (verdict === 'win') feel.emit('normRise');
  }, [c.id, verdict]);

  const v =
    verdict === 'win'
      ? { text: c.byTime ? t('challenge.verdict.tie_you') : t('challenge.verdict.win'), color: c.byTime ? eos.bone : tone.sage, ring: tone.sageDeep }
      : verdict === 'loss'
        ? { text: c.byTime ? t('challenge.verdict.tie_them', { name }) : t('challenge.verdict.loss', { name }), color: c.byTime ? eos.bone : tone.rose, ring: undefined }
        : { text: t('challenge.verdict.draw'), color: eos.bone, ring: undefined };

  const surv = c.format === 'survival';
  const avg = (r: ChallengeRun | null) => (r && r.results.length ? clock(r.durationMs / r.results.length) : '—');
  const a = mine?.score ?? c.myScore ?? 0;
  const b = theirs?.score ?? c.theirScore ?? 0;
  const rows: { label: string; a: string; b: string; win?: 'a' | 'b' }[] = [
    { label: t('challenge.row.solved'), a: String(a), b: String(b), win: a > b ? 'a' : b > a ? 'b' : undefined },
    { label: t('challenge.row.mistakes'), a: String(mine?.mistakes ?? '—'), b: String(theirs?.mistakes ?? '—') },
    { label: t('challenge.row.hardest'), a: mine?.hardest != null ? String(mine.hardest) : '—', b: theirs?.hardest != null ? String(theirs.hardest) : '—' },
    surv
      ? { label: t('challenge.row.lasted'), a: mine ? clock(mine.durationMs) : '—', b: theirs ? clock(theirs.durationMs) : '—' }
      : { label: t('challenge.row.avg'), a: avg(mine), b: avg(theirs) },
  ];

  return (
    <Frame
      testID="challenge-result"
      header={<Back t={t} />}
      dock={<PlateButton testID="challenge-rematch" label={t('challenge.rematch')} size="lg" block onPress={() => router.push(newHref(c.other.id, c.format))} />}
    >
      <HeroCard style={styles.hero}>
        <AppText variant="kicker" color={v.color} style={styles.centerText} testID={`challenge-verdict-${verdict}`}>
          {v.text}
        </AppText>
        <Versus c={c} me={String(a)} them={String(b)} meRing={v.ring} />
        <AppText variant="body" color={eos.ash} style={styles.centerText}>
          {t(`challenge.sub.${c.format}`)}
        </AppText>
      </HeroCard>

      <View style={styles.panel}>
        <AppText variant="label" color={eos.ash}>
          {t('challenge.strips')}
        </AppText>
        <StripRow label={t('challenge.you')} run={mine} t={t} testID="challenge-strip-me" />
        <StripRow label={name} run={theirs} t={t} testID="challenge-strip-them" />
        <StripLegend t={t} />
      </View>

      <View style={[styles.panel, styles.table]} testID="challenge-table">
        <View style={styles.tr}>
          <View style={styles.flex} />
          <AppText variant="label" color={eos.dust} style={styles.td}>
            {t('challenge.you')}
          </AppText>
          <AppText variant="label" color={eos.dust} style={styles.td} numberOfLines={1}>
            {name}
          </AppText>
        </View>
        {rows.map((r) => (
          <View key={r.label} style={[styles.tr, styles.trRule]} accessible accessibilityLabel={`${r.label}: ${t('challenge.you')} ${r.a}, ${name} ${r.b}`}>
            <AppText variant="captionStrong" color={eos.ash} style={[styles.flex, styles.thText]}>
              {r.label}
            </AppText>
            <AppText variant="bodyStrong" color={r.win === 'a' ? tone.sage : eos.bone} style={styles.td}>
              {r.a}
            </AppText>
            <AppText variant="bodyStrong" color={r.win === 'b' ? tone.sage : eos.bone} style={styles.td}>
              {r.b}
            </AppText>
          </View>
        ))}
      </View>
    </Frame>
  );
}

function StripRow({ label, run, t, testID }: { label: string; run: ChallengeRun | null; t: TFn; testID: string }) {
  return (
    <View style={styles.stripRow}>
      <AppText variant="captionStrong" color={eos.ash} numberOfLines={1} style={styles.stripName}>
        {label}
      </AppText>
      <RunStrip results={run?.results ?? []} label={t('challenge.strip_a11y', { n: run?.score ?? 0, m: run?.mistakes ?? 0 })} testID={testID} />
    </View>
  );
}

// ─── Waiting / Draft / Closed (app-only) ─────────────────────────────────

function Waiting({ c, onExpire }: { c: ChallengeDetail; onExpire: () => void }) {
  const t = useT();
  const name = displayNameOf(c.other);
  const score = c.myRun?.score ?? c.myScore ?? 0;
  return (
    <Frame testID="challenge-waiting" header={<Back t={t} />}>
      <HeroCard style={styles.hero}>
        <AppText variant="kicker" color={tone.rose} style={styles.centerText}>
          {t('challenge.waiting.kicker')}
        </AppText>
        <Versus c={c} me={String(score)} them="?" />
        <AppText variant="title" accessibilityRole="header" style={styles.centerText} testID="challenge-waiting-title">
          {t('challenge.waiting.title', { name })}
        </AppText>
        <AppText variant="body" color={eos.ash} style={styles.centerText}>
          {t(`challenge.sub.${c.format}`)}
        </AppText>
      </HeroCard>
      {c.myRun ? (
        <View style={styles.panel}>
          <AppText variant="label" color={eos.ash}>
            {t('challenge.waiting.your_run')}
          </AppText>
          <StripRow label={t('challenge.you')} run={c.myRun} t={t} testID="challenge-strip-me" />
          <StripLegend t={t} />
        </View>
      ) : null}
      {c.note ? (
        <View style={styles.panel}>
          <AppText variant="body">{`“${c.note}”`}</AppText>
        </View>
      ) : null}
      {c.expiresAt ? (
        <View style={styles.expiry}>
          <ExpiryCountdown expiresAt={c.expiresAt} t={t} onExpire={onExpire} testID="challenge-expiry" />
        </View>
      ) : null}
    </Frame>
  );
}

function Draft({ c }: { c: ChallengeDetail }) {
  const t = useT();
  const { launching, launch } = useStormLaunch();
  const name = displayNameOf(c.other);
  return (
    <Frame
      testID="challenge-draft"
      header={<Back t={t} />}
      dock={<PlateButton testID="challenge-play" label={t('challenge.draft.play')} size="lg" block loading={launching} onPress={() => void launch({ challengeId: c.id, format: c.format, replace: true })} />}
    >
      <HeroCard style={styles.hero}>
        <AppText variant="kicker" color={tone.rose} style={styles.centerText}>
          {t('challenge.draft.kicker')}
        </AppText>
        <AppText variant="title" accessibilityRole="header" style={styles.centerText}>
          {t('challenge.draft.title')}
        </AppText>
        <AppText variant="body" color={eos.ash} style={styles.centerText}>
          {t('challenge.draft.body', { name })}
        </AppText>
        <AppText variant="captionStrong" color={eos.ash} style={styles.centerText}>
          {t(`challenge.title.${c.format}`)}
        </AppText>
      </HeroCard>
    </Frame>
  );
}

function Closed({ c }: { c: ChallengeDetail }) {
  const t = useT();
  const name = displayNameOf(c.other);
  const declined = c.status === 'declined';
  const cancelled = c.status === 'cancelled';
  const title = declined
    ? c.role === 'opponent'
      ? t('challenge.declined.title_me')
      : t('challenge.declined.title', { name })
    : cancelled
      ? t('challenge.cancelled.title')
      : t('challenge.expired.title');
  return (
    <Frame
      testID={declined ? 'challenge-declined' : cancelled ? 'challenge-cancelled' : 'challenge-expired'}
      header={<Back t={t} />}
      dock={<PlateButton testID="challenge-again" label={t('challenge.again')} variant="slate" size="lg" block onPress={() => router.push(newHref(c.other.id, c.format))} />}
    >
      <HeroCard style={styles.hero}>
        <View style={styles.versusSolo}>
          <PresenceAvatar nickname={c.other.nickname} avatarUrl={c.other.avatarUrl} size={56} />
        </View>
        <AppText variant="title" accessibilityRole="header" style={styles.centerText}>
          {title}
        </AppText>
        <AppText variant="body" color={eos.ash} style={styles.centerText}>
          {declined ? t(`challenge.sub.${c.format}`) : cancelled ? t('challenge.cancelled.body') : t('challenge.expired.body')}
        </AppText>
      </HeroCard>
      {c.myRun ? (
        <View style={styles.panel}>
          <AppText variant="label" color={eos.ash}>
            {t('challenge.waiting.your_run')}
          </AppText>
          <StripRow label={t('challenge.you')} run={c.myRun} t={t} testID="challenge-strip-me" />
        </View>
      ) : null}
    </Frame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: layout.gutter },
  centerText: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  glow: { top: -260, alignSelf: 'center' },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  scroll: { paddingHorizontal: layout.gutter, gap: space[4] },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space[3], paddingHorizontal: layout.gutter, gap: 10 },
  dockRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  ghost: { height: layout.plateHeight.md, alignItems: 'center', justifyContent: 'center' },

  centerCol: { alignItems: 'center', paddingTop: space[4], paddingHorizontal: space[2] },
  duel: { marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 18 },
  duelist: { alignItems: 'center', gap: space[2], width: 110 },
  duelName: { maxWidth: 110 },
  vs: { marginBottom: 44 },
  incomingTitle: { marginTop: 28, fontSize: 28, lineHeight: 34, textAlign: 'center' },
  lede: { marginTop: space[2], textAlign: 'center' },
  noteCard: { marginTop: 22, alignSelf: 'stretch', paddingVertical: 14, paddingHorizontal: space[4] },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noteText: { marginTop: 2 },
  expiry: { marginTop: space[4], alignItems: 'center' },

  hero: { paddingVertical: 22, paddingHorizontal: 18, gap: space[3], alignItems: 'stretch' },
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  versusSolo: { alignItems: 'center' },
  side: { alignItems: 'center', gap: 6, width: 72 },
  sideName: { maxWidth: 72 },
  score: { fontSize: 48, lineHeight: 52, fontVariant: ['tabular-nums'] },

  panel: { padding: 14, borderRadius: radii.cardComponent, backgroundColor: eos.slate, borderWidth: 1, borderColor: surface.cardBorder },
  stripRow: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stripName: { width: 48 },
  table: { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: space[2], paddingHorizontal: 14 },
  trRule: { borderTopWidth: 1, borderTopColor: eos.rise },
  thText: { fontSize: 13 },
  td: { width: 72, textAlign: 'right', fontVariant: ['tabular-nums'] },
});

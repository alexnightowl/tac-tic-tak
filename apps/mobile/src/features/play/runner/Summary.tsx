import { queryKeys } from '@tac/core/api';
import { fmtResponseTime } from '@tac/core/format';
import { LEVEL_GUARD_GAP } from '@tac/core/rules';
import { levelOutcomeOf, levelRankChangeOf, type FinishResponse, type LevelOutcome } from '@tac/core/runner';
import { control, eos, layout, radii, semantic, space, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel, stopLongClip } from '@/feel';
import { XpSummaryCard } from '@/features/experience/XpCard';
import { apiClient } from '@/platform/api';
import { AppText, Card, PlateButton } from '@/ui';
import { Tap } from '@/ui/Tap';
import type { PlayT } from '../strings';
import { bandIcon } from '../setup/bandIcons';
import { STRONG, TABULAR } from '../ui';
import { CasualNote, EarlyExitNote, LevelDownCard, LevelGuardCard, LevelUpCard, StreakOutcomeChip } from './outcomeCards';
import { RankCeremony } from './RankCeremony';

// Session summary (design PlayV2Sum*): the rank ceremony when the level
// crosses a band, else the gate / level-down sound with the card; the
// rating card with the level, the outcome card, the stats grid,
// ReviewThisSession, then Play again / Home. Rendered by the runner route
// in place of the board (PLAN §2.3).

type ReviewItems = { items: { reason: 'failed' | 'slow' }[] };

function Stat({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <Card style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="value" testID={`summary-${id}`}>
        {value}
      </AppText>
    </Card>
  );
}

export function Summary({
  summary,
  serverSummary,
  sessionMode,
  difficulty,
  styleLabel,
  onHome,
  onPlayAgain,
  playAgainLoading,
  t,
}: {
  summary: FinishResponse;
  /** False for the client-counter fallback (network down at finish). */
  serverSummary: boolean;
  sessionMode: 'mixed' | 'casual' | 'theme';
  /** The picked difficulty of a casual / theme session. */
  difficulty: number | null;
  styleLabel: string;
  onHome: () => void;
  onPlayAgain: () => void;
  playAgainLoading: boolean;
  t: PlayT;
}) {
  const rankChange = levelRankChangeOf(summary);
  const [ceremony, setCeremony] = useState(() => !!rankChange?.crossed);
  if (ceremony && rankChange) {
    return (
      <RankCeremony
        direction={rankChange.up ? 'up' : 'down'}
        from={rankChange.from}
        to={rankChange.to}
        normFrom={rankChange.before}
        normTo={rankChange.after}
        styleLabel={styleLabel}
        onClose={() => setCeremony(false)}
        t={t}
      />
    );
  }
  return (
    <SummaryBody
      summary={summary}
      serverSummary={serverSummary}
      sessionMode={sessionMode}
      difficulty={difficulty}
      styleLabel={styleLabel}
      gate={rankChange && !rankChange.crossed ? (rankChange.up ? 'up' : 'down') : null}
      onHome={onHome}
      onPlayAgain={onPlayAgain}
      playAgainLoading={playAgainLoading}
      t={t}
    />
  );
}

function SummaryBody({
  summary,
  serverSummary,
  sessionMode,
  difficulty,
  styleLabel,
  gate,
  onHome,
  onPlayAgain,
  playAgainLoading,
  t,
}: {
  summary: FinishResponse;
  serverSummary: boolean;
  sessionMode: 'mixed' | 'casual' | 'theme';
  difficulty: number | null;
  styleLabel: string;
  gate: 'up' | 'down' | null;
  onHome: () => void;
  onPlayAgain: () => void;
  playAgainLoading: boolean;
  t: PlayT;
}) {
  const insets = useSafeAreaInsets();
  const outcome = levelOutcomeOf(summary);

  // A norm move inside one band: the gate (up) or rank-down (down) clip
  // with the outcome card; a long clip fades when the summary goes.
  useEffect(() => {
    if (gate) feel.emit(gate === 'up' ? 'normGateUp' : 'normDrop');
    return () => stopLongClip(400);
  }, [gate]);

  return (
    <ScrollView
      testID="summary-screen"
      contentContainerStyle={[styles.root, { paddingTop: insets.top + space[10], paddingBottom: insets.bottom + space[6] }]}
    >
      <AppText variant="title" style={styles.center} accessibilityRole="header">
        {t('play.session_complete')}
      </AppText>

      {summary.streak && <StreakOutcomeChip streak={summary.streak} t={t} />}

      {outcome && <RatingCard o={outcome} styleLabel={styleLabel} t={t} />}
      {outcome?.early && <EarlyExitNote t={t} />}
      {outcome?.up && <LevelUpCard level={outcome.level} styleName={styleLabel.toLowerCase()} t={t} />}
      {outcome?.guarded && <LevelGuardCard level={outcome.level} under={outcome.level - outcome.ratingAfter} t={t} />}
      {outcome?.down && <LevelDownCard level={outcome.level} line={outcome.levelBefore - LEVEL_GUARD_GAP} t={t} />}
      {sessionMode === 'casual' && difficulty != null && <CasualNote difficulty={difficulty} t={t} />}
      {summary.xp && <XpSummaryCard gained={summary.xp.gained} before={summary.xp.before} after={summary.xp.after} t={t} />}

      <View style={styles.grid}>
        <Stat id="solved" label={t('play.solved')} value={String(summary.solved)} />
        <Stat id="failed" label={t('play.failed')} value={String(summary.failed)} />
        <Stat id="accuracy" label={t('play.accuracy')} value={`${Math.round(summary.accuracy * 100)}%`} />
        <Stat id="avg" label={t('play.avg')} value={fmtResponseTime(summary.avgResponseMs)} />
        <Stat id="peak" label={t('play.peak')} value={String(summary.peakRating)} />
      </View>

      {serverSummary && <ReviewThisSession sessionId={summary.sessionId} t={t} />}

      <View style={styles.buttons}>
        <PlateButton
          testID="summary-play-again"
          label={playAgainLoading ? t('play.starting') : t('play.play_again')}
          loading={playAgainLoading}
          onPress={onPlayAgain}
          size="lg"
          block
        />
        <PlateButton testID="summary-home" label={t('home')} onPress={onHome} variant="slate" block />
      </View>
    </ScrollView>
  );
}

/** The rating move and the level, with the way to the next mark (design PlayV2Sum* hero). */
function RatingCard({ o, styleLabel, t }: { o: LevelOutcome; styleLabel: string; t: PlayT }) {
  const up = o.delta >= 0;
  const guarded = o.guarded;
  return (
    <Card style={styles.hero} testID="summary-rating">
      <View style={styles.heroHead}>
        <Image source={bandIcon(o.ratingAfter)} style={styles.heroEye} contentFit="contain" transition={null} />
        <View style={styles.flex}>
          <AppText variant="label">{t('play.your_rating', { style: styleLabel.toLowerCase() })}</AppText>
          <View style={styles.heroRow}>
            <AppText variant="value" style={styles.heroValue} testID="summary-rating-after">
              {String(o.ratingAfter)}
            </AppText>
            <View style={[styles.delta, { backgroundColor: up ? control.sageTint16 : control.emberTint16 }]}>
              <AppText variant="captionStrong" color={up ? eos.sage : eos.rose} style={TABULAR} testID="summary-rating-delta">
                {`${up ? '+' : '−'}${Math.abs(o.delta)}`}
              </AppText>
            </View>
            <AppText variant="caption" color={eos.dust} style={TABULAR}>
              {t('summary.rating_from', { rating: o.ratingBefore })}
            </AppText>
          </View>
        </View>
      </View>
      <View style={styles.heroLevel}>
        <AppText variant="label" style={TABULAR} testID="summary-level">
          {t('summary.level', { level: o.level })}
        </AppText>
        <AppText variant="label" color={guarded ? tone.gold : eos.ash} style={TABULAR} testID="summary-level-next">
          {guarded ? t('summary.protected', { n: 1, total: 2 }) : t('play.to_next', { n: o.toNext, next: o.next })}
        </AppText>
      </View>
      <View style={styles.heroBar}>
        <LinearGradient
          colors={guarded ? [tone.gold, tone.gold] : control.rankProgress}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.heroFill, { width: `${(guarded ? 0 : o.ratio) * 100}%` }]}
        />
      </View>
    </Card>
  );
}

/** web ReviewThisSession: failed + slow puzzles of this session, a CTA into its review runner. */
function ReviewThisSession({ sessionId, t }: { sessionId: string; t: PlayT }) {
  const q = useQuery({
    queryKey: queryKeys.sessionReviewItems(sessionId),
    queryFn: () => apiClient.get<ReviewItems>(`/sessions/${encodeURIComponent(sessionId)}/review-items`),
  });
  const items = q.data?.items ?? [];
  const failed = items.filter((i) => i.reason === 'failed').length;
  const slow = items.filter((i) => i.reason === 'slow').length;
  if (failed === 0 && slow === 0) return null;
  const hint = t('review.session_hint', { failed, slow });
  return (
    <Tap
      testID="summary-review"
      accessibilityRole="button"
      accessibilityLabel={`${t('review.session_heading')}. ${hint}`}
      onPress={() => router.push(`/sessions/${sessionId}/review` as Href)}
      style={styles.review}
    >
      <View style={styles.flex}>
        <AppText variant="body" color={eos.bone} style={STRONG}>
          {t('review.session_heading')}
        </AppText>
        <AppText variant="caption" testID="summary-review-hint">
          {hint}
        </AppText>
        <View style={styles.reviewCta}>
          <AppText variant="plateLabelSm" color={eos.bone}>
            {t('review.session_cta')}
          </AppText>
        </View>
      </View>
      <ChevronRight size={18} color={eos.dust} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: layout.gutter, gap: space[4] },
  center: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0, gap: space[0.5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  stat: { flexBasis: '48%', flexGrow: 1, padding: space[3], gap: space[1] },
  hero: { padding: space[4], gap: space[2.5] },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  heroEye: { width: 44, height: 44 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[2], flexWrap: 'wrap' },
  heroValue: { fontSize: 30, lineHeight: 36 },
  delta: { paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radii.full },
  heroLevel: { flexDirection: 'row', justifyContent: 'space-between' },
  heroBar: { height: 6, borderRadius: radii.full, backgroundColor: eos.well, overflow: 'hidden' },
  heroFill: { height: 6, borderRadius: radii.full },
  review: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: semantic.borderSoft,
    backgroundColor: eos.well,
  },
  reviewCta: {
    alignSelf: 'flex-start',
    marginTop: space[2.5],
    height: space[9],
    paddingHorizontal: space[4],
    borderRadius: radii.lg,
    justifyContent: 'center',
    backgroundColor: eos.ember,
  },
  buttons: { gap: space[3], marginTop: space[2] },
});

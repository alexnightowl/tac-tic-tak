import { queryKeys } from '@tac/core/api';
import { fmtResponseTime } from '@tac/core/format';
import { rankChangeOf, summaryOutcome, type FinishResponse } from '@tac/core/runner';
import { eos, layout, radii, semantic, space } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel, stopLongClip } from '@/feel';
import { apiClient } from '@/platform/api';
import { AppText, Card, PlateButton } from '@/ui';
import { Tap } from '@/ui/Tap';
import type { PlayT } from '../strings';
import { STRONG } from '../ui';
import {
  ComfortSessionNote,
  DemoteOutcomeCard,
  EarlyExitNote,
  LevelUpExplainer,
  StreakOutcomeChip,
  UnlockOutcome,
} from './outcomeCards';
import { RankCeremony } from './RankCeremony';

// web SessionSummary at parity: rank change (ceremony on a band crossing,
// else the gate / rank-down sound with the card), the outcome area, the
// stats grid, ReviewThisSession, then Play again / Home. Rendered by the
// runner route in place of the board (PLAN §2.3).

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
  ceilingBefore,
  styleLabel,
  onHome,
  onPlayAgain,
  playAgainLoading,
  t,
}: {
  summary: FinishResponse;
  /** False for the client-counter fallback (network down at finish). */
  serverSummary: boolean;
  ceilingBefore: number | null;
  styleLabel: string;
  onHome: () => void;
  onPlayAgain: () => void;
  playAgainLoading: boolean;
  t: PlayT;
}) {
  const rankChange = rankChangeOf(summary, ceilingBefore);
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
      ceilingBefore={ceilingBefore}
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
  ceilingBefore,
  gate,
  onHome,
  onPlayAgain,
  playAgainLoading,
  t,
}: {
  summary: FinishResponse;
  serverSummary: boolean;
  ceilingBefore: number | null;
  gate: 'up' | 'down' | null;
  onHome: () => void;
  onPlayAgain: () => void;
  playAgainLoading: boolean;
  t: PlayT;
}) {
  const insets = useSafeAreaInsets();
  const outcome = summaryOutcome(summary, ceilingBefore);

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

      {outcome.early && <EarlyExitNote t={t} />}
      {outcome.calibrationComplete && (
        <LevelUpExplainer ceiling={outcome.calibrationComplete.ceiling} floor={outcome.calibrationComplete.floor} t={t} />
      )}
      {outcome.comfort && <ComfortSessionNote floor={outcome.comfort.floor} t={t} />}
      {/* Design: one outcome card per session — a demote / weak-at-peak card replaces "So close". */}
      {outcome.unlock && (outcome.unlock.unlocked || !outcome.demote) && (
        <UnlockOutcome unlocked={outcome.unlock.unlocked} criteria={outcome.unlock.criteria} t={t} />
      )}
      {outcome.demote && <DemoteOutcomeCard demote={outcome.demote} t={t} />}

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

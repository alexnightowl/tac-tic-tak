import type { SessionDetail } from '@tac/core/api';
import { normalizePieceSet } from '@tac/core/board';
import { fmtResponseTime } from '@tac/core/format';
import type { ServerPuzzle } from '@tac/core/puzzle';
import { LEVEL_GUARD_GAP, levelOf, type TrainingStyle } from '@tac/core/rules';
import { levelFor, levelNextNote, levelOutcomeOf, levelProgress, levelRankChangeOf, tacticalThemes, type FinishResponse, type LevelOutcome } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { alpha, eos, tone } from '@tac/core/tokens';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Check, RefreshCw, X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { feel, stopLongClip } from '@/feel';
import { RankTile } from '@/features/experience/XpCard';
import { fmtXp } from '@/features/experience/xp';
import { bandIcon } from '@/features/play/setup/bandIcons';
import { CasualNote, EarlyExitNote, LevelDownCard, LevelGuardCard, LevelUpCard, PaceHeldCard, StreakOutcomeChip } from '@/features/play/runner/outcomeCards';
import { RankCeremony } from '@/features/play/runner/RankCeremony';
import { puzzleApi, reviewKeys, sessionApi } from '@/features/review/api';
import { useAppStore } from '@/stores/appStore';
import { PlateButton } from '@/ui';
import { useLang, useT, type TFn } from '@/ui/lang';
import { DxBlindSummary } from '../blind/DxBlindSummary';
import { useDesktopChrome } from '../chrome';
import { useHotkeys } from '../hotkeys';
import { DesktopPage } from '../Page';
import { Bar, Card, DText, GhostButton, Hover, Label, Seg, Tile } from '../kit';
import { dx, dxSize } from '../tokens';
import { useRawWindow } from '@/platform/webFrame';
import { MiniBoard } from './MiniBoard';

// The runner's summary on a desktop-wide window (canvas DXSessionSummary):
// the full sidebar comes back, the rating card, four stat tiles, the XP
// card and the actions on the left; the session's puzzles as mini boards
// (all / mistakes) on the right, each opening the puzzle viewer. The rank
// ceremony, when the level crossed a band, plays first (phone component).

const HOME = '/' as Href;
/** Mini boards fetched at most (one GET /puzzles/:id each, cached for the viewer). */
const MAX_BOARDS = 36;
const MINI = 150;
const CELL = MINI + 10;

type Props = {
  summary: FinishResponse;
  serverSummary: boolean;
  sessionMode: 'mixed' | 'casual' | 'theme';
  style: TrainingStyle | null;
  durationSec: number;
  difficulty: number | null;
  onPlayAgain: () => void;
  playAgainLoading: boolean;
  /** D40 trainer cards (daily plan, haste), after the outcome cards. */
  extras?: ReactNode;
  /** D40: the subtitle's mode word for a trainer session ("Today's plan"). */
  modeLabel?: string;
};

export function DxSessionSummary(p: Props) {
  const t = useT();
  const rankChange = levelRankChangeOf(p.summary);
  const [ceremony, setCeremony] = useState(() => !!rankChange?.crossed);
  useDesktopChrome(ceremony && rankChange ? 'bare' : 'full');
  const styleLabel = p.style ? t(`style.${p.style}.name`) : '';
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
  return <Body {...p} styleLabel={styleLabel} gate={rankChange && !rankChange.crossed ? (rankChange.up ? 'up' : 'down') : null} />;
}

function Body({
  summary,
  serverSummary,
  sessionMode,
  style,
  durationSec,
  difficulty,
  onPlayAgain,
  playAgainLoading,
  extras,
  modeLabel,
  styleLabel,
  gate,
}: Props & { styleLabel: string; gate: 'up' | 'down' | null }) {
  const t = useT();
  const { lang } = useLang();
  const outcome = levelOutcomeOf(summary);
  const sessionId = summary.sessionId;

  // A norm move inside one band: the gate / rank-down clip (as on the phone).
  useEffect(() => {
    if (gate) feel.emit(gate === 'up' ? 'normGateUp' : 'normDrop');
    return () => stopLongClip(400);
  }, [gate]);

  const detail = useQuery({
    queryKey: reviewKeys.session(sessionId),
    queryFn: () => sessionApi.detail(sessionId),
    enabled: serverSummary,
  });
  const review = useQuery({
    queryKey: reviewKeys.sessionReviewItems(sessionId),
    queryFn: () => sessionApi.reviewItems(sessionId),
    enabled: serverSummary,
  });
  const reviewItems = review.data?.items ?? [];
  const mistakes = reviewItems.length;
  const missed = reviewItems.filter((i) => i.reason === 'failed').length;
  const slow = reviewItems.filter((i) => i.reason === 'slow').length;
  const goHome = () => router.dismissTo(HOME);
  const repeat = () => router.push(`/sessions/${sessionId}/review` as Href);

  useHotkeys({ ' ': () => !playAgainLoading && onPlayAgain() });

  const attempts = detail.data?.attempts ?? [];
  const puzzles = usePuzzles(attempts.slice(0, MAX_BOARDS).map((a) => a.puzzleId));
  const hardest = attempts.filter((a) => a.correct).sort((a, b) => b.puzzleRating - a.puzzleRating)[0];
  const hardestTheme = hardest ? tacticalThemes(puzzles.get(hardest.puzzleId)?.themes ?? [], 1)[0] : undefined;
  const total = summary.solved + summary.failed;

  // A rated finish without the level fields (an early exit, an older API):
  // the hero still shows the level and the session's difficulty move, from the session record and the
  // stored progression. Display only; the outcome cards stay off.
  const prog = useAppStore((st) => (style ? st.progressions[style] : null));
  const d = detail.data;
  const shownOutcome: LevelOutcome | null =
    outcome ??
    (sessionMode === 'mixed' && d && prog
      ? (() => {
          const level = levelFor(prog);
          const p = levelProgress(d.endRating, level);
          return {
            ratingBefore: d.startRating,
            ratingAfter: d.endRating,
            delta: d.endRating - d.startRating,
            level,
            levelBefore: level,
            next: p.next,
            toNext: p.toNext,
            ratio: p.ratio,
            levelMark: p.levelMark,
            up: false,
            down: false,
            guarded: false,
            early: false,
            paceHeld: false,
            pace: null,
          } satisfies LevelOutcome;
        })()
      : null);

  const mode = modeLabel ?? t(sessionMode === 'mixed' ? 'dx.board.mode_mixed' : sessionMode === 'casual' ? 'dx.board.mode_casual' : 'dx.board.mode_theme');
  const subtitle = [mode, styleLabel, durationSec ? t('dx.board.minutes', { n: Math.round(durationSec / 60) }) : null].filter(Boolean).join(' · ');

  // The page beside the full sidebar: two columns from ~1100 px of content
  // (the artboard), the puzzles card two boards wide below that, stacked
  // under the summary on a 1024 px window.
  const avail = useRawWindow().width - dxSize.sidebar - dxSize.padX * 2;
  const cols = avail >= 1080 ? 3 : 2;
  const stacked = avail < 900;
  const puzzlesCols = stacked ? 4 : cols;

  return (
    <DesktopPage title={t('play.session_complete')} subtitle={subtitle} testID="summary-screen" right={null}>
      <View style={[styles.cols, stacked && styles.stacked]}>
        <View style={styles.main}>
          {summary.streak ? <StreakOutcomeChip streak={summary.streak} t={t} /> : null}
          {shownOutcome ? <LevelCard o={shownOutcome} styleLabel={styleLabel} t={t} /> : null}
          {outcome?.early && <EarlyExitNote t={t} />}
          {outcome?.up && <LevelUpCard level={outcome.level} styleName={styleLabel.toLowerCase()} t={t} />}
          {outcome?.paceHeld && outcome.pace && (
            <PaceHeldCard next={levelOf(outcome.ratingAfter)} solved={outcome.pace.solved} target={outcome.pace.target} t={t} />
          )}
          {outcome?.guarded && <LevelGuardCard level={outcome.level} under={outcome.level - outcome.ratingAfter} t={t} />}
          {outcome?.down && <LevelDownCard level={outcome.level} line={outcome.levelBefore - LEVEL_GUARD_GAP} t={t} />}
          {sessionMode === 'casual' && difficulty != null && <CasualNote difficulty={difficulty} t={t} />}
          <DxBlindSummary sessionId={summary.sessionId} />
          {extras}

          {/* The phone's five stats (solved, failed, accuracy, avg, peak) plus the hardest solve; they wrap on a narrow column. */}
          <View style={styles.tiles}>
            <SumTile
              id="solved"
              label={t('play.solved')}
              value={total ? `${summary.solved} / ${total}` : String(summary.solved)}
              caption={t('dx.board.accuracy_n', { n: Math.round(summary.accuracy * 100) })}
              captionTestID="summary-accuracy"
            />
            <SumTile id="failed" label={t('play.failed')} value={String(summary.failed)} color={summary.failed ? tone.roseSoft : undefined} />
            <SumTile id="avg" label={t('dx.board.avg_time')} value={fmtResponseTime(summary.avgResponseMs)} />
            <SumTile id="peak" label={t('dx.board.session_peak')} value={String(summary.peakRating)} />
            <SumTile
              id="hardest"
              label={t('dx.board.hardest')}
              value={hardest ? String(hardest.puzzleRating) : '—'}
              caption={hardestTheme ? themeLabel(hardestTheme, lang) : undefined}
            />
          </View>

          {summary.xp ? <XpCard gained={summary.xp.gained} after={summary.xp.after} rankBefore={summary.xp.before.rank} t={t} lang={lang} /> : null}

          {/* The phone's "Review this session" card: what went wrong (N missed, M slow); Repeat mistakes below opens its review runner. */}
          {mistakes > 0 ? (
            <View style={styles.review} testID="summary-review-card">
              <RefreshCw size={16} color={dx.ash} strokeWidth={1.8} />
              <View style={styles.flex}>
                <DText size={14} weight={800}>
                  {t('review.session_heading')}
                </DText>
                <DText size={12.5} color={dx.ash} style={styles.mt2} testID="summary-review-hint">
                  {t('review.session_hint', { failed: missed, slow })}
                </DText>
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            {/* One height (44) and one centre line for the three; natural widths, as in the artboard. */}
            <PlateButton
              testID="summary-play-again"
              label={playAgainLoading ? t('play.starting') : t('play.play_again')}
              loading={playAgainLoading}
              onPress={onPlayAgain}
              size="md"
            />
            {mistakes > 0 ? (
              <PlateButton
                testID="summary-review"
                label={t('dx.board.repeat_mistakes')}
                variant="slate"
                size="md"
                icon={<RefreshCw size={16} color={eos.bone} strokeWidth={1.8} />}
                onPress={repeat}
              />
            ) : null}
            <GhostButton testID="summary-home" label={t('dx.board.to_home')} accessibilityLabel={t('dx.board.to_home')} height={44} onPress={goHome} />
          </View>
        </View>

        {serverSummary ? (
          <PuzzlesCard detail={detail.data} loading={detail.isPending} puzzles={puzzles} cols={puzzlesCols} t={t} lang={lang} />
        ) : null}
      </View>
    </DesktopPage>
  );
}

/** The session's puzzles by id (each GET /puzzles/:id, shared with the viewer's cache). */
function usePuzzles(ids: string[]): Map<string, ServerPuzzle> {
  const qs = useQueries({
    queries: ids.map((id) => ({
      queryKey: reviewKeys.puzzle(id),
      queryFn: () => puzzleApi.get(id),
      staleTime: Infinity,
      retry: false,
    })),
  });
  const map = new Map<string, ServerPuzzle>();
  qs.forEach((q, i) => {
    if (q.data) map.set(ids[i], q.data);
  });
  return map;
}

function SumTile({
  id,
  label,
  value,
  caption,
  captionTestID,
  color,
}: {
  id: string;
  label: string;
  value: string;
  caption?: string;
  captionTestID?: string;
  color?: string;
}) {
  return (
    <Tile style={styles.tile}>
      <Label size={10}>{label}</Label>
      <DText size={26} weight={800} ls={-0.3} tabular color={color} style={styles.mt6} testID={`summary-${id}`}>
        {value}
      </DText>
      {caption ? (
        <DText size={12} color={dx.dust} numberOfLines={2} testID={captionTestID}>
          {caption}
        </DText>
      ) : null}
    </Tile>
  );
}

/**
 * DXSessionSummary hero, the level card (D39): the band eye, the level
 * after the session (big, with its move when it moved), the session's
 * difficulty start → end, the way to the next mark.
 */
function LevelCard({ o, styleLabel, t }: { o: LevelOutcome; styleLabel: string; t: TFn }) {
  const up = o.delta >= 0;
  const moved = o.level - o.levelBefore;
  const nextNote = levelNextNote(o);
  return (
    <Card texture style={styles.hero} testID="summary-rating">
      <Image source={bandIcon(o.level)} style={styles.eye} contentFit="contain" transition={null} />
      <View style={styles.flex}>
        <Label>{t('dx.board.your_level', { style: styleLabel.toLowerCase() })}</Label>
        <View style={styles.heroRow}>
          <DText size={46} weight={800} ls={-0.3} tabular testID="summary-level-after">
            {String(o.level)}
          </DText>
          {moved ? (
            <View style={[styles.delta, { backgroundColor: alpha(moved > 0 ? tone.sageDeep : eos.ember, 0.16) }]}>
              <DText size={13} weight={800} color={moved > 0 ? eos.sage : eos.rose} tabular testID="summary-level-delta">
                {`${moved > 0 ? '+' : '−'}${Math.abs(moved)}`}
              </DText>
            </View>
          ) : null}
        </View>
        <View style={styles.sessionRow} testID="summary-session-line">
          <DText size={13} color={dx.ash} tabular testID="summary-rating-after">
            {t('dx.board.session_line', { from: o.ratingBefore, to: o.ratingAfter })}
          </DText>
          <DText size={13} weight={800} color={up ? eos.sage : eos.rose} tabular testID="summary-rating-delta">
            {`(${up ? '+' : '−'}${Math.abs(o.delta)})`}
          </DText>
        </View>
        <Bar value={o.guarded ? 0 : o.ratio} mark={o.guarded ? null : o.levelMark} style={styles.mt12} />
        <View style={styles.levelRow}>
          <DText size={12} color={dx.dust} tabular testID="summary-level">
            {t('summary.level', { level: o.level })}
          </DText>
          <DText size={12} color={o.guarded ? tone.gold : dx.dust} tabular testID="summary-level-next">
            {t(nextNote.key, nextNote.vars)}
          </DText>
        </View>
      </View>
    </Card>
  );
}

/** The XP this session earned (phone XpSummaryCard): the rank's piece, the level bar, total XP and the way to the next level. */
function XpCard({
  gained,
  after,
  rankBefore,
  t,
  lang,
}: {
  gained: number;
  after: NonNullable<FinishResponse['xp']>['after'];
  rankBefore: string;
  t: TFn;
  lang: 'en' | 'uk';
}) {
  const ratio = (after.xp - after.levelXp) / Math.max(1, after.nextLevelXp - after.levelXp);
  const rankUp = after.rank !== rankBefore;
  return (
    <Card style={[styles.xp, rankUp && styles.xpRankUp]} testID="summary-xp">
      <RankTile rank={after.rank} size={44} />
      <View style={styles.flex}>
        <Label size={10} color={rankUp ? tone.amberLight : dx.ash}>
          {`${rankUp ? t('xp.new_rank') : t('xp.label')} · ${t('xp.rank_level', { rank: t(`xp.rank.${after.rank}`), level: after.level })}`}
        </Label>
        <Bar value={ratio} colors={[dx.xpBarFrom, tone.gold]} style={styles.mt8} />
        <View style={styles.xpFoot}>
          <DText size={12} color={dx.dust} tabular testID="summary-xp-total">
            {t('xp.total', { n: fmtXp(after.xp, lang) })}
          </DText>
          <DText size={12} color={dx.dust} tabular testID="summary-xp-to-level">
            {t('xp.to_level', { n: fmtXp(after.nextLevelXp - after.xp, lang), level: after.level + 1 })}
          </DText>
        </View>
      </View>
      <DText size={14} weight={800} color={tone.gold} tabular testID="summary-xp-gain">
        {t('xp.gain', { n: gained })}
      </DText>
    </Card>
  );
}

type Filter = 'all' | 'bad';

function PuzzlesCard({
  detail,
  loading,
  puzzles,
  cols,
  t,
  lang,
}: {
  detail: SessionDetail | undefined;
  loading: boolean;
  puzzles: Map<string, ServerPuzzle>;
  /** Boards per row: the card is exactly that wide. */
  cols: number;
  t: TFn;
  lang: 'en' | 'uk';
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const pieceSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const all = (detail?.attempts ?? []).slice(0, MAX_BOARDS);
  const bad = all.filter((a) => !a.correct);
  const shown = filter === 'all' ? all : bad;
  return (
    <Card style={[styles.puzzles, { width: cols * CELL + (cols - 1) * 10 + 40 }]} testID="summary-puzzles">
      <View style={styles.puzzlesHead}>
        <Label>{t('dx.board.session_puzzles')}</Label>
        <View style={styles.flex} />
        <Seg
          small
          testID="summary-filter"
          accessibilityLabel={t('dx.board.session_puzzles')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('dx.board.all_n', { n: all.length }) },
            { value: 'bad', label: t('dx.board.mistakes_n', { n: bad.length }) },
          ]}
          style={styles.seg}
        />
      </View>
      <View style={styles.grid}>
        {shown.map((a) => {
          const pz = puzzles.get(a.puzzleId);
          const theme = pz ? tacticalThemes(pz.themes, 1)[0] : undefined;
          const name = theme ? `${themeLabel(theme, lang)} · ${a.puzzleRating}` : String(a.puzzleRating);
          return (
            <Hover
              key={a.id}
              testID={`summary-puzzle-${a.puzzleId}`}
              accessibilityLabel={`${name}, ${a.correct ? t('play.solved') : t('dx.board.mistakes')}`}
              onPress={() => router.push(`/puzzles/${encodeURIComponent(a.puzzleId)}` as Href)}
              style={styles.cell}
              hoverStyle={styles.cellHover}
            >
              {pz ? <MiniBoard puzzle={pz} size={MINI} pieceSet={pieceSet} /> : <View style={styles.miniEmpty} />}
              <View style={styles.cellRow}>
                <View style={[styles.mark, { backgroundColor: a.correct ? dx.dotOk : eos.ember }]}>
                  {a.correct ? <Check size={10} color={eos.bone} strokeWidth={3} /> : <X size={10} color={eos.bone} strokeWidth={3} />}
                </View>
                <DText size={12} weight={700} numberOfLines={2} style={styles.flex}>
                  {name}
                </DText>
              </View>
            </Hover>
          );
        })}
      </View>
      <DText size={12.5} color={dx.ash} align="center" style={styles.mt12}>
        {loading ? t('ui.loading') : shown.length ? t('dx.board.tap_puzzle') : t('dx.board.no_puzzles')}
      </DText>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  main: { flex: 1, minWidth: 0, gap: 14 },
  hero: { padding: 26, flexDirection: 'row', alignItems: 'center', gap: 22 },
  eye: { width: 84, height: 84 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' },
  delta: { height: 28, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center' },
  levelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sessionRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 },
  mt2: { marginTop: 2 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: 150, minWidth: 0 },
  xp: { paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  xpRankUp: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: alpha(tone.copper, 0.55), inset: true }] },
  xpFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  review: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 6 },
  puzzles: { paddingVertical: 18, paddingHorizontal: 20 },
  puzzlesHead: { flexDirection: 'row', alignItems: 'center' },
  seg: { width: 220 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  cell: {
    width: CELL,
    padding: 5,
    gap: 8,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  cellHover: { backgroundColor: dx.chipHover },
  miniEmpty: { width: MINI, height: MINI, borderRadius: 4, backgroundColor: dx.track },
  cellRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  mark: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

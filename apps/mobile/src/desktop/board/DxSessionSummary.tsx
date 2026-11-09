import type { SessionDetail } from '@tac/core/api';
import { normalizePieceSet } from '@tac/core/board';
import { fmtResponseTime } from '@tac/core/format';
import type { ServerPuzzle } from '@tac/core/puzzle';
import { LEVEL_GUARD_GAP, type TrainingStyle } from '@tac/core/rules';
import { levelFor, levelOutcomeOf, levelProgress, levelRankChangeOf, tacticalThemes, type FinishResponse, type LevelOutcome } from '@tac/core/runner';
import { themeLabel } from '@tac/core/themes';
import { alpha, eos, tone } from '@tac/core/tokens';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Check, RefreshCw, Star, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { feel, stopLongClip } from '@/feel';
import { RankTile } from '@/features/experience/XpCard';
import { bandIcon } from '@/features/play/setup/bandIcons';
import { CasualNote, EarlyExitNote, LevelDownCard, LevelGuardCard, LevelUpCard, StreakOutcomeChip } from '@/features/play/runner/outcomeCards';
import { RankCeremony } from '@/features/play/runner/RankCeremony';
import { puzzleApi, reviewKeys, sessionApi } from '@/features/review/api';
import { useAppStore } from '@/stores/appStore';
import { PlateButton } from '@/ui';
import { useLang, useT, type TFn } from '@/ui/lang';
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
  const mistakes = review.data?.items.length ?? 0;
  const goHome = () => router.dismissTo(HOME);
  const repeat = () => router.push(`/sessions/${sessionId}/review` as Href);

  useHotkeys({ ' ': () => !playAgainLoading && onPlayAgain() });

  const attempts = detail.data?.attempts ?? [];
  const puzzles = usePuzzles(attempts.slice(0, MAX_BOARDS).map((a) => a.puzzleId));
  const hardest = attempts.filter((a) => a.correct).sort((a, b) => b.puzzleRating - a.puzzleRating)[0];
  const hardestTheme = hardest ? tacticalThemes(puzzles.get(hardest.puzzleId)?.themes ?? [], 1)[0] : undefined;
  const total = summary.solved + summary.failed;

  // A rated finish without the level fields (an early exit, an older API):
  // the hero still shows the rating move, from the session record and the
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
            up: false,
            down: false,
            guarded: false,
            early: false,
          } as LevelOutcome;
        })()
      : null);

  const mode = t(sessionMode === 'mixed' ? 'dx.board.mode_mixed' : sessionMode === 'casual' ? 'dx.board.mode_casual' : 'dx.board.mode_theme');
  const subtitle = [mode, styleLabel, durationSec ? t('dx.board.minutes', { n: Math.round(durationSec / 60) }) : null].filter(Boolean).join(' · ');

  // The page beside the full sidebar: two columns from ~1100 px of content
  // (the artboard), the puzzles card two boards wide below that, stacked
  // under the summary on a 1024 px window.
  const avail = useRawWindow().width - dxSize.sidebar - dxSize.padX * 2;
  const cols = avail >= 1080 ? 3 : 2;
  const stacked = avail < 900;

  return (
    <DesktopPage title={t('play.session_complete')} subtitle={subtitle} testID="summary-screen" right={null}>
      <View style={[styles.cols, stacked && styles.stacked]}>
        <View style={styles.main}>
          {summary.streak ? <StreakOutcomeChip streak={summary.streak} t={t} /> : null}
          {shownOutcome ? <RatingCard o={shownOutcome} styleLabel={styleLabel} t={t} /> : null}
          {outcome?.early && <EarlyExitNote t={t} />}
          {outcome?.up && <LevelUpCard level={outcome.level} styleName={styleLabel.toLowerCase()} t={t} />}
          {outcome?.guarded && <LevelGuardCard level={outcome.level} under={outcome.level - outcome.ratingAfter} t={t} />}
          {outcome?.down && <LevelDownCard level={outcome.level} line={outcome.levelBefore - LEVEL_GUARD_GAP} t={t} />}
          {sessionMode === 'casual' && difficulty != null && <CasualNote difficulty={difficulty} t={t} />}

          <View style={styles.tiles}>
            <SumTile
              id="solved"
              label={t('play.solved')}
              value={total ? `${summary.solved} / ${total}` : String(summary.solved)}
              caption={t('dx.board.accuracy_n', { n: Math.round(summary.accuracy * 100) })}
            />
            <SumTile id="avg" label={t('dx.board.avg_time')} value={fmtResponseTime(summary.avgResponseMs)} />
            <SumTile id="peak" label={t('dx.board.session_peak')} value={String(summary.peakRating)} />
            <SumTile
              id="hardest"
              label={t('dx.board.hardest')}
              value={hardest ? String(hardest.puzzleRating) : '—'}
              caption={hardestTheme ? themeLabel(hardestTheme, lang) : undefined}
            />
          </View>

          {summary.xp ? <XpCard gained={summary.xp.gained} after={summary.xp.after} rankBefore={summary.xp.before.rank} t={t} /> : null}

          <View style={styles.actions}>
            <PlateButton
              testID="summary-play-again"
              label={playAgainLoading ? t('play.starting') : t('play.play_again')}
              loading={playAgainLoading}
              onPress={onPlayAgain}
              size="lg"
              block
              style={styles.flex}
            />
            {mistakes > 0 ? (
              <PlateButton
                testID="summary-review"
                label={t('dx.board.repeat_mistakes')}
                variant="slate"
                size="md"
                block
                icon={<RefreshCw size={16} color={eos.bone} strokeWidth={1.8} />}
                onPress={repeat}
                style={styles.repeat}
              />
            ) : null}
            <GhostButton testID="summary-home" label={t('dx.board.to_home')} accessibilityLabel={t('dx.board.to_home')} height={46} onPress={goHome} />
          </View>
        </View>

        {serverSummary ? (
          <PuzzlesCard detail={detail.data} loading={detail.isPending} puzzles={puzzles} cols={stacked ? 4 : cols} t={t} lang={lang} />
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

function SumTile({ id, label, value, caption }: { id: string; label: string; value: string; caption?: string }) {
  return (
    <Tile style={styles.tile}>
      <Label size={10}>{label}</Label>
      <DText size={26} weight={800} ls={-0.3} tabular style={styles.mt6} testID={`summary-${id}`}>
        {value}
      </DText>
      {caption ? (
        <DText size={12} color={dx.dust} numberOfLines={2}>
          {caption}
        </DText>
      ) : null}
    </Tile>
  );
}

/** DXSessionSummary hero: the band eye, the rating and its move, the way to the next mark. */
function RatingCard({ o, styleLabel, t }: { o: LevelOutcome; styleLabel: string; t: TFn }) {
  const up = o.delta >= 0;
  return (
    <Card texture style={styles.hero} testID="summary-rating">
      <Image source={bandIcon(o.ratingAfter)} style={styles.eye} contentFit="contain" transition={null} />
      <View style={styles.flex}>
        <Label>{t('play.your_rating', { style: styleLabel.toLowerCase() })}</Label>
        <View style={styles.heroRow}>
          <DText size={46} weight={800} ls={-0.3} tabular testID="summary-rating-after">
            {String(o.ratingAfter)}
          </DText>
          <View style={[styles.delta, { backgroundColor: alpha(up ? tone.sageDeep : eos.ember, 0.16) }]}>
            <DText size={13} weight={800} color={up ? eos.sage : eos.rose} tabular testID="summary-rating-delta">
              {`${up ? '+' : '−'}${Math.abs(o.delta)}`}
            </DText>
          </View>
          <DText size={13} color={dx.dust} tabular>
            {t('summary.rating_from', { rating: o.ratingBefore })}
          </DText>
        </View>
        <Bar value={o.guarded ? 0 : o.ratio} style={styles.mt12} />
        <View style={styles.levelRow}>
          <DText size={12} color={dx.dust} tabular testID="summary-level">
            {t('summary.level', { level: o.level })}
          </DText>
          <DText size={12} color={o.guarded ? tone.gold : dx.dust} tabular testID="summary-level-next">
            {o.guarded ? t('summary.protected', { n: 1, total: 2 }) : t('play.to_next', { n: o.toNext, next: o.next })}
          </DText>
        </View>
      </View>
    </Card>
  );
}

function XpCard({
  gained,
  after,
  rankBefore,
  t,
}: {
  gained: number;
  after: NonNullable<FinishResponse['xp']>['after'];
  rankBefore: string;
  t: TFn;
}) {
  const ratio = (after.xp - after.levelXp) / Math.max(1, after.nextLevelXp - after.levelXp);
  const rankUp = after.rank !== rankBefore;
  return (
    <Card style={styles.xp} testID="summary-xp">
      {rankUp ? <RankTile rank={after.rank} size={44} /> : (
        <View style={styles.xpTile}>
          <Star size={20} color={tone.gold} strokeWidth={1.8} />
        </View>
      )}
      <View style={styles.flex}>
        <Label size={10} color={rankUp ? tone.amberLight : dx.ash}>
          {`${rankUp ? t('xp.new_rank') : t('xp.label')} · ${t('xp.rank_level', { rank: t(`xp.rank.${after.rank}`), level: after.level })}`}
        </Label>
        <Bar value={ratio} colors={[dx.xpBarFrom, tone.gold]} style={styles.mt8} />
      </View>
      <DText size={14} weight={800} color={tone.gold} tabular>
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
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minWidth: 0 },
  xp: { paddingVertical: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  xpTile: { width: 44, height: 44, borderRadius: 11, backgroundColor: dx.xpTile, alignItems: 'center', justifyContent: 'center' },
  repeat: { flex: 1.6, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
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

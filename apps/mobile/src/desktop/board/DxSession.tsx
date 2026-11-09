import type { Progression } from '@tac/core/api';
import { LEVEL_GUARD_GAP, isTrainingStyle, paceTarget } from '@tac/core/rules';
import { levelFor, levelProgress, turnCardOf } from '@tac/core/runner';
import { alpha, eos, tone } from '@tac/core/tokens';
import { fmtDuration } from '@tac/core/format';
import { ArrowUpDown, Pause, Play, Sparkles, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Board, type BoardMove } from '@/board';
import { E2E, E2EStrip } from '@/features/play/runner/E2EStrip';
import { useRunnerScreen } from '@/features/play/runner/useRunnerScreen';
import { Countdown, type RunnerController } from '@/runner';
import { PlateButton } from '@/ui';
import { useT, type TFn } from '@/ui/lang';
import { useBlind } from '@/features/play/blind/director';
import { DxBlindPanel } from '../blind/DxBlindPanel';
import { Dialog } from '../Dialog';
import { Portal } from '../Portal';
import { useHotkeys } from '../hotkeys';
import { DText, GhostButton, Kbd, KeyHints, Label } from '../kit';
import { dx } from '../tokens';
import { Card2, ClockText, Dots, panelStyles, SmallTile, Spacer, StreakChip, TurnCard, type Mark } from './parts';
import { BoardStage } from './Stage';
import { DxSessionSummary } from './DxSessionSummary';

// /play/[id] on a desktop-wide window (canvas DXSession, DXSessionSelected,
// DXSessionWrong, DXSessionPaused, DXSessionExit): the board left, the
// runner panel right, keyboard shortcuts. The runner, exit guard and
// summary data are the phone screen's (useRunnerScreen); the summary
// swaps the compact rail for the full sidebar (DXSessionSummary).

const fixed = { position: 'fixed' } as unknown as ViewStyle;

type Wrong = { puzzleId: string; san: string | null; base: number | null };

export function DxSession({ sessionId, finishOnStart = false }: { sessionId: string; finishOnStart?: boolean }) {
  const t = useT();
  const m = useRunnerScreen(sessionId, finishOnStart);
  const { controller, view, s, result } = m;

  if (result?.kind === 'summary') {
    return (
      <DxSessionSummary
        summary={result.summary}
        serverSummary={result.source === 'server'}
        sessionMode={s.sessionMode}
        style={s.style}
        durationSec={s.durationSec}
        difficulty={s.sessionMode === 'mixed' ? null : s.sessionStartRating}
        onPlayAgain={() => void m.playAgain()}
        playAgainLoading={m.againLoading}
      />
    );
  }
  return <Runner m={m} controller={controller} view={view} t={t} />;
}

type Model = ReturnType<typeof useRunnerScreen>;

function Runner({ m, controller, view, t }: { m: Model; controller: RunnerController; view: Model['view']; t: TFn }) {
  const { s, storeRating, storeProg, pieceSet, mirror, boardRef, onMove } = m;
  const [flipped, setFlipped] = useState(false);
  const blind = useBlind(s.sessionId, controller);
  const peek = () => blind.director?.peekStart(false);

  // The move the player made last (the wrong card names it): one state
  // write per move, on the screen (never the board).
  const [lastSan, setLastSan] = useState<string | null>(null);
  const [tracked] = useState(() => (mv: BoardMove) => {
    setLastSan(mv.san);
    return onMove(mv);
  });

  const unrated = s.sessionMode !== 'mixed';
  // The session's live difficulty (D39: a rated session starts at the level and moves with each puzzle).
  const rating = unrated ? s.sessionStartRating : (storeRating ?? s.rating);

  // Session dots: the results in the order they came (a restored session
  // starts from its counters). A new miss turns the turn card into the
  // error card; it stays through the next puzzle's setup slide, until that
  // turn starts. Both are derived while rendering (no effect round-trip).
  const { solved, failed } = s.counters;
  const [hist, setHist] = useState(() => ({ solved, failed, marks: [...Array<Mark>(solved).fill('ok'), ...Array<Mark>(failed).fill('bad')] }));
  const [wrong, setWrong] = useState<Wrong | null>(null);
  if (hist.solved !== solved || hist.failed !== failed) {
    const marks = [...hist.marks];
    for (let i = hist.solved; i < solved; i++) marks.push('ok');
    for (let i = hist.failed; i < failed; i++) marks.push('bad');
    setHist({ solved, failed, marks });
    if (failed > hist.failed && s.puzzle) setWrong({ puzzleId: s.puzzle.id, san: lastSan, base: rating });
  }
  if (wrong && s.phase === 'playerTurn' && s.puzzle?.id !== wrong.puzzleId) setWrong(null);
  const wrongNow = wrong;

  const card = turnCardOf(s);
  const resolved = s.phase === 'resolving' || s.phase === 'loadingNext';
  const booting = s.phase === 'booting';
  const marks: Mark[] = booting || resolved ? hist.marks : [...hist.marks, 'now'];
  const puzzleNo = hist.marks.length + (resolved ? 0 : 1);

  const pause = () => {
    if (!booting && !s.paused) controller.dispatch({ type: 'pause', source: 'user' });
  };
  const resume = () => controller.dispatch({ type: 'resume', source: 'user' });
  const flip = () => setFlipped((f) => !f);

  useHotkeys(
    {
      f: () => !s.paused && flip(),
      Escape: () => (s.paused ? resume() : pause()),
      ' ': () => (s.paused ? resume() : peek()),
      b: () => !s.paused && peek(),
    },
    !view.exitOpen && s.phase !== 'finishing',
  );

  const title = card.loading
    ? t('play.loading_puzzle')
    : card.opponentMoving
      ? t('play.opponent_moving')
      : t(s.playerColor === 'w' ? 'dx.board.white_moves' : 'dx.board.black_moves');
  const sub = card.loading || card.opponentMoving ? null : t('dx.board.find_best');
  const pill = s.puzzle ? t('dx.board.puzzle_pill', { n: puzzleNo, rating: s.puzzle.rating }) : null;

  const panel = (
    <>
      <View style={panelStyles.row}>
        <GhostButton testID="runner-exit" label={t('play.exit')} accessibilityLabel={t('play.exit')} icon={X} onPress={() => controller.dispatch({ type: 'requestExit' })} />
        <View style={styles.center}>
          <Countdown
            controller={controller}
            accessibilityLabel={t('play.timer')}
            render={({ text, warn, paused }) => <ClockText text={text} color={warn ? eos.rose : paused ? eos.ash : eos.bone} testID="runner-timer" />}
          />
        </View>
        <GhostButton
          testID="runner-pause"
          accessibilityLabel={s.paused ? t('play.resume') : t('play.pause')}
          icon={s.paused ? Play : Pause}
          square
          disabled={booting}
          onPress={() => (s.paused ? resume() : pause())}
        />
      </View>
      <TimeBar controller={controller} />

      {wrongNow ? (
        <WrongCard
          san={wrongNow.san}
          delta={!unrated && wrongNow.base != null && rating != null ? rating - wrongNow.base : 0}
          streakBroken={card.streakBroken}
          t={t}
        />
      ) : (
        <TurnCard side={s.playerColor} title={title} sub={sub} pill={pill} streak={card.streak} streakBroken={card.streakBroken} />
      )}
      {blind.view && blind.director ? <DxBlindPanel view={blind.view} director={blind.director} /> : null}
      <ProgressCard s={s} prog={storeProg} t={t} />

      <View style={panelStyles.grid3}>
        <SmallTile label={t('play.solved')} value={String(solved)} color={eos.sage} testID="dx-runner-solved" />
        <SmallTile label={t('dx.board.mistakes')} value={String(failed)} color={tone.roseSoft} testID="dx-runner-failed" />
        <SmallTile
          label={s.sessionMode === 'theme' ? t('play.drill') : s.sessionMode === 'casual' ? t('play.puzzles') : t('play.difficulty')}
          value={rating != null ? String(rating) : '—'}
          testID="dx-runner-rating"
        />
      </View>

      <View>
        <Label size={10} style={styles.mb10}>
          {t('dx.board.session_puzzles')}
        </Label>
        <Dots marks={marks} label={t('dx.board.dots_a11y', { solved, failed })} testID="dx-runner-dots" />
      </View>

      <Spacer />
      {E2E && <E2EStrip controller={controller} view={view} />}
      <GhostButton testID="dx-runner-flip" label={t('dx.board.flip')} accessibilityLabel={t('dx.board.flip')} icon={ArrowUpDown} height={46} onPress={flip} />
      <KeyHints
        items={[
          { keys: ['F'], label: t('dx.board.key.flip') },
          { keys: ['Esc'], label: t('dx.board.key.pause') },
          ...(blind.view ? [{ keys: ['B'], label: t('blind.key.peek_short') }] : []),
        ]}
        style={styles.hints}
      />
    </>
  );

  return (
    <View style={styles.root}>
      <BoardStage
        testID="dx-session"
        board={() => (
          <>
            <Board
              ref={boardRef}
              onMove={tracked}
              moveFeel="caller"
              pieceSet={pieceSet}
              orientation={s.orientation}
              mirror={mirror !== flipped}
              piecesHidden={blind.view?.hidden ?? false}
              style={styles.board}
            />
            {card.loading && (
              <View style={styles.spinner} pointerEvents="none">
                <ActivityIndicator color={eos.ember} size="large" />
              </View>
            )}
          </>
        )}
        panel={panel}
      />

      {s.paused && (
        <Portal>
          <PauseVeil restored={view.restored} remainingMs={controller.remainingMs()} onResume={resume} t={t} />
        </Portal>
      )}
      {view.exitOpen && (
        <Dialog onClose={controller.closeExit} width={460} testID="exit-sheet" style={styles.exitCard}>
          <DText serif weight={700} size={24}>
            {t('play.exit_title')}
          </DText>
          <DText size={14} lh={21} color={dx.ash} style={styles.mt10}>
            {t('play.exit_dialog_hint')}
          </DText>
          <View style={[panelStyles.row, styles.mt22]}>
            <PlateButton
              testID="exit-save"
              label={t('play.exit_save')}
              size="md"
              block
              style={styles.save}
              onPress={() => {
                controller.closeExit();
                controller.dispatch({ type: 'finish', save: true });
              }}
            />
            <GhostButton
              testID="exit-discard"
              label={t('play.exit_discard')}
              accessibilityLabel={t('play.exit_discard')}
              danger
              height={44}
              style={styles.flex}
              onPress={() => {
                controller.closeExit();
                controller.dispatch({ type: 'finish', save: false });
              }}
            />
            <GhostButton testID="exit-keep" label={t('play.exit_keep')} accessibilityLabel={t('play.exit_keep')} height={44} style={styles.flex} onPress={controller.closeExit} />
          </View>
        </Dialog>
      )}
      {s.phase === 'finishing' && (
        <Portal>
          <View style={styles.finishing} pointerEvents="auto">
            <ActivityIndicator color={eos.ember} size="large" />
          </View>
        </Portal>
      )}
    </View>
  );
}

/** DXSessionWrong: the miss, where it went, and what it cost. */
function WrongCard({ san, delta, streakBroken, t }: { san: string | null; delta: number; streakBroken: number | null; t: TFn }) {
  return (
    <View style={styles.wrong} testID="dx-runner-wrong">
      <View style={styles.wrongDisc}>
        <X size={14} color={eos.bone} strokeWidth={2.4} />
      </View>
      <View style={styles.flex}>
        <DText size={15} weight={800} numberOfLines={1}>
          {san ? t('dx.board.wrong_san', { san }) : t('dx.board.wrong')}
        </DText>
        <DText size={12.5} color={dx.ash} numberOfLines={1}>
          {delta < 0 ? `${t('dx.board.wrong_review')} · ${t('dx.board.wrong_difficulty', { n: `−${Math.abs(delta)}` })}` : t('dx.board.wrong_review')}
        </DText>
      </View>
      {/* The miss broke a streak: the chip shows it crossed out while the runner holds it. */}
      {streakBroken != null ? <StreakChip key={`broken-${streakBroken}`} n={streakBroken} broken /> : null}
    </View>
  );
}

/** The way to the next level (rated), the casual note, nothing for a theme drill. */
function ProgressCard({ s, prog, t }: { s: Model['s']; prog: Progression | null; t: TFn }) {
  if (!prog || !s.style || s.phase === 'booting' || s.sessionMode === 'theme') return null;
  // In a session the stored rating is the session's live difficulty; the level stays put until the finish.
  const rating = prog.currentPuzzleRating;
  const level = levelFor(prog);
  if (s.sessionMode === 'casual') {
    const difficulty = s.sessionStartRating ?? rating;
    return (
      <Card2 testID="runner-casual-bar">
        <View style={panelStyles.row}>
          <Label size={10}>{t('dx.board.casual_bar')}</Label>
          <Spacer />
          <DText size={12} weight={700} color={dx.dust} tabular>
            {t('casual.puzzles', { rating: difficulty })}
          </DText>
        </View>
        <DText size={12} color={dx.dust} style={styles.mt8}>
          {t('dx.board.casual_note', { level })}
        </DText>
      </Card2>
    );
  }
  const p = levelProgress(rating, level);
  const ready = rating >= p.next;
  const below = rating < level - LEVEL_GUARD_GAP;
  // D37: a level-up also needs the style's pace of solves.
  const pace = isTrainingStyle(s.style) && s.durationSec > 0 ? { solved: s.counters.solved, target: paceTarget(s.style, s.durationSec) } : null;
  const paceMet = !pace || pace.solved >= pace.target;
  const note = ready
    ? paceMet
      ? t('dx.board.level_ready', { rating, next: p.next })
      : t('dx.board.level_ready_pace', { rating, next: p.next, n: pace ? pace.target - pace.solved : 0 })
    : below
      ? t('dx.board.level_below', { rating, line: level - LEVEL_GUARD_GAP })
      : t('dx.board.level_note', { rating, n: p.toNext, next: p.next });
  return (
    <Card2 testID="runner-level-bar" style={ready ? styles.levelReady : undefined}>
      <View style={panelStyles.row}>
        {ready ? <Sparkles size={12} color={eos.ember} /> : null}
        <Label size={10}>{ready ? t('level.in_reach', { next: p.next }) : t('level.next')}</Label>
        <Spacer />
        <DText size={12} weight={700} color={ready ? eos.rose : dx.dust} tabular>
          {`${level} → ${p.next}`}
        </DText>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${(ready ? 1 : p.ratio) * 100}%` }]} />
        {!ready && p.levelMark != null ? <View style={[styles.barMark, { left: `${p.levelMark * 100}%` }]} /> : null}
      </View>
      {pace ? (
        <View style={[panelStyles.row, styles.mt8]} testID="runner-pace">
          <Label size={10}>{t('level.pace')}</Label>
          <View style={[styles.bar, styles.paceBar]}>
            <View style={[styles.barFill, { width: `${Math.min(1, pace.solved / Math.max(1, pace.target)) * 100}%` }, !paceMet && styles.paceFill]} />
          </View>
          <DText size={12} weight={700} color={paceMet ? eos.rose : dx.ash} tabular testID="runner-pace-count">
            {`${pace.solved} / ${pace.target}`}
          </DText>
        </View>
      ) : null}
      <DText size={12} color={dx.dust} style={styles.mt8} numberOfLines={2} testID="runner-level-note">
        {note}
      </DText>
    </Card2>
  );
}

/**
 * The thin session-time bar under the top row: drained on the UI thread
 * (a linear timing to the end), re-aimed only when the clock pauses,
 * resumes or starts. No React render on the tick.
 */
function TimeBar({ controller }: { controller: RunnerController }) {
  const frac = useSharedValue(0);
  useEffect(() => {
    let key = '';
    const sync = () => {
      const s = controller.state;
      const total = s.durationSec * 1000;
      const next = `${s.paused}:${s.endsAt}:${total}`;
      if (next === key) return;
      key = next;
      if (!total) {
        frac.set(0);
        return;
      }
      const left = controller.remainingMs();
      const done = Math.min(1, Math.max(0, 1 - left / total));
      cancelAnimation(frac);
      frac.set(done);
      if (!s.paused && s.endsAt != null && left > 0) frac.set(withTiming(1, { duration: left, easing: Easing.linear }));
    };
    sync();
    return controller.subscribe(sync);
  }, [controller, frac]);
  const fill = useAnimatedStyle(() => ({ width: `${frac.get() * 100}%` }));
  return (
    <View style={styles.timeTrack}>
      <Animated.View style={[styles.timeFill, fill]} />
    </View>
  );
}

/** DXSessionPaused: the board hidden under a blurred veil, the frozen time, resume. */
function PauseVeil({ remainingMs, onResume, restored, t }: { remainingMs: number; onResume: () => void; restored: boolean; t: TFn }) {
  return (
    <View style={styles.veil} testID="pause-overlay">
      <View style={styles.veilScrim} />
      <View style={styles.veilBody}>
        <DText size={72} weight={800} ls={-0.3} tabular testID="pause-remaining">
          {fmtDuration(Math.max(0, Math.ceil(remainingMs / 1000)))}
        </DText>
        <DText serif weight={700} size={26} style={styles.mt4}>
          {t('play.paused')}
        </DText>
        <DText size={14.5} color={dx.ash} align="center" style={styles.mt8} testID={restored ? 'pause-restored' : undefined}>
          {restored ? t('play.restored') : t('play.paused_hint')}
        </DText>
        <PlateButton testID="runner-resume" label={t('play.resume')} onPress={onResume} size="lg" style={styles.resume} />
        <View style={styles.or}>
          <Kbd>Space</Kbd>
          <DText size={12} color={dx.dust}>
            {t('dx.board.or')}
          </DText>
          <Kbd>Esc</Kbd>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center' },
  mb10: { marginBottom: 10 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt22: { marginTop: 22 },
  board: { flex: 1, alignSelf: 'stretch' },
  spinner: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  hints: { gap: 14 },
  timeTrack: { height: 4, borderRadius: 999, backgroundColor: dx.track, overflow: 'hidden' },
  timeFill: { height: '100%', borderRadius: 999, backgroundColor: eos.ash },
  bar: { height: 6, borderRadius: 999, backgroundColor: dx.track, overflow: 'hidden', marginTop: 10 },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: dx.barTo },
  barMark: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: eos.bone },
  paceBar: { flex: 1, marginTop: 0, marginHorizontal: 10 },
  paceFill: { backgroundColor: dx.sage },
  levelReady: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.ember, 0.6), inset: true }] },
  wrong: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: alpha(eos.ember, 0.16),
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: alpha(tone.emberGlow, 0.6), inset: true }],
  },
  wrongDisc: { width: 28, height: 28, borderRadius: 14, backgroundColor: eos.ember, alignItems: 'center', justifyContent: 'center' },
  exitCard: { padding: 28 },
  save: { flex: 1.4 },
  veil: { ...fixed, top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, alignItems: 'center', justifyContent: 'center' } as ViewStyle,
  veilScrim: { ...StyleSheet.absoluteFill, backgroundColor: dx.pauseScrim, backdropFilter: 'blur(10px)' } as ViewStyle,
  veilBody: { alignItems: 'center', maxWidth: 520, paddingHorizontal: 24 },
  resume: { minWidth: 260, marginTop: 26, alignSelf: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  finishing: { ...fixed, top: 0, left: 0, right: 0, bottom: 0, zIndex: 31, alignItems: 'center', justifyContent: 'center' } as ViewStyle,
});

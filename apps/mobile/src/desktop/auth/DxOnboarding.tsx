import { BAND_ICON_KEY, DIFFICULTY_BANDS, type BandKey } from '@tac/core/rules';
import { alpha, eos, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { FLAME_PATH } from '@/features/home/StreakSheet';
import { Rise } from '@/features/onboarding/parts';
import { ONBOARDING_LAST, ONBOARDING_STEPS, START_RATING, useOnboardingFlow } from '@/features/onboarding/useOnboardingFlow';
import { WelcomeArt } from '@/features/onboarding/Welcome';
import { BAND_ICONS } from '@/features/play/setup/bandIcons';
import { useRawWindow } from '@/platform/webFrame';
import { TintIcon } from '@/ui/IconTile';
import { useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { useHotkeys } from '../hotkeys';
import { Card, DText, Kbd, Label, Pill, TextButton, Title } from '../kit';
import { dx } from '../tokens';
import { MiniPuzzle, type MiniPuzzleState } from './MiniPuzzle';
import { Wordmark } from './Wordmark';

const REVIEW = require('../../../assets/icons/nav-review-book.webp');

/**
 * DXOnb1–4 over the app's four onboarding steps (useOnboardingFlow, the
 * phone screen's flow): Welcome → The training → Your path → The habit.
 * The copy is the app's (the artboards' "12-puzzle placement test" does not
 * exist: "Find my level" opens Play, where calibration happens); step 2's
 * board is a playable mate in one; step 4's card shows the app's habit
 * sample (streak week + "missed puzzles come back") instead of the
 * artboard's reminder toggle (no reminders on the web). Enter / → next,
 * ← back.
 */
export function DxOnboarding() {
  const t = useT();
  const flow = useOnboardingFlow();
  const { step, id, goTo, finish, veteran, recalState, onRecalibrate } = flow;
  const last = step === ONBOARDING_LAST;
  const [artW, setArtW] = useState(0);
  const { height } = useRawWindow();
  // Step 2's puzzle: its state feeds the card on the left; "Again" bumps the round (a fresh board).
  const [puzzle, setPuzzle] = useState<Puzzle>({ state: { kind: 'idle' }, round: 0 });
  const onPuzzle = (state: MiniPuzzleState) => setPuzzle((p) => ({ ...p, state }));
  const againPuzzle = () => setPuzzle((p) => ({ state: { kind: 'idle' }, round: p.round + 1 }));
  // Leaving or re-entering step 2 starts its puzzle afresh.
  const go = (i: number) => {
    againPuzzle();
    goTo(i);
  };

  const primary = () => {
    if (!last) go(step + 1);
    else if (veteran) void onRecalibrate();
    else finish('play');
  };
  useHotkeys({
    Enter: primary,
    ArrowRight: () => (last ? undefined : go(step + 1)),
    ArrowLeft: () => (step > 0 ? go(step - 1) : undefined),
  });

  const onArt = (e: LayoutChangeEvent) => setArtW(Math.round(e.nativeEvent.layout.width));
  const copy =
    id === 'welcome'
      ? { kicker: t('brand.name'), title: t('onboarding.welcome.title'), body: t('onboarding.welcome.body') }
      : { kicker: t(`onboarding.${id}.kicker`), title: t(`onboarding.${id}.title`), body: t(`onboarding.${id}.body`) };

  return (
    <View style={styles.root} testID="screen-onboarding">
      <View style={styles.header}>
        <Wordmark logo={30} size={17} gap={14} />
        <View style={styles.flex} />
        <View
          style={styles.dashes}
          testID="onboarding-step"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('onboarding.step', { n: step + 1, total: ONBOARDING_STEPS.length })}
          accessibilityValue={{ min: 1, max: ONBOARDING_STEPS.length, now: step + 1 }}
        >
          {ONBOARDING_STEPS.map((s, i) => (
            <View key={s} style={[styles.dash, i === step && styles.dashOn, i <= step && styles.dashLit]} />
          ))}
        </View>
        <View style={styles.flex} />
        <TextButton testID="screen-onboarding-close" accessibilityLabel={t('onboarding.skip')} label={t('onboarding.skip')} onPress={() => finish('close')} />
      </View>
      {/* key: a fresh mount per step replays the entrance. */}
      <View key={id} style={styles.body} testID={`onboarding-slide-${id}`}>
        <View style={styles.col}>
          <View style={styles.copy}>
            <Rise index={0}>
              <Label color={dx.rose}>{copy.kicker}</Label>
            </Rise>
            <Rise index={1}>
              <Title size={40} style={styles.title}>
                {copy.title}
              </Title>
            </Rise>
            <Rise index={2}>
              <DText size={16} lh={26} color={dx.ash} style={styles.lede}>
                {copy.body}
              </DText>
            </Rise>
            {id === 'training' ? <TrainingCard state={puzzle.state} onAgain={againPuzzle} /> : null}
            {last ? (
              <Rise index={2}>
                {veteran ? (
                  <DText size={14} lh={21} color={recalState === 'error' ? tone.danger : dx.dust} style={styles.note} testID="onboarding-recalibrate-note">
                    {t(recalState === 'error' ? 'onboarding.recalibrate_error' : 'onboarding.recalibrate_note')}
                  </DText>
                ) : null}
                <TextButton
                  testID={veteran ? 'onboarding-keep-level' : 'onboarding-skip'}
                  accessibilityLabel={veteran ? t('onboarding.keep_level') : t('onboarding.skip_start', { rating: START_RATING })}
                  label={veteran ? t('onboarding.keep_level') : t('onboarding.skip_start', { rating: START_RATING })}
                  size={14}
                  underline
                  onPress={() => finish('home')}
                  style={styles.skipStart}
                />
              </Rise>
            ) : null}
            <Rise index={3} style={styles.cta}>
              <PlateButton
                testID={!last ? 'onboarding-next' : veteran ? 'onboarding-recalibrate' : 'onboarding-done'}
                label={
                  !last ? (step === 0 ? t('onboarding.begin') : t('onboarding.continue')) : veteran ? t('onboarding.recalibrate') : t('onboarding.find_level')
                }
                onPress={primary}
                loading={last && veteran && recalState === 'busy'}
                pressFeel={last ? 'toggle' : undefined}
                size="lg"
                style={styles.plate}
              />
              <View style={styles.hint}>
                <Kbd>Enter</Kbd>
                <DText size={12.5} color={dx.dust}>
                  {t('dx.auth.onb.next_hint')}
                </DText>
              </View>
            </Rise>
          </View>
        </View>
        <View style={[styles.col, styles.art]} onLayout={onArt}>
          {artW > 0 ? <Art id={id} width={artW} height={height} puzzle={puzzle} onPuzzle={onPuzzle} /> : null}
        </View>
      </View>
    </View>
  );
}

// ── Step 2: the task card (left) and the playable board (right) ──────────

type Puzzle = { state: MiniPuzzleState; round: number };

function TrainingCard({ state, onAgain }: { state: MiniPuzzleState; onAgain: () => void }) {
  const t = useT();
  const pill =
    state.kind === 'solved'
      ? { label: t('dx.auth.onb.solved', { s: state.seconds }), tone: 'sage' as const }
      : state.kind === 'wrong'
        ? { label: t('dx.auth.onb.wrong'), tone: 'rose' as const }
        : { label: t('dx.auth.onb.try'), tone: 'sage' as const };
  return (
    <Rise index={2}>
      <View style={styles.task} testID="onboarding-task">
        <View style={styles.whiteSq} />
        <DText size={14} style={styles.flex}>
          {t('dx.auth.onb.task')}
        </DText>
        {state.kind === 'solved' ? (
          <TextButton
            testID="onboarding-puzzle-again"
            accessibilityLabel={t('dx.auth.onb.again')}
            label={t('dx.auth.onb.again')}
            size={12.5}
            onPress={onAgain}
            style={styles.again}
          />
        ) : null}
        <Pill label={pill.label} tone={pill.tone} style={styles.pill} />
      </View>
    </Rise>
  );
}

// ── The right column ──────────────────────────────────────────────────────

function Art({
  id,
  width,
  height,
  puzzle,
  onPuzzle,
}: {
  id: (typeof ONBOARDING_STEPS)[number];
  width: number;
  height: number;
  puzzle: Puzzle;
  onPuzzle: (s: MiniPuzzleState) => void;
}) {
  const t = useT();
  if (id === 'welcome') {
    const k = Math.min(1.5, width / 280);
    return (
      <Rise index={1}>
        <View style={{ width: 280 * k, height: 280 * k, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ transform: [{ scale: k }] }}>
            <WelcomeArt />
          </View>
        </View>
      </Rise>
    );
  }
  if (id === 'training') {
    const size = Math.floor(Math.max(240, Math.min(480, width, height - 76 - 120)));
    return (
      <Rise index={1}>
        <MiniPuzzle key={puzzle.round} size={size} label={t('dx.auth.onb.task')} onState={onPuzzle} />
      </Rise>
    );
  }
  if (id === 'path') return <RankRow width={width} />;
  return <HabitCard width={width} />;
}

const EYE_SIZES = [72, 96, 120, 96, 72] as const;
const EYE_OPACITY = [1, 1, 1, 0.45, 0.35] as const;
const ROW_W = EYE_SIZES.reduce((a, b) => a + b, 0) + 4 * 22 + 40;

/**
 * DXOnb3: the five rank eyes with the rating each band starts at. On a
 * narrow column the eyes and gaps shrink; the names keep a readable size.
 */
function RankRow({ width }: { width: number }) {
  const t = useT();
  const k = Math.max(0.6, Math.min(1, width / ROW_W));
  return (
    <Rise index={1}>
      <View style={[styles.eyes, { gap: 22 * k }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {DIFFICULTY_BANDS.map((b, i) => (
          <View key={b.key} style={[styles.eyeCol, { opacity: EYE_OPACITY[i] }]}>
            <Image source={BAND_ICONS[BAND_ICON_KEY[b.key]]} style={{ width: EYE_SIZES[i] * k, height: EYE_SIZES[i] * k }} contentFit="contain" />
            {/* The phone's rank path marks Intermediate as "you". */}
            <DText size={k < 1 ? 12 : 13} weight={700} numberOfLines={1} color={b.key === 'intermediate' ? tone.rose : undefined}>
              {b.key === 'intermediate' ? t('onboarding.path.you', { level: t('levels.intermediate') }) : t(`levels.${b.key satisfies BandKey}`)}
            </DText>
            <DText size={11.5} color={dx.dust} tabular>
              {String(b.min)}
            </DText>
          </View>
        ))}
      </View>
    </Rise>
  );
}

type DayKind = 'done' | 'freeze' | 'today' | 'empty';
// The phone habit step's sample week: a frozen Wednesday, today open.
const WEEK: readonly DayKind[] = ['done', 'done', 'freeze', 'done', 'today', 'empty', 'empty'];
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';
const SNOW = 'M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5';

/** DXOnb4's card: the app's sample streak week and the review reminder row. */
function HabitCard({ width }: { width: number }) {
  const t = useT();
  const days = t('dx.auth.onb.weekdays').split(',');
  const cardW = Math.min(width, 470);
  const disc = Math.max(30, Math.min(40, Math.floor((cardW - 56 - 60) / 7)));
  return (
    <Rise index={1} style={{ width: cardW }}>
      <Card texture style={styles.habit} testID="onboarding-habit-card">
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Label>{t('dx.auth.onb.habit')}</Label>
          <View style={styles.streakRow}>
            <Svg width={54} height={54} viewBox="0 0 24 24">
              <Path d={FLAME_PATH} fill={dx.gold} fillRule="evenodd" />
            </Svg>
            <View>
              <DText size={40} weight={800} ls={-0.3} tabular>
                {t('dx.auth.onb.streak_value')}
              </DText>
              <DText size={14} color={dx.ash}>
                {t('dx.auth.onb.streak_caption')}
              </DText>
              <DText size={13} color={dx.dust} style={styles.best}>
                {t('onboarding.habit.best')}
              </DText>
            </View>
          </View>
          <View style={styles.week}>
            {WEEK.map((kind, i) => (
              <View key={i} style={styles.day}>
                <DText size={11} color={dx.dust}>
                  {days[i] ?? ''}
                </DText>
                <View style={[styles.disc, { width: disc, height: disc }, discStyle[kind]]}>
                  {kind === 'done' ? (
                    <Glyph d={CHECK} color={dx.segOnText} />
                  ) : kind === 'freeze' ? (
                    <Glyph d={SNOW} color={tone.sky} />
                  ) : null}
                </View>
              </View>
            ))}
          </View>
          <View style={styles.freeze}>
            <Glyph d={SNOW} color={tone.sky} size={13} />
            <DText size={12.5} color={tone.sky}>
              {t('onboarding.habit.freeze_note')}
            </DText>
          </View>
          <View style={styles.reviewRow}>
            <TintIcon source={REVIEW} size={18} width={20} color={dx.rose} />
            <View style={styles.flex}>
              <DText size={14} weight={600}>
                {t('onboarding.habit.review_title')}
              </DText>
              <DText size={12.5} color={dx.ash}>
                {t('onboarding.habit.review_body')}
              </DText>
            </View>
            <Pill label={t('onboarding.habit.review_count')} tone="rose" style={styles.pill} />
          </View>
        </View>
      </Card>
    </Rise>
  );
}

function Glyph({ d, color, size = 16 }: { d: string; color: string; size?: number }): ReactNode {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const ring = (c: string, w = 1) => ({ boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: w, color: c, inset: true }] });

const discStyle = StyleSheet.create({
  done: { backgroundColor: dx.ember, ...ring(dx.barTo) },
  freeze: { backgroundColor: tone.skyDeep, ...ring(alpha(tone.sky, 0.45)) },
  today: { backgroundColor: dx.card2, ...ring(dx.ember, 1.5) },
  empty: { backgroundColor: dx.card2, ...ring(dx.kbdEdge) },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1 },
  header: { height: 76, paddingHorizontal: 48, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dashes: { flexDirection: 'row', gap: 6 },
  dash: { width: 18, height: 4, borderRadius: 3, backgroundColor: dx.barOff },
  dashOn: { width: 36 },
  dashLit: { backgroundColor: dx.barTo },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 64, paddingHorizontal: 96, paddingBottom: 40 },
  col: { flex: 1, minWidth: 0 },
  copy: { maxWidth: 470 },
  art: { alignItems: 'center', justifyContent: 'center' },
  title: { lineHeight: 48, marginTop: 12 },
  lede: { marginTop: 16 },
  note: { marginTop: 18 },
  skipStart: { alignSelf: 'flex-start', marginTop: 12, marginLeft: -10 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 36 },
  plate: { minWidth: 240 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  task: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  whiteSq: { width: 14, height: 14, borderRadius: 3, backgroundColor: eos.bone },
  again: { height: 24 },
  pill: { alignSelf: 'center' },
  eyes: { flexDirection: 'row', alignItems: 'flex-end', gap: 22 },
  eyeCol: { alignItems: 'center', gap: 10 },
  best: { marginTop: 2 },
  habit: { padding: 28 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  day: { alignItems: 'center', gap: 6 },
  disc: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  freeze: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  reviewRow: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
});

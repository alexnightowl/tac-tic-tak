import { WOODPECKER_FIRST_CYCLE_DAYS, WOODPECKER_MIN_SET } from '@tac/core/library';
import { alpha, eos, graphite, layout, radii, semantic, space, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Archive, Check, ChevronLeft, CircleHelp, Flag, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toast } from '@/shell/toast/store';
import { AppText, confirm, PlateButton, ProgressBar, Tap } from '@/ui';
import { useLang, useT, useTn } from '@/ui/lang';
import { AboutSheet, HOW_STEPS } from './About';
import { useArchiveSet, useCloseFirstCycle } from './api';
import { CycleChart } from './CycleChart';
import { useStartMethod } from './create';
import { ctaLabel, cycleToSolve, daysText, deadlineLine, openSolve, restLine, restResult, setLine, useActiveSet, type SetView } from './model';

// /woodpecker (D41, no artboard; built like the book page LibBook): the
// method's phase as the hero card (first cycle, a cycle against its
// deadline, rest, complete), today's portion, the cycles chart, and the
// docked main button. Without a set: the method and Start. Starting a
// new set over the active one asks first.

const DOCK_H = layout.plateHeight.lg + space[6] + space[8];

export function WoodpeckerScreen({ setId }: { setId?: string }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { view, summary, loading, error, retry } = useActiveSet(setId);
  const [about, setAbout] = useState(false);
  const start = useStartMethod(view?.set.id ?? null, (set) => router.setParams({ set: set.id }));

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/play' as Href);
  };
  const askNew = () =>
    confirm({
      title: t('woodpecker.new_title'),
      body: t('woodpecker.new_body'),
      confirmLabel: t('woodpecker.new_set'),
      cancelLabel: t('woodpecker.cancel'),
      testID: 'woodpecker-new',
      onConfirm: start.start,
    });

  let body: ReactNode;
  if (loading) body = <ActivityIndicator color={eos.ash} style={styles.loading} />;
  else if (error && !view)
    body = (
      <View style={styles.errorBox}>
        <AppText variant="body" color={eos.ash} style={styles.centerText}>
          {t('woodpecker.load_failed')}
        </AppText>
        <PlateButton testID="woodpecker-retry" label={t('woodpecker.retry')} variant="slate" size="sm" onPress={retry} />
      </View>
    );
  else if (!summary || !view) body = <Intro levelLine={start.levelLine} failed={start.failed} onAbout={() => setAbout(true)} />;
  else body = <SetBody view={view} onAbout={() => setAbout(true)} onNew={askNew} />;

  const cycle = view ? cycleToSolve(view.status) : null;
  const cta = view
    ? { label: start.busy ? t('woodpecker.starting') : ctaLabel(view, t), onPress: () => (cycle != null ? openSolve(view.set.id, cycle) : askNew()) }
    : !loading && !(error && !view)
      ? { label: start.busy ? t('woodpecker.starting') : t('woodpecker.start'), onPress: start.start }
      : null;

  return (
    <View style={styles.root} testID="woodpecker">
      <View style={[styles.header, { marginTop: insets.top }]}>
        <Tap testID="woodpecker-back" accessibilityRole="button" accessibilityLabel={t('woodpecker.back_play')} onPress={back} style={styles.back}>
          <ChevronLeft size={18} color={eos.ash} strokeWidth={1.8} />
          <AppText variant="bodyStrong" color={eos.ash}>
            {t('woodpecker.back_play')}
          </AppText>
        </Tap>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: (cta ? DOCK_H : space[8]) + insets.bottom }]} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
      {cta ? (
        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]} pointerEvents="box-none">
          <LinearGradient pointerEvents="none" colors={['transparent', eos.ink]} locations={[0, 0.3]} style={StyleSheet.absoluteFill} />
          <PlateButton
            testID="woodpecker-cta"
            label={cta.label}
            loading={start.busy}
            variant={view?.status.phase === 'rest' && view.status.rested === 0 ? 'slate' : undefined}
            size="lg"
            block
            onPress={cta.onPress}
          />
        </View>
      ) : null}
      {about ? <AboutSheet onClose={() => setAbout(false)} /> : null}
    </View>
  );
}

/** No set yet: the method in four rules, Start below. */
function Intro({ levelLine, failed, onAbout }: { levelLine: string; failed: boolean; onAbout: () => void }) {
  const t = useT();
  return (
    <View testID="woodpecker-empty">
      <AppText variant="label" color={tone.rose}>
        {t('woodpecker.how')}
      </AppText>
      <AppText variant="heading" accessibilityRole="header" style={styles.title}>
        {t('woodpecker.title')}
      </AppText>
      <AppText variant="body" color={graphite[300]} style={styles.method}>
        {t('woodpecker.lead')}
      </AppText>
      <View style={styles.card}>
        <Steps />
      </View>
      <AboutLink onPress={onAbout} />
      <AppText variant="caption" color={eos.ash} style={styles.startNote} testID="woodpecker-from-level">
        {`${t('woodpecker.start_note')} ${levelLine}`}
      </AppText>
      {failed ? (
        <AppText variant="caption" color={semantic.danger} style={styles.startNote} testID="woodpecker-start-error">
          {t('woodpecker.start_failed')}
        </AppText>
      ) : null}
    </View>
  );
}

function Steps() {
  const t = useT();
  return (
    <View style={styles.steps}>
      {HOW_STEPS.map((n) => (
        <View key={n} style={styles.step}>
          <View style={styles.stepNum}>
            <AppText variant="captionStrong" color={tone.roseSoft}>
              {n}
            </AppText>
          </View>
          <AppText variant="body" color={graphite[300]} style={[styles.flex, styles.stepText]}>
            {t(`woodpecker.how.${n}`)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function AboutLink({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <Tap testID="woodpecker-about-open" accessibilityRole="button" accessibilityLabel={t('woodpecker.about')} onPress={onPress} style={styles.action}>
      <CircleHelp size={16} color={eos.ash} strokeWidth={1.8} />
      <AppText variant="bodyStrong" color={eos.ash}>
        {t('woodpecker.about')}
      </AppText>
    </Tap>
  );
}

function SetBody({ view: v, onAbout, onNew }: { view: SetView; onAbout: () => void; onNew: () => void }) {
  const t = useT();
  const tn = useTn();
  const archive = useArchiveSet();
  const s = v.status;
  const heading =
    s.phase === 'first'
      ? t('woodpecker.first.label', { day: Math.min(s.day, WOODPECKER_FIRST_CYCLE_DAYS), of: WOODPECKER_FIRST_CYCLE_DAYS })
      : s.phase === 'cycle'
        ? t('woodpecker.cycle', { n: s.cycle })
        : s.phase === 'rest'
          ? t('woodpecker.cycle_done', { n: s.cycle })
          : t('woodpecker.complete.title');
  const askArchive = () =>
    confirm({
      title: t('woodpecker.archive_title'),
      body: t('woodpecker.archive_body'),
      confirmLabel: t('woodpecker.archive_confirm'),
      cancelLabel: t('woodpecker.cancel'),
      testID: 'woodpecker-archive',
      onConfirm: () =>
        archive.mutate(v.set.id, {
          onSuccess: () => toast.show({ title: t('woodpecker.archived'), icon: Archive }),
        }),
    });
  return (
    <View>
      <AppText variant="label" color={tone.rose}>
        {t('woodpecker.title')}
      </AppText>
      <AppText variant="heading" accessibilityRole="header" style={styles.title} testID="woodpecker-cycle-title">
        {heading}
      </AppText>
      <AppText variant="body" color={eos.ash} style={styles.setLine} testID="woodpecker-set-line">
        {setLine(v, t, tn)}
      </AppText>

      <PhaseCard v={v} />
      {s.phase === 'first' || s.phase === 'cycle' ? <TodayCard today={s.today} suggested={s.phase === 'first'} /> : null}

      <View style={styles.card} testID="woodpecker-history">
        <View style={styles.cardHead}>
          <AppText variant="label">{t('woodpecker.history')}</AppText>
          <AppText variant="caption" color={eos.ash}>
            {t('woodpecker.history_hint')}
          </AppText>
        </View>
        <View style={styles.chart}>
          <CycleChart cycles={v.cycles} testID="woodpecker-chart" />
        </View>
      </View>

      <View style={styles.actions}>
        <AboutLink onPress={onAbout} />
        <Tap testID="woodpecker-new" accessibilityRole="button" accessibilityLabel={t('woodpecker.new_set')} onPress={onNew} style={styles.action}>
          <Plus size={16} color={eos.ash} strokeWidth={1.8} />
          <AppText variant="bodyStrong" color={eos.ash}>
            {t('woodpecker.new_set')}
          </AppText>
        </Tap>
        <Tap testID="woodpecker-archive" accessibilityRole="button" accessibilityLabel={t('woodpecker.archive')} onPress={askArchive} style={styles.action}>
          <Archive size={16} color={eos.ash} strokeWidth={1.8} />
          <AppText variant="bodyStrong" color={eos.ash}>
            {t('woodpecker.archive')}
          </AppText>
        </Tap>
      </View>
    </View>
  );
}

/** The phase in one card: its big number, its line, its advice. */
function PhaseCard({ v }: { v: SetView }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const s = v.status;
  if (s.phase === 'first') {
    return (
      <View style={styles.card} testID="woodpecker-current">
        <View style={styles.bigRow}>
          <AppText variant="value" testID="woodpecker-stat-solved">
            {String(s.solved)}
          </AppText>
          <AppText variant="bodyStrong" color={eos.ash}>
            {t('woodpecker.first.solved')}
          </AppText>
        </View>
        <ProgressBar value={Math.min(1, s.day / WOODPECKER_FIRST_CYCLE_DAYS)} height={4} trackColor={eos.well} style={styles.bar} />
        <AppText variant="caption" color={s.due ? tone.sage : eos.ash} style={styles.note} testID="woodpecker-note">
          {s.due ? t('woodpecker.first.due') : t('woodpecker.first.note')}
        </AppText>
        <CloseFirst v={v} canClose={s.canClose} solved={s.solved} />
      </View>
    );
  }
  if (s.phase === 'cycle') {
    const over = s.daysLeft != null && s.daysLeft <= 0;
    return (
      <View style={styles.card} testID="woodpecker-current">
        <View style={styles.bigRow}>
          <AppText variant="value" testID="woodpecker-stat-solved">
            {String(s.done)}
          </AppText>
          <AppText variant="bodyStrong" color={eos.ash} style={styles.tabular}>
            {`/ ${s.total}`}
          </AppText>
        </View>
        <ProgressBar value={s.total ? s.done / s.total : 0} height={4} trackColor={eos.well} style={styles.bar} />
        <AppText variant="caption" color={over ? tone.rose : eos.ash} style={styles.note} testID="woodpecker-note">
          {deadlineLine(s, t, tn, lang)}
        </AppText>
      </View>
    );
  }
  if (s.phase === 'rest') {
    const r = restResult(v, s, t, tn);
    return (
      <View style={[styles.card, styles.cardDone]} testID="woodpecker-current">
        <AppText variant="value" testID="woodpecker-stat-days">
          {daysText(tn, s.days)}
        </AppText>
        <AppText variant="bodyStrong" color={r.good ? tone.sage : tone.rose} style={styles.mt4} testID="woodpecker-rest-result">
          {r.text}
        </AppText>
        <AppText variant="caption" color={eos.ash} style={styles.note} testID="woodpecker-note">
          {restLine(s, t, tn)}
        </AppText>
      </View>
    );
  }
  return (
    <View style={[styles.card, styles.cardDone]} testID="woodpecker-current">
      <Flag size={22} color={tone.sage} strokeWidth={1.8} />
      <AppText variant="body" color={eos.bone} style={styles.note} testID="woodpecker-note">
        {s.days <= 1 && s.cycles >= 2 ? t('woodpecker.complete.day', { days: daysText(tn, s.days), n: s.cycles }) : t('woodpecker.complete.seven')}
      </AppText>
      <AppText variant="caption" color={eos.ash} style={styles.note}>
        {t('woodpecker.complete.next')}
      </AppText>
    </View>
  );
}

/** Finish cycle 1 by hand (after WOODPECKER_MIN_SET puzzles). */
function CloseFirst({ v, canClose, solved }: { v: SetView; canClose: boolean; solved: number }) {
  const t = useT();
  const close = useCloseFirstCycle();
  if (!canClose) {
    return (
      <AppText variant="caption" color={eos.dust} style={styles.note} testID="woodpecker-close-min">
        {t('woodpecker.first.close_min', { n: WOODPECKER_MIN_SET })}
      </AppText>
    );
  }
  const ask = () =>
    confirm({
      title: t('woodpecker.first.close_title'),
      body: t('woodpecker.first.close_body', { n: solved }),
      confirmLabel: t('woodpecker.first.close_confirm'),
      cancelLabel: t('woodpecker.cancel'),
      testID: 'woodpecker-close',
      onConfirm: () =>
        close.mutate(v.set.id, {
          onError: () => toast.show({ title: t('woodpecker.first.close_failed') }),
        }),
    });
  return (
    <Tap testID="woodpecker-close" accessibilityRole="button" accessibilityLabel={t('woodpecker.first.close')} onPress={ask} style={styles.action}>
      <Flag size={16} color={eos.ash} strokeWidth={1.8} />
      <AppText variant="bodyStrong" color={eos.ash}>
        {t('woodpecker.first.close')}
      </AppText>
    </Tap>
  );
}

/** Today's portion: count against the goal, or done. */
function TodayCard({ today, suggested }: { today: { done: number; goal: number | null; met: boolean }; suggested: boolean }) {
  const t = useT();
  const goal = today.goal ?? 0;
  return (
    <View style={[styles.card, today.met && styles.cardDone]} testID="woodpecker-today">
      <View style={styles.cardHead}>
        <AppText variant="label">{t('woodpecker.today')}</AppText>
        {suggested ? (
          <AppText variant="caption" color={eos.dust}>
            {t('woodpecker.today.suggested')}
          </AppText>
        ) : null}
      </View>
      {today.met ? (
        <View style={styles.metRow}>
          <View style={styles.metBadge}>
            <Check size={14} color={tone.sageDeep} strokeWidth={2.4} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" color={tone.sage} testID="woodpecker-today-met">
              {`${t('woodpecker.today.met')} · ${today.done}/${goal}`}
            </AppText>
            <AppText variant="caption" color={eos.ash}>
              {t('woodpecker.today.met_sub')}
            </AppText>
          </View>
        </View>
      ) : (
        <>
          <AppText variant="valueSm" style={[styles.mt4, styles.tabular]} testID="woodpecker-today-count">
            {`${today.done} / ${goal}`}
          </AppText>
          <ProgressBar value={goal ? today.done / goal : 0} height={4} trackColor={eos.well} style={styles.bar} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1, minWidth: 0 },
  mt4: { marginTop: space[1] },
  tabular: { fontVariant: ['tabular-nums'] },
  centerText: { textAlign: 'center' },
  loading: { marginTop: space[16] },
  errorBox: { marginTop: space[16], alignItems: 'center', gap: space[4] },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  back: { height: layout.headerButton, paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space[1] },
  title: { marginTop: space[1], fontSize: 24, lineHeight: 29 },
  setLine: { marginTop: space[1], fontSize: 13 },
  method: { marginTop: space[3], lineHeight: 21 },
  startNote: { marginTop: space[3], lineHeight: 17 },
  card: {
    marginTop: space[4],
    padding: space[3.5],
    borderRadius: radii.xl,
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: alpha(eos.bone, 0.05),
  },
  cardDone: { borderColor: alpha(tone.sageDeep, 0.35) },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  chart: { marginTop: space[6] },
  bar: { marginTop: space[3] },
  note: { marginTop: space[2.5], lineHeight: 17 },
  metRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[2.5] },
  metBadge: { width: 28, height: 28, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(tone.sageDeep, 0.16) },
  steps: { gap: space[3] },
  step: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(eos.ember, 0.22) },
  stepText: { lineHeight: 20, fontSize: 14 },
  actions: { marginTop: space[4], flexDirection: 'row', flexWrap: 'wrap', columnGap: space[5] },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space[6], paddingHorizontal: layout.gutter },
});

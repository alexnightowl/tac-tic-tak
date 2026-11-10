import type { WoodpeckerSet } from '@tac/core/api';
import { WOODPECKER_FIRST_CYCLE_DAYS, WOODPECKER_MIN_SET } from '@tac/core/library';
import { alpha, eos, graphite, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Archive, BookOpen, Check, CircleHelp, ExternalLink, Flag, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatLocalDate } from '@tac/core/format';
import { HOW_STEPS, openBook } from '@/features/woodpecker/About';
import { useArchiveSet, useCloseFirstCycle } from '@/features/woodpecker/api';
import { useStartMethod, type StartMethod } from '@/features/woodpecker/create';
import { CycleChart } from '@/features/woodpecker/CycleChart';
import { ctaLabel, cycleToSolve, daysText, deadlineLine, openSolve, restLine, restResult, setLine, useActiveSet, type SetView } from '@/features/woodpecker/model';
import { toast } from '@/shell/toast/store';
import { PlateButton } from '@/ui';
import { useLang, useT, useTn } from '@/ui/lang';
import { Dialog } from '../Dialog';
import { useHotkeys } from '../hotkeys';
import { Bar, Card, DText, GhostButton, Hover, KeyHints, Label, Num, StatTile, TextButton, Title } from '../kit';
import { SummaryRow } from '../home/parts';
import { useTwoColumns } from '../home/useTwoColumns';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';

// /woodpecker on a desktop window (D41, no artboard; built like DXBook and
// DXPlay): the method's phase as the hero card with the main button and
// today's portion, the cycles chart; the right column has the rules, the
// book, and the set's facts with New set and Archive. Without a set: the
// method and Start. Space runs the main button, N starts a new set.

const ASIDE = 320;

type DialogKind = 'new' | 'archive' | 'close' | 'about' | null;

export function DxWoodpecker({ setId }: { setId?: string }) {
  const t = useT();
  const { view, summary, loading, error, retry } = useActiveSet(setId);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const start = useStartMethod(view?.set.id ?? null, (set) => {
    setDialog(null);
    router.setParams({ set: set.id });
  });
  // Narrow desktop windows (1024–1227) stack the right column under the page.
  const two = useTwoColumns(900);
  const back = { label: t('woodpecker.back_play'), onPress: () => (router.canGoBack() ? router.back() : router.navigate('/play' as Href)) };
  const cycle = view ? cycleToSolve(view.status) : null;
  const main = () => {
    if (!view) return start.start();
    if (cycle != null) openSolve(view.set.id, cycle);
    else setDialog('new');
  };

  useHotkeys({ ' ': main, n: () => view && setDialog('new') }, !loading && dialog === null && !start.busy);

  let body: ReactNode;
  if (loading) body = <ActivityIndicator color={eos.ash} style={styles.loading} />;
  else if (error && !view)
    body = (
      <Card style={styles.state}>
        <DText size={14} color={dx.ash}>
          {t('woodpecker.load_failed')}
        </DText>
        <PlateButton testID="dx-woodpecker-retry" label={t('woodpecker.retry')} variant="slate" size="sm" onPress={retry} />
      </Card>
    );
  else if (!summary || !view) body = <Intro start={start} />;
  else body = <SetMain view={view} onMain={main} onClose={() => setDialog('close')} />;

  const aside = (
    <>
      <HowCard onAbout={() => setDialog('about')} style={two ? undefined : styles.flex} />
      {view ? <InfoCard view={view} onNew={() => setDialog('new')} onArchive={() => setDialog('archive')} style={two ? undefined : styles.flex} /> : null}
    </>
  );

  return (
    <>
      <DesktopPage title={t('woodpecker.title')} back={back} aside={two ? aside : undefined} asideWidth={ASIDE} testID="dx-woodpecker">
        <View style={styles.col}>
          {body}
          {two ? null : <View style={styles.stacked}>{aside}</View>}
        </View>
      </DesktopPage>
      {dialog === 'new' && view ? <NewDialog start={start} onClose={() => setDialog(null)} /> : null}
      {dialog === 'archive' && view ? <ArchiveDialog set={view.set} onClose={() => setDialog(null)} /> : null}
      {dialog === 'close' && view && view.status.phase === 'first' ? <CloseDialog set={view.set} solved={view.status.solved} onClose={() => setDialog(null)} /> : null}
      {dialog === 'about' ? <AboutDialog onClose={() => setDialog(null)} /> : null}
    </>
  );
}

// ── With a set ──────────────────────────────────────────────────────────

function SetMain({ view: v, onMain, onClose }: { view: SetView; onMain: () => void; onClose: () => void }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const s = v.status;
  const current = v.cycles[v.cycles.length - 1];
  let label: string;
  let labelColor: string = dx.rose;
  let big: ReactNode;
  let note: string;
  let noteColor: string = dx.ash;
  let progress: number | null = null;
  if (s.phase === 'first') {
    label = t('woodpecker.first.label', { day: Math.min(s.day, WOODPECKER_FIRST_CYCLE_DAYS), of: WOODPECKER_FIRST_CYCLE_DAYS });
    big = <BigNumber value={String(s.solved)} unit={t('woodpecker.first.solved')} />;
    note = s.due ? t('woodpecker.first.due') : t('woodpecker.first.note');
    progress = Math.min(1, s.day / WOODPECKER_FIRST_CYCLE_DAYS);
  } else if (s.phase === 'cycle') {
    label = t('woodpecker.cycle', { n: s.cycle });
    big = <BigNumber value={String(s.done)} unit={`/ ${s.total}`} />;
    note = deadlineLine(s, t, tn, lang);
    if (s.daysLeft != null && s.daysLeft <= 0) noteColor = dx.rose;
    progress = s.total ? s.done / s.total : 0;
  } else if (s.phase === 'rest') {
    const r = restResult(v, s, t, tn);
    label = t('woodpecker.cycle_done', { n: s.cycle });
    labelColor = dx.sage;
    big = (
      <View>
        <Num size={40} style={styles.big}>
          {daysText(tn, s.days)}
        </Num>
        <DText size={14.5} weight={700} color={r.good ? dx.sage : dx.rose} testID="dx-woodpecker-rest-result">
          {r.text}
        </DText>
      </View>
    );
    note = restLine(s, t, tn);
  } else {
    label = t('woodpecker.complete.title');
    labelColor = dx.sage;
    big = <Flag size={34} color={dx.sage} strokeWidth={1.6} />;
    note = `${s.days <= 1 && s.cycles >= 2 ? t('woodpecker.complete.day', { days: daysText(tn, s.days), n: s.cycles }) : t('woodpecker.complete.seven')} ${t('woodpecker.complete.next')}`;
  }
  const today = s.phase === 'first' || s.phase === 'cycle' ? s.today : null;
  return (
    <>
      <Card texture style={styles.hero} testID="dx-woodpecker-current">
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <Label color={labelColor}>{label}</Label>
            <View style={styles.bigWrap}>{big}</View>
            <DText size={13.5} color={dx.ash} testID="dx-woodpecker-set-line">
              {setLine(v, t, tn)}
            </DText>
          </View>
          <View style={styles.heroCta}>
            <PlateButton
              testID="dx-woodpecker-cta"
              label={ctaLabel(v, t)}
              variant={s.phase === 'rest' && s.rested === 0 ? 'slate' : undefined}
              size="lg"
              block
              onPress={onMain}
            />
            <KeyHints style={styles.hints} items={[{ keys: ['Space'], label: t('woodpecker.key.continue') }, { keys: ['N'], label: t('woodpecker.key.new') }]} />
          </View>
        </View>
        {progress != null ? <Bar value={progress} style={styles.heroBar} /> : null}
        {today ? (
          <View style={styles.tiles}>
            <StatTile
              label={s.phase === 'first' ? `${t('woodpecker.today')} · ${t('woodpecker.today.suggested')}` : t('woodpecker.today')}
              value={`${today.done} / ${today.goal ?? 0}`}
              delta={today.met ? '✓' : undefined}
              deltaColor={dx.sage}
              caption={today.met ? t('woodpecker.today.met') : undefined}
              captionColor={dx.sage}
              style={styles.tile}
              testID="dx-woodpecker-today"
            />
            <StatTile label={t('woodpecker.stat.clean')} value={current?.cleanPct != null ? `${current.cleanPct}%` : '—'} style={styles.tile} testID="dx-woodpecker-clean" />
          </View>
        ) : null}
        <DText size={13} lh={19} color={noteColor} style={styles.note} testID="dx-woodpecker-note">
          {note}
        </DText>
        {today?.met ? (
          <DText size={12.5} lh={18} color={dx.dust} style={styles.mt6}>
            {t('woodpecker.today.met_sub')}
          </DText>
        ) : null}
        {s.phase === 'first' ? (
          s.canClose ? (
            <TextButton testID="dx-woodpecker-close" label={t('woodpecker.first.close')} accessibilityLabel={t('woodpecker.first.close')} icon={Flag} size={12.5} onPress={onClose} style={styles.closeBtn} />
          ) : (
            <DText size={12.5} color={dx.dust} style={styles.mt10} testID="dx-woodpecker-close-min">
              {t('woodpecker.first.close_min', { n: WOODPECKER_MIN_SET })}
            </DText>
          )
        ) : null}
      </Card>

      <Card style={styles.pad} testID="dx-woodpecker-history">
        <View style={styles.head}>
          <Label>{t('woodpecker.history')}</Label>
          <View style={styles.flex} />
          <DText size={12.5} color={dx.dust}>
            {t('woodpecker.history_hint')}
          </DText>
        </View>
        <View style={styles.chart}>
          <CycleChart cycles={v.cycles} height={170} testID="dx-woodpecker-chart" />
        </View>
      </Card>
    </>
  );
}

function BigNumber({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.bigRow}>
      <Num size={44} style={styles.big}>
        {value}
      </Num>
      <DText size={20} weight={700} color={dx.ash} tabular>
        {unit}
      </DText>
    </View>
  );
}

// ── Aside ───────────────────────────────────────────────────────────────

function Steps() {
  const t = useT();
  return (
    <View style={styles.steps}>
      {HOW_STEPS.map((n) => (
        <View key={n} style={styles.step}>
          <View style={styles.stepNum}>
            <DText size={12} weight={800} color={tone.roseSoft}>
              {n}
            </DText>
          </View>
          <DText size={13} lh={19} color={graphite[300]} style={styles.flex}>
            {t(`woodpecker.how.${n}`)}
          </DText>
        </View>
      ))}
    </View>
  );
}

function HowCard({ onAbout, style }: { onAbout: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <Card style={[styles.pad, style]} testID="dx-woodpecker-how">
      <Label>{t('woodpecker.how')}</Label>
      <View style={styles.mt14}>
        <Steps />
      </View>
      <TextButton testID="dx-woodpecker-about" label={t('woodpecker.about')} accessibilityLabel={t('woodpecker.about')} icon={CircleHelp} size={12.5} onPress={onAbout} style={styles.aboutBtn} />
    </Card>
  );
}

function InfoCard({ view: v, onNew, onArchive, style }: { view: SetView; onNew: () => void; onArchive: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const set = v.set;
  return (
    <Card style={[styles.pad, style]} testID="dx-woodpecker-info">
      <Label>{t('woodpecker.info')}</Label>
      <View style={styles.mt6}>
        <SummaryRow label={v.open ? t('woodpecker.info.pool') : t('woodpecker.info.size')} value={String(set.size)} />
        <SummaryRow label={t('woodpecker.info.range')} value={`${set.ratingMin}–${set.ratingMax}`} />
        <SummaryRow label={t('woodpecker.info.style')} value={`${t(`style.${set.style}.name`)} · ${set.rating}`} />
        <SummaryRow label={t('woodpecker.info.created')} value={formatLocalDate(new Date(set.createdAt))} last />
      </View>
      <GhostButton testID="dx-woodpecker-new" label={t('woodpecker.new_set')} accessibilityLabel={t('woodpecker.new_set')} icon={Plus} onPress={onNew} style={styles.mt16} />
      <TextButton testID="dx-woodpecker-archive" label={t('woodpecker.archive')} accessibilityLabel={t('woodpecker.archive')} icon={Archive} size={12.5} onPress={onArchive} style={styles.archive} />
    </Card>
  );
}

// ── Start ───────────────────────────────────────────────────────────────

function Intro({ start }: { start: StartMethod }) {
  const t = useT();
  return (
    <Card texture style={styles.pad} testID="dx-woodpecker-empty">
      <Label color={dx.rose}>{t('woodpecker.how')}</Label>
      <Title size={28} style={styles.mt6}>
        {t('woodpecker.title')}
      </Title>
      <DText size={14.5} lh={23} color={graphite[300]} style={styles.method}>
        {t('woodpecker.lead')}
      </DText>
      <DText size={13} color={dx.dust} style={styles.mt16} testID="dx-woodpecker-from-level">
        {`${t('woodpecker.start_note')} ${start.levelLine}`}
      </DText>
      {start.failed ? (
        <DText size={13} color={tone.danger} style={styles.mt10} testID="dx-woodpecker-start-error">
          {t('woodpecker.start_failed')}
        </DText>
      ) : null}
      <View style={styles.startRow}>
        <PlateButton
          testID="dx-woodpecker-start"
          label={start.busy ? t('woodpecker.starting') : t('woodpecker.start')}
          loading={start.busy}
          size="lg"
          onPress={start.start}
          style={styles.submit}
        />
        <KeyHints items={[{ keys: ['Space'], label: t('woodpecker.entry.start') }]} />
      </View>
    </Card>
  );
}

// ── Dialogs ─────────────────────────────────────────────────────────────

function ConfirmRow({ confirm, onCancel, busy, onConfirm, testID }: { confirm: string; onCancel: () => void; busy?: boolean; onConfirm: () => void; testID: string }) {
  const t = useT();
  return (
    <View style={styles.dialogRow}>
      <GhostButton testID={`${testID}-cancel`} label={t('woodpecker.cancel')} accessibilityLabel={t('woodpecker.cancel')} height={44} onPress={onCancel} style={styles.flex} />
      <PlateButton testID={`${testID}-confirm`} label={confirm} size="md" loading={busy} onPress={onConfirm} style={styles.flex} />
    </View>
  );
}

function NewDialog({ start, onClose }: { start: StartMethod; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog title={t('woodpecker.new_title')} onClose={() => (start.busy ? undefined : onClose())} width={440} testID="dx-woodpecker-new-dialog">
      <DText size={13.5} lh={20} color={dx.ash}>
        {t('woodpecker.new_body')}
      </DText>
      <DText size={12.5} color={dx.dust} style={styles.mt10}>
        {start.levelLine}
      </DText>
      {start.failed ? (
        <DText size={13} color={tone.danger} style={styles.mt10}>
          {t('woodpecker.start_failed')}
        </DText>
      ) : null}
      <ConfirmRow testID="dx-woodpecker-new" confirm={start.busy ? t('woodpecker.starting') : t('woodpecker.new_set')} busy={start.busy} onCancel={onClose} onConfirm={start.start} />
    </Dialog>
  );
}

function CloseDialog({ set, solved, onClose }: { set: WoodpeckerSet; solved: number; onClose: () => void }) {
  const t = useT();
  const close = useCloseFirstCycle();
  return (
    <Dialog title={t('woodpecker.first.close_title')} onClose={onClose} width={440} testID="dx-woodpecker-close-dialog">
      <DText size={13.5} lh={20} color={dx.ash}>
        {t('woodpecker.first.close_body', { n: solved })}
      </DText>
      {close.isError ? (
        <DText size={13} color={tone.danger} style={styles.mt10}>
          {t('woodpecker.first.close_failed')}
        </DText>
      ) : null}
      <ConfirmRow
        testID="dx-woodpecker-close"
        confirm={t('woodpecker.first.close_confirm')}
        busy={close.isPending}
        onCancel={onClose}
        onConfirm={() => close.mutate(set.id, { onSuccess: onClose })}
      />
    </Dialog>
  );
}

function ArchiveDialog({ set, onClose }: { set: WoodpeckerSet; onClose: () => void }) {
  const t = useT();
  const archive = useArchiveSet();
  return (
    <Dialog title={t('woodpecker.archive_title')} onClose={onClose} width={420} testID="dx-woodpecker-archive-dialog">
      <DText size={13.5} lh={20} color={dx.ash}>
        {t('woodpecker.archive_body')}
      </DText>
      <ConfirmRow
        testID="dx-woodpecker-archive"
        confirm={t('woodpecker.archive_confirm')}
        busy={archive.isPending}
        onCancel={onClose}
        onConfirm={() =>
          archive.mutate(set.id, {
            onSuccess: () => {
              onClose();
              toast.show({ title: t('woodpecker.archived'), icon: Archive });
            },
          })
        }
      />
    </Dialog>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <Dialog title={t('woodpecker.about.title')} onClose={onClose} width={560} testID="dx-woodpecker-about-dialog">
      <View style={styles.aboutText}>
        {(['p1', 'p2', 'p3', 'p4'] as const).map((p) => (
          <DText key={p} size={13.5} lh={21} color={graphite[300]}>
            {t(`woodpecker.about.${p}`)}
          </DText>
        ))}
      </View>
      <Label style={styles.mt16}>{t('woodpecker.about.book')}</Label>
      <Hover testID="dx-woodpecker-about-book" accessibilityRole="link" accessibilityLabel={t('woodpecker.about.link_a11y')} onPress={openBook} style={styles.book} hoverStyle={styles.bookHover}>
        <BookOpen size={18} color={tone.roseSoft} strokeWidth={1.8} />
        <DText size={14} weight={700} style={styles.flex}>
          {t('woodpecker.about.link')}
        </DText>
        <ExternalLink size={16} color={dx.ash} strokeWidth={1.8} />
      </Hover>
      <View style={styles.dialogRow}>
        <PlateButton testID="dx-woodpecker-about-close" label={t('woodpecker.about.close')} variant="slate" size="md" icon={<Check size={16} color={eos.bone} strokeWidth={2} />} onPress={onClose} style={styles.flex} />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt6: { marginTop: 6 },
  mt10: { marginTop: 10 },
  mt14: { marginTop: 14 },
  mt16: { marginTop: 16 },
  loading: { marginTop: 80 },
  col: { gap: 16 },
  stacked: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginTop: 4 },
  state: { padding: 22, alignItems: 'flex-start', gap: 14 },
  pad: { paddingVertical: 20, paddingHorizontal: 22 },
  hero: { paddingVertical: 22, paddingHorizontal: 24 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  bigWrap: { marginTop: 4, marginBottom: 4 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  big: { lineHeight: 52 },
  heroCta: { width: 280, gap: 12, paddingTop: 4 },
  hints: { justifyContent: 'center' },
  heroBar: { marginTop: 18 },
  tiles: { flexDirection: 'row', gap: 12, marginTop: 16 },
  tile: { flex: 1, minWidth: 0 },
  note: { marginTop: 14 },
  closeBtn: { alignSelf: 'flex-start', marginTop: 10 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 4 },
  chart: { marginTop: 28 },
  steps: { gap: 12 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(eos.ember, 0.22) },
  aboutBtn: { alignSelf: 'flex-start', marginTop: 14 },
  archive: { alignSelf: 'center', marginTop: 8 },
  method: { marginTop: 10, maxWidth: 620 },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 22 },
  submit: { minWidth: 240 },
  dialogRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  aboutText: { gap: 12 },
  book: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, marginTop: 8, marginHorizontal: -12, borderRadius: 10 },
  bookHover: { backgroundColor: dx.ghostHover },
});

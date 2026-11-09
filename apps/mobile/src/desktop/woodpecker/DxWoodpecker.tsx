import type { WoodpeckerSet } from '@tac/core/api';
import { WOODPECKER_DIFFICULTIES, WOODPECKER_SIZES } from '@tac/core/library';
import { alpha, eos, graphite, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Archive, Check, Plus } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatLocalDate } from '@tac/core/format';
import { feel } from '@/feel';
import { useArchiveSet } from '@/features/woodpecker/api';
import { useCreateForm, type CreateForm } from '@/features/woodpecker/create';
import { CycleChart } from '@/features/woodpecker/CycleChart';
import { clock, ctaLabel, difficultyLabel, openSolve, useActiveSet, type BlockRow, type SetView } from '@/features/woodpecker/model';
import { toast } from '@/shell/toast/store';
import { PlateButton } from '@/ui';
import { useT, type TFn } from '@/ui/lang';
import { Dialog } from '../Dialog';
import { useHotkeys } from '../hotkeys';
import { Bar, Card, DText, GhostButton, Hover, KeyHints, Label, Num, Seg, StatTile, TextButton, Title } from '../kit';
import { Card2, OptionCard, SummaryRow } from '../home/parts';
import { colWidth, usePageWidth } from '../learn/parts';
import { useTwoColumns } from '../home/useTwoColumns';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';

// /woodpecker on a desktop window (D40, no artboard; built like DXBook and
// DXPlay): the current cycle as the hero card with Continue, the cycles
// chart, the blocks as a grid; the right column explains the method and
// holds the set's facts, New set and Archive. Without a set: the create
// form in the page. Space continues, N opens New set.

const ASIDE = 320;

export function DxWoodpecker({ setId }: { setId?: string }) {
  const t = useT();
  const { view, summary, loading, error, retry } = useActiveSet(setId);
  const [dialog, setDialog] = useState<'new' | 'archive' | null>(null);
  // Narrow desktop windows (1024–1227) stack the right column under the page.
  const two = useTwoColumns(900);
  const back = { label: t('woodpecker.back_play'), onPress: () => (router.canGoBack() ? router.back() : router.navigate('/play' as Href)) };

  useHotkeys(
    {
      ' ': () => view && openSolve(view.set.id, view.next),
      n: () => view && setDialog('new'),
    },
    !!view && dialog === null,
  );

  let main: ReactNode;
  if (loading) main = <ActivityIndicator color={eos.ash} style={styles.loading} />;
  else if (error && !view)
    main = (
      <Card style={styles.state}>
        <DText size={14} color={dx.ash}>
          {t('woodpecker.load_failed')}
        </DText>
        <PlateButton testID="dx-woodpecker-retry" label={t('woodpecker.retry')} variant="slate" size="sm" onPress={retry} />
      </Card>
    );
  else if (!summary || !view) main = <EmptyMain />;
  else main = <SetMain view={view} two={two} />;

  const aside = (
    <>
      <HowCard style={two ? undefined : styles.flex} />
      {view ? <InfoCard set={view.set} onNew={() => setDialog('new')} onArchive={() => setDialog('archive')} style={two ? undefined : styles.flex} /> : null}
    </>
  );

  return (
    <>
      <DesktopPage title={t('woodpecker.title')} back={back} aside={two ? aside : undefined} asideWidth={ASIDE} testID="dx-woodpecker">
        <View style={styles.col}>
          {main}
          {two ? null : <View style={styles.stacked}>{aside}</View>}
        </View>
      </DesktopPage>
      {dialog === 'new' && view ? <NewSetDialog replace={view.set.id} onClose={() => setDialog(null)} /> : null}
      {dialog === 'archive' && view ? <ArchiveDialog set={view.set} onClose={() => setDialog(null)} /> : null}
    </>
  );
}

// ── With a set ──────────────────────────────────────────────────────────

function SetMain({ view: v, two }: { view: SetView; two: boolean }) {
  const t = useT();
  const set = v.set;
  const avg = v.current?.avgSec ?? null;
  const over = v.target != null && avg != null && avg > v.target;
  const shown = v.complete ? v.nextTarget : v.target;
  const note = v.complete
    ? `${v.nextTarget != null ? t('woodpecker.done_note', { avg: clock(avg ?? 0), clean: v.cleanPct ?? 0, target: clock(v.nextTarget) }) : t('woodpecker.done_note_free', { avg: clock(avg ?? 0), clean: v.cleanPct ?? 0 })} ${t('woodpecker.done_rest')}`
    : v.target != null
      ? t('woodpecker.target_note', { target: clock(v.target) })
      : t('woodpecker.first_note');
  const last = v.history.filter((h) => h.complete).at(-1);
  return (
    <>
      <Card texture style={styles.hero} testID="dx-woodpecker-current">
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <Label color={v.complete ? dx.sage : dx.rose}>{v.complete ? t('woodpecker.cycle_done', { n: v.cycle }) : t('woodpecker.cycle', { n: v.cycle })}</Label>
            <View style={styles.bigRow}>
              <Num size={44} style={styles.big}>{`${v.done}`}</Num>
              <DText size={20} weight={700} color={dx.ash} tabular>{`/ ${v.total}`}</DText>
            </View>
            <DText size={13.5} color={dx.ash} testID="dx-woodpecker-set-line">
              {t('woodpecker.set_line', {
                size: set.size,
                difficulty: difficultyLabel(set.difficulty, t),
                window: t('woodpecker.window', { min: set.ratingMin, max: set.ratingMax }),
              })}
            </DText>
          </View>
          <View style={styles.heroCta}>
            <PlateButton testID="dx-woodpecker-cta" label={ctaLabel(v, t, true)} size="lg" block onPress={() => openSolve(set.id, v.next)} />
            <KeyHints style={styles.hints} items={[{ keys: ['Space'], label: t('woodpecker.key.continue') }, { keys: ['N'], label: t('woodpecker.key.new') }]} />
          </View>
        </View>
        <Bar value={v.total ? v.done / v.total : 0} style={styles.heroBar} />
        <View style={styles.tiles}>
          <StatTile label={t('woodpecker.stat.clean')} value={v.cleanPct != null ? `${v.cleanPct}%` : '—'} style={styles.tile} testID="dx-woodpecker-clean" />
          <StatTile
            label={t('woodpecker.stat.avg')}
            value={avg != null ? clock(avg) : '—'}
            caption={last?.speedup != null && last.cycle === v.cycle ? speedText(last.speedup, t) : undefined}
            captionColor={last?.speedup != null && last.speedup >= 0 ? dx.sage : dx.rose}
            style={styles.tile}
            testID="dx-woodpecker-avg"
          />
          <StatTile
            label={v.complete ? t('woodpecker.stat.next_target') : t('woodpecker.stat.target')}
            value={shown != null ? clock(shown) : t('woodpecker.no_target')}
            delta={!v.complete && v.target != null && avg != null ? (over ? '▲' : '✓') : undefined}
            deltaColor={over ? dx.rose : dx.sage}
            style={styles.tile}
            testID="dx-woodpecker-target"
          />
        </View>
        <DText size={13} lh={19} color={v.complete ? dx.sage : dx.ash} style={styles.note} testID="dx-woodpecker-note">
          {note}
        </DText>
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
          <CycleChart bars={v.history} height={170} testID="dx-woodpecker-chart" />
        </View>
      </Card>

      <View style={styles.head}>
        <Label>{t('woodpecker.blocks')}</Label>
        <View style={styles.flex} />
        <DText size={12.5} color={dx.dust} testID="dx-woodpecker-blocks-hint">
          {t('woodpecker.blocks_hint', { done: v.blocks.filter((b) => b.complete).length, total: v.blocks.length })}
        </DText>
      </View>
      <Blocks view={v} two={two} />
    </>
  );
}

const speedText = (pct: number, t: TFn) => (pct >= 0 ? t('woodpecker.faster', { pct }) : t('woodpecker.slower', { pct: -pct }));

function Blocks({ view: v, two }: { view: SetView; two: boolean }) {
  const w = usePageWidth(two ? ASIDE : 0);
  const cols = w >= 760 ? 3 : 2;
  const cw = colWidth(w, cols, 12);
  return (
    <View style={styles.grid}>
      {v.blocks.map((b) => (
        <BlockTile key={b.index} b={b} width={cw} onPress={() => openSolve(v.set.id, { cycle: v.cycle, start: b.start })} />
      ))}
    </View>
  );
}

function BlockTile({ b, width, onPress }: { b: BlockRow; width: number; onPress: () => void }) {
  const t = useT();
  return (
    <Hover
      testID={`dx-woodpecker-block-${b.index}`}
      accessibilityLabel={t('woodpecker.block_a11y', { n: b.index + 1, done: b.done, total: b.total })}
      disabled={b.complete}
      onPress={onPress}
      style={[styles.block, { width }, b.current && styles.blockNow]}
      hoverStyle={styles.blockHover}
    >
      <View style={styles.blockHead}>
        <View style={[styles.badge, b.complete ? styles.badgeDone : b.current ? styles.badgeNow : styles.badgeLater]}>
          {b.complete ? (
            <Check size={14} color={dx.sage} strokeWidth={2.4} />
          ) : (
            <DText size={12.5} weight={800} color={b.current ? eos.bone : dx.dust}>
              {String(b.index + 1)}
            </DText>
          )}
        </View>
        <View style={styles.flex}>
          <DText size={14.5} weight={800}>
            {t('woodpecker.block', { n: b.index + 1 })}
          </DText>
          <DText size={12} color={dx.dust}>
            {t('woodpecker.block_range', { from: b.from, to: b.to })}
          </DText>
        </View>
        <DText size={13} weight={800} tabular color={b.complete ? dx.sage : b.done > 0 ? dx.ash : dx.dust} testID={`dx-woodpecker-block-${b.index}-count`}>
          {`${b.done}/${b.total}`}
        </DText>
      </View>
      <Bar value={b.done / b.total} height={3} colors={b.complete ? [dx.dotOk, dx.sage] : undefined} style={styles.blockBar} />
    </Hover>
  );
}

// ── Aside ───────────────────────────────────────────────────────────────

function HowCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <Card style={[styles.pad, style]} testID="dx-woodpecker-how">
      <Label>{t('woodpecker.how')}</Label>
      <View style={styles.steps}>
        {(['1', '2', '3'] as const).map((n) => (
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
    </Card>
  );
}

function InfoCard({ set, onNew, onArchive, style }: { set: WoodpeckerSet; onNew: () => void; onArchive: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  return (
    <Card style={[styles.pad, style]} testID="dx-woodpecker-info">
      <Label>{t('woodpecker.info')}</Label>
      <View style={styles.mt6}>
        <SummaryRow label={t('woodpecker.info.size')} value={String(set.size)} />
        <SummaryRow label={t('woodpecker.info.difficulty')} value={difficultyLabel(set.difficulty, t)} />
        <SummaryRow label={t('woodpecker.info.range')} value={`${set.ratingMin}–${set.ratingMax}`} />
        <SummaryRow label={t('woodpecker.info.style')} value={t(`style.${set.style}.name`)} />
        <SummaryRow label={t('woodpecker.info.created')} value={formatLocalDate(new Date(set.createdAt))} last />
      </View>
      <GhostButton testID="dx-woodpecker-new" label={t('woodpecker.new_set')} accessibilityLabel={t('woodpecker.new_set')} icon={Plus} onPress={onNew} style={styles.mt16} />
      <TextButton testID="dx-woodpecker-archive" label={t('woodpecker.archive')} accessibilityLabel={t('woodpecker.archive')} icon={Archive} size={12.5} onPress={onArchive} style={styles.archive} />
    </Card>
  );
}

// ── Create ──────────────────────────────────────────────────────────────

function EmptyMain() {
  const f = useCreateForm(null, () => undefined);
  const { t } = f;
  return (
    <Card texture style={styles.pad} testID="dx-woodpecker-empty">
      <Label color={dx.rose}>{t('woodpecker.new_set')}</Label>
      <Title size={28} style={styles.mt6}>
        {t('woodpecker.title')}
      </Title>
      <DText size={14.5} lh={23} color={graphite[300]} style={styles.method}>
        {t('woodpecker.method')}
      </DText>
      <View style={styles.formWrap}>
        <DxCreateForm f={f} replacing={false} />
      </View>
    </Card>
  );
}

function DxCreateForm({ f, replacing }: { f: CreateForm; replacing: boolean }) {
  const { t } = f;
  return (
    <View style={styles.form} testID="dx-woodpecker-create">
      <View>
        <Label style={styles.lblGap}>{t('woodpecker.size')}</Label>
        <Seg
          testID="dx-woodpecker-size"
          accessibilityLabel={t('woodpecker.size')}
          value={`${f.size}`}
          onChange={(v) => {
            feel.emit('segmented');
            f.setSize(Number(v) as typeof f.size);
          }}
          options={WOODPECKER_SIZES.map((n) => ({ value: `${n}`, label: String(n) }))}
          style={styles.sizeSeg}
        />
      </View>
      <View>
        <Label style={styles.lblGap}>{t('woodpecker.difficulty')}</Label>
        <View style={styles.diffs} accessibilityRole="radiogroup" accessibilityLabel={t('woodpecker.difficulty')}>
          {WOODPECKER_DIFFICULTIES.map((d) => (
            <OptionCard
              key={d}
              testID={`dx-woodpecker-diff-${d}`}
              title={t(`woodpecker.diff.${d}`)}
              desc={f.windowText(d)}
              on={f.difficulty === d}
              onPress={() => {
                if (f.difficulty !== d) feel.emit('segmented');
                f.setDifficulty(d);
              }}
              style={styles.flex}
            />
          ))}
        </View>
        <DText size={12.5} color={dx.dust} style={styles.mt10} testID="dx-woodpecker-from-level">
          {t('woodpecker.from_level', { style: f.styleName, level: f.level })}
        </DText>
      </View>
      {replacing ? (
        <Card2 style={styles.replace}>
          <DText size={12.5} lh={18} color={tone.goldInk} testID="dx-woodpecker-replace-note">
            {t('woodpecker.replace_note')}
          </DText>
        </Card2>
      ) : null}
      {f.failed ? (
        <DText size={13} color={tone.danger} testID="dx-woodpecker-create-error">
          {t('woodpecker.create_failed')}
        </DText>
      ) : null}
      <PlateButton
        testID="dx-woodpecker-create-submit"
        label={f.busy ? t('woodpecker.creating') : t('woodpecker.create')}
        loading={f.busy}
        size="lg"
        onPress={f.submit}
        style={styles.submit}
      />
    </View>
  );
}

function NewSetDialog({ replace, onClose }: { replace: string; onClose: () => void }) {
  const f = useCreateForm(replace, (set) => {
    onClose();
    router.setParams({ set: set.id });
  });
  return (
    <Dialog title={f.t('woodpecker.new_set')} onClose={() => (f.busy ? undefined : onClose())} width={560} testID="dx-woodpecker-new-dialog">
      <DText size={13.5} lh={20} color={dx.ash} style={styles.dialogText}>
        {f.t('woodpecker.method')}
      </DText>
      <DxCreateForm f={f} replacing />
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
      <View style={styles.dialogRow}>
        <GhostButton testID="dx-woodpecker-archive-cancel" label={t('woodpecker.cancel')} accessibilityLabel={t('woodpecker.cancel')} height={44} onPress={onClose} style={styles.flex} />
        <PlateButton
          testID="dx-woodpecker-archive-confirm"
          label={t('woodpecker.archive_confirm')}
          size="md"
          loading={archive.isPending}
          onPress={() =>
            archive.mutate(set.id, {
              onSuccess: () => {
                onClose();
                toast.show({ title: t('woodpecker.archived'), icon: Archive });
              },
            })
          }
          style={styles.flex}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt6: { marginTop: 6 },
  mt10: { marginTop: 10 },
  mt16: { marginTop: 16 },
  loading: { marginTop: 80 },
  col: { gap: 16 },
  stacked: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginTop: 4 },
  state: { padding: 22, alignItems: 'flex-start', gap: 14 },
  pad: { paddingVertical: 20, paddingHorizontal: 22 },
  hero: { paddingVertical: 22, paddingHorizontal: 24 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4, marginBottom: 2 },
  big: { lineHeight: 52 },
  heroCta: { width: 280, gap: 12, paddingTop: 4 },
  hints: { justifyContent: 'center' },
  heroBar: { marginTop: 18 },
  tiles: { flexDirection: 'row', gap: 12, marginTop: 16 },
  tile: { flex: 1, minWidth: 0 },
  note: { marginTop: 14 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 4 },
  chart: { marginTop: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  block: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: dx.card,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  blockNow: { backgroundColor: dx.pickedBg, boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: dx.ember, inset: true }] },
  blockHover: { backgroundColor: dx.ghostHover },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  blockBar: { marginTop: 12 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badgeDone: { backgroundColor: alpha(dx.sage, 0.16) },
  badgeNow: { borderWidth: 1.5, borderColor: eos.ember },
  badgeLater: { borderWidth: 1.5, borderColor: eos.seam },
  steps: { gap: 12, marginTop: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(eos.ember, 0.22) },
  archive: { alignSelf: 'center', marginTop: 8 },
  method: { marginTop: 10, maxWidth: 620 },
  formWrap: { marginTop: 24, maxWidth: 680 },
  form: { gap: 22 },
  lblGap: { marginBottom: 10 },
  sizeSeg: { maxWidth: 320 },
  diffs: { flexDirection: 'row', gap: 12 },
  replace: { paddingVertical: 12, paddingHorizontal: 14, backgroundColor: alpha(tone.gold, 0.07) },
  submit: { alignSelf: 'flex-start', minWidth: 240 },
  dialogText: { marginBottom: 18 },
  dialogRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
});


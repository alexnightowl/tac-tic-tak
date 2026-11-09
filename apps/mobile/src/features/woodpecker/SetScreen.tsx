import type { WoodpeckerSet } from '@tac/core/api';
import { alpha, eos, graphite, layout, radii, space, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Archive, Check, ChevronLeft, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toast } from '@/shell/toast/store';
import { AppText, confirm, PlateButton, ProgressBar, Sheet, Tap } from '@/ui';
import { useT, type TFn } from '@/ui/lang';
import { useArchiveSet } from './api';
import { CreateSetForm } from './CreateSetForm';
import { CycleChart } from './CycleChart';
import { useCreateForm } from './create';
import { clock, ctaLabel, difficultyLabel, openSolve, useActiveSet, type BlockRow, type SetView } from './model';

// /woodpecker (D40, no artboard; built like the book page LibBook): the
// active set's current cycle, the cycles chart, the blocks, and the docked
// Continue plate. Without a set: the method in three lines and the create
// form. New set (sheet) replaces the active set after a confirm.

const DOCK_H = layout.plateHeight.lg + space[6] + space[8];

export function WoodpeckerScreen({ setId }: { setId?: string }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { view, summary, loading, error, retry } = useActiveSet(setId);
  const [creating, setCreating] = useState(false);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/play' as Href);
  };

  let body: React.ReactNode;
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
  else if (!summary || !view) body = <EmptyState />;
  else body = <SetBody view={view} onNew={() => setCreating(true)} />;

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
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: (view ? DOCK_H : space[8]) + insets.bottom }]} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
      {view ? (
        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]} pointerEvents="box-none">
          <LinearGradient pointerEvents="none" colors={['transparent', eos.ink]} locations={[0, 0.3]} style={StyleSheet.absoluteFill} />
          <PlateButton testID="woodpecker-cta" label={ctaLabel(view, t)} size="lg" block onPress={() => openSolve(view.set.id, view.next)} />
        </View>
      ) : null}
      {creating && view ? <NewSetSheet replace={view.set.id} onClose={() => setCreating(false)} /> : null}
    </View>
  );
}

/** No set yet: the method and the form. */
function EmptyState() {
  const f = useCreateForm(null, () => undefined);
  const { t } = f;
  return (
    <View testID="woodpecker-empty">
      <AppText variant="label" color={tone.rose}>
        {t('woodpecker.new_set')}
      </AppText>
      <AppText variant="heading" accessibilityRole="header" style={styles.title}>
        {t('woodpecker.title')}
      </AppText>
      <AppText variant="body" color={graphite[300]} style={styles.method}>
        {t('woodpecker.method')}
      </AppText>
      <View style={styles.card}>
        <CreateSetForm f={f} replacing={false} />
      </View>
    </View>
  );
}

function SetBody({ view: v, onNew }: { view: SetView; onNew: () => void }) {
  const t = useT();
  const archive = useArchiveSet();
  const set = v.set;
  const setLine = t('woodpecker.set_line', {
    size: set.size,
    difficulty: difficultyLabel(set.difficulty, t),
    window: t('woodpecker.window', { min: set.ratingMin, max: set.ratingMax }),
  });
  const askArchive = () =>
    confirm({
      title: t('woodpecker.archive_title'),
      body: t('woodpecker.archive_body'),
      confirmLabel: t('woodpecker.archive_confirm'),
      cancelLabel: t('woodpecker.cancel'),
      testID: 'woodpecker-archive',
      onConfirm: () =>
        archive.mutate(set.id, {
          onSuccess: () => toast.show({ title: t('woodpecker.archived'), icon: Archive }),
        }),
    });
  const blocksDone = v.blocks.filter((b) => b.complete).length;
  return (
    <View>
      <AppText variant="label" color={tone.rose}>
        {t('woodpecker.title')}
      </AppText>
      <AppText variant="heading" accessibilityRole="header" style={styles.title} testID="woodpecker-cycle-title">
        {v.complete ? t('woodpecker.cycle_done', { n: v.cycle }) : t('woodpecker.cycle', { n: v.cycle })}
      </AppText>
      <AppText variant="body" color={eos.ash} style={styles.setLine} testID="woodpecker-set-line">
        {setLine}
      </AppText>

      <CurrentCycle v={v} t={t} />

      <View style={styles.card} testID="woodpecker-history">
        <View style={styles.cardHead}>
          <AppText variant="label">{t('woodpecker.history')}</AppText>
          <AppText variant="caption" color={eos.ash}>
            {t('woodpecker.history_hint')}
          </AppText>
        </View>
        <View style={styles.chart}>
          <CycleChart bars={v.history} testID="woodpecker-chart" />
        </View>
      </View>

      <View style={styles.sectionHead}>
        <AppText variant="label">{t('woodpecker.blocks')}</AppText>
        <AppText variant="caption" color={eos.dust} testID="woodpecker-blocks-hint">
          {t('woodpecker.blocks_hint', { done: blocksDone, total: v.blocks.length })}
        </AppText>
      </View>
      <View style={styles.blocks}>
        {v.blocks.map((b) => (
          <BlockItem key={b.index} b={b} onPress={() => openSolve(set.id, { cycle: v.cycle, start: b.start })} />
        ))}
      </View>

      <View style={styles.actions}>
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

/** The cycle's numbers: solved, clean, time a puzzle against the target, and one line of advice. */
function CurrentCycle({ v, t }: { v: SetView; t: TFn }) {
  const avg = v.current?.avgSec ?? null;
  const over = v.target != null && avg != null && avg > v.target;
  const shown = v.complete ? v.nextTarget : v.target;
  const note = v.complete
    ? `${v.nextTarget != null ? t('woodpecker.done_note', { avg: clock(avg ?? 0), clean: v.cleanPct ?? 0, target: clock(v.nextTarget) }) : t('woodpecker.done_note_free', { avg: clock(avg ?? 0), clean: v.cleanPct ?? 0 })} ${t('woodpecker.done_rest')}`
    : v.target != null
      ? t('woodpecker.target_note', { target: clock(v.target) })
      : t('woodpecker.first_note');
  return (
    <View style={[styles.card, v.complete && styles.cardDone]} testID="woodpecker-current">
      <View style={styles.stats}>
        <Stat label={t('woodpecker.stat.solved')} value={`${v.done}/${v.total}`} testID="woodpecker-stat-solved" />
        <Stat label={t('woodpecker.stat.clean')} value={v.cleanPct != null ? `${v.cleanPct}%` : '—'} testID="woodpecker-stat-clean" />
        <Stat label={t('woodpecker.stat.avg')} value={avg != null ? clock(avg) : '—'} color={over ? tone.rose : avg != null && v.target != null ? tone.sage : undefined} testID="woodpecker-stat-avg" />
        <Stat
          label={v.complete ? t('woodpecker.stat.next_target') : t('woodpecker.stat.target')}
          value={shown != null ? clock(shown) : '—'}
          testID="woodpecker-stat-target"
        />
      </View>
      <ProgressBar value={v.total ? v.done / v.total : 0} height={4} trackColor={eos.well} style={styles.bar} />
      <AppText variant="caption" color={v.complete ? tone.sage : eos.ash} style={styles.note} testID="woodpecker-note">
        {note}
      </AppText>
    </View>
  );
}

function Stat({ label, value, color, testID }: { label: string; value: string; color?: string; testID: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="valueSm" color={color} numberOfLines={1} adjustsFontSizeToFit testID={testID}>
        {value}
      </AppText>
      <AppText variant="label" numberOfLines={1} style={styles.statLabel}>
        {label}
      </AppText>
    </View>
  );
}

function BlockItem({ b, onPress }: { b: BlockRow; onPress: () => void }) {
  const t = useT();
  return (
    <Tap
      testID={`woodpecker-block-${b.index}`}
      accessibilityRole="button"
      accessibilityLabel={t('woodpecker.block_a11y', { n: b.index + 1, done: b.done, total: b.total })}
      accessibilityState={{ disabled: b.complete }}
      disabled={b.complete}
      onPress={onPress}
      style={[styles.block, b.index > 0 && styles.blockSeam, b.current && styles.blockNow]}
    >
      <View style={[styles.badge, b.complete ? styles.badgeDone : b.current ? styles.badgeNow : styles.badgeLater]}>
        {b.complete ? (
          <Check size={14} color={tone.sageDeep} strokeWidth={2.4} />
        ) : (
          <AppText variant="captionStrong" color={b.current ? eos.bone : eos.dust}>
            {String(b.index + 1)}
          </AppText>
        )}
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={b.complete || b.current ? eos.bone : graphite[300]}>
          {t('woodpecker.block', { n: b.index + 1 })}
        </AppText>
        <AppText variant="caption" color={tone.mist}>
          {t('woodpecker.block_range', { from: b.from, to: b.to })}
        </AppText>
        {b.current && b.done > 0 ? <ProgressBar value={b.done / b.total} height={3} trackColor={eos.well} style={styles.blockBar} /> : null}
      </View>
      <AppText variant="captionStrong" color={b.complete ? tone.sageDeep : b.done > 0 ? eos.ash : tone.pewter} style={styles.tabular} testID={`woodpecker-block-${b.index}-count`}>
        {`${b.done} / ${b.total}`}
      </AppText>
    </Tap>
  );
}

/** New set over an active one: the form, then the old set goes to the archive. */
function NewSetSheet({ replace, onClose }: { replace: string; onClose: () => void }) {
  const f = useCreateForm(replace, (set: WoodpeckerSet) => {
    onClose();
    router.setParams({ set: set.id });
  });
  const { t } = f;
  return (
    <Sheet visible onClose={onClose} testID="woodpecker-new-sheet" closeLabel={t('woodpecker.cancel')} dismissible={!f.busy}>
      <AppText variant="sectionTitle" style={styles.sheetTitle}>
        {t('woodpecker.new_set')}
      </AppText>
      <AppText variant="caption" color={eos.ash}>
        {t('woodpecker.method')}
      </AppText>
      <CreateSetForm f={f} replacing />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1, minWidth: 0 },
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
  chart: { marginTop: space[6] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space[3], columnGap: space[2] },
  stat: { width: '48%', minWidth: 0 },
  statLabel: { fontSize: 10, marginTop: 2 },
  bar: { marginTop: space[3] },
  note: { marginTop: space[2.5], lineHeight: 17 },
  sectionHead: { marginTop: space[5], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  blocks: { marginTop: space[2], borderRadius: radii.xl, backgroundColor: eos.slate, overflow: 'hidden' },
  block: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[3.5], minHeight: 56 },
  blockSeam: { borderTopWidth: 1, borderTopColor: graphite[800] },
  blockNow: { backgroundColor: alpha(eos.ember, 0.1) },
  blockBar: { marginTop: space[1.5] },
  badge: { width: 28, height: 28, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  badgeDone: { backgroundColor: alpha(tone.sageDeep, 0.16) },
  badgeNow: { borderWidth: 1.5, borderColor: eos.ember },
  badgeLater: { borderWidth: 1.5, borderColor: eos.seam },
  actions: { marginTop: space[4], flexDirection: 'row', flexWrap: 'wrap', gap: space[5] },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  sheetTitle: { marginBottom: space[1] },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space[6], paddingHorizontal: layout.gutter },
});

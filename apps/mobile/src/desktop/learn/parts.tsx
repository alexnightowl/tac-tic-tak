import { cycleTargetSec, type BookProgress } from '@tac/core/library';
import { alpha, eos, tone } from '@tac/core/tokens';
import { router, usePathname, type Href } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { setLearnSegment, type LearnSegment } from '@/features/learn/segment';
import { useRawWindow } from '@/platform/webFrame';
import { useT, type TFn } from '@/ui/lang';
import { DText, Label, Seg } from '../kit';
import { dx, dxSize } from '../tokens';

// Pieces the Learn-area desktop pages share: the Курси / Книги switch in
// the page header, the page width for the grids, the cycle pills.

/**
 * The header switch (DXLearn / DXBooks / DXCourse / DXBook): it sets the
 * Learn tab's pane (per user, as the phone's segment does) and, off the
 * Learn page, goes there.
 */
export function LearnSwitch({ value }: { value: LearnSegment }) {
  const t = useT();
  const path = usePathname();
  return (
    <Seg<LearnSegment>
      testID="dx-learn-switch"
      accessibilityLabel={t('learn.segments_a11y')}
      options={[
        { value: 'courses', label: t('learn.segment.courses'), icon: BookOpen },
        { value: 'books', label: t('learn.segment.books'), icon: BookOpen },
      ]}
      value={value}
      onChange={(v) => {
        setLearnSegment(v);
        if (path !== '/learn') router.navigate('/learn' as Href);
      }}
      style={styles.switch}
    />
  );
}

/**
 * The page body's width: the real window less the sidebar and the side
 * padding, and less a right column of `aside` px: the grids pick their
 * column count from it.
 */
export function usePageWidth(aside = 0): number {
  const { width } = useRawWindow();
  const body = width - dxSize.sidebar - 2 * dxSize.padX;
  return Math.max(0, body - (aside ? aside + dxSize.gap : 0));
}

/** Column width for `cols` columns `gap` apart in `w`. */
export const colWidth = (w: number, cols: number, gap: number) => Math.floor((w - gap * (cols - 1)) / cols);

type PillKind = 'done' | 'now' | 'later';

/** Three cycles around the current one (the phone's cycles strip as pills). */
export function cyclePills(p: BookProgress, t: TFn): { n: number; kind: PillKind; label: string }[] {
  const c = p.cycle;
  const start = p.cycleComplete ? c : Math.max(1, c - 1);
  return [0, 1, 2].map((i) => {
    const n = start + i;
    const stats = p.cycles.find((x) => x.cycle === n);
    const done = !!stats?.complete && !(n === c && !p.cycleComplete);
    const now = p.cycleComplete ? n === c + 1 : n === c;
    const target = cycleTargetSec(p.cycles, n);
    const label = done
      ? t('dx.learn.cycle_pill_done', { n, s: stats?.avgSec ?? 0 })
      : target != null
        ? t('dx.learn.cycle_pill_target', { n, s: target })
        : n === 1
          ? t('dx.learn.cycle_pill_first', { n })
          : t('dx.learn.cycle_pill_later', { n });
    return { n, kind: done ? 'done' : now ? 'now' : 'later', label };
  });
}

export function CyclePills({ progress, testID }: { progress: BookProgress; testID: string }) {
  const t = useT();
  return (
    <View style={styles.pills} testID={testID}>
      {cyclePills(progress, t).map((b) => (
        <View key={b.n} style={[styles.pill, PILL_BG[b.kind]]} testID={`${testID}-${b.n}`}>
          <DText size={11.5} weight={800} color={b.kind === 'done' ? eos.sage : b.kind === 'now' ? tone.roseSoft : dx.dust} numberOfLines={1}>
            {b.label}
          </DText>
        </View>
      ))}
    </View>
  );
}

/** "Розділи … 3 з 10 пройдено" row over a list. */
export function SectionHead({ label, right, testID }: { label: string; right?: string; testID?: string }) {
  return (
    <View style={styles.head}>
      <Label>{label}</Label>
      <View style={styles.flex} />
      {right ? (
        <DText size={12.5} color={dx.dust} testID={testID}>
          {right}
        </DText>
      ) : null}
    </View>
  );
}

const PILL_BG = StyleSheet.create({
  done: { backgroundColor: alpha(dx.sage, 0.14) },
  now: { backgroundColor: alpha(eos.ember, 0.18) },
  later: { backgroundColor: dx.card2 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switch: { width: 320 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pill: { height: 24, paddingHorizontal: 9, borderRadius: 999, justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
});

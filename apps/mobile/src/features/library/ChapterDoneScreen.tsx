import { bookProgress, chapterCycleStats, cycleTargetSec, localized, type ChapterCycleStats } from '@tac/core/library';
import { alpha, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { ArrowRight, Clock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, PlateButton, Tap, useLang } from '@/ui';
import { plural } from '@/features/offline/format';
import { useT, useTn } from '@/ui/lang';
import { BookCover } from './BookCover';
import { openSolve } from './BookScreen';
import { roman, useBookSummary } from './model';
import { useAttempts } from './store';

// /library/done?book&chapter&cycle (canvas LibChapterDone): the chapter's
// cycle against the one before (average time, right answers, a bar per
// puzzle), the next cycle's target, and the way on.

const DAY_MS = 24 * 60 * 60 * 1000;
const BAR_MAX = 56;

export function ChapterDoneScreen({ bookId, chapter, cycle }: { bookId: string; chapter: number; cycle: number }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const book = useBookSummary(bookId);
  const attempts = useAttempts();
  const [openedAt] = useState(() => Date.now());

  const data = useMemo(() => {
    if (!book || !book.chapters[chapter]) return null;
    const ids = book.chapters[chapter].puzzleIds;
    const now = chapterCycleStats(book.id, ids, attempts, cycle);
    const prev = cycle > 1 ? chapterCycleStats(book.id, ids, attempts, cycle - 1) : null;
    const progress = bookProgress(book, attempts);
    return { now, prev, progress };
  }, [book, chapter, cycle, attempts]);

  if (!book || !data) {
    return (
      <View style={[styles.root, styles.center]} testID="library-done">
        <ActivityIndicator color={eos.ash} />
      </View>
    );
  }

  const { now, prev, progress } = data;
  const c = book.chapters[chapter];
  const bookDone = progress.cycle === cycle && progress.cycleComplete;
  const nextTarget = cycleTargetSec(progress.cycles, cycle + 1);

  // The way on: the next chapter of this cycle still to read, else a new cycle.
  const nextIndex = progress.cycle === cycle ? progress.next?.chapterIndex ?? null : null;
  const next = nextIndex != null ? book.chapters[nextIndex] : null;

  let lede: string;
  if (!prev || prev.avgSec == null || now.avgSec == null) {
    lede = t('library.done.first', { clean: now.clean, total: now.total });
  } else {
    const days = prev.startedAt ? Math.floor((openedAt - Date.parse(prev.startedAt)) / DAY_MS) : 0;
    const ago = days <= 0 ? t('library.done.ago_today') : days === 1 ? t('library.done.ago_yesterday') : plural(tn, 'library.done.ago_days', days);
    const pct = Math.round((1 - now.avgSec / Math.max(1, prev.avgSec)) * 100);
    lede = pct > 0 ? t('library.done.faster', { total: now.total, ago, pct }) : t('library.done.slower', { total: now.total, ago });
  }

  const toBook = () => router.dismissTo(`/library/${bookId}` as Href);

  return (
    <View style={styles.root} testID="library-done">
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space[6], paddingBottom: 160 + insets.bottom }]}>
        <View style={styles.hero}>
          <View style={styles.coverTilt}>
            <BookCover book={book} width={120} />
            <View style={styles.seal}>
              <LinearGradient colors={[tone.sealTop, eos.ember, eos.embers]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
              <AppText variant="navTitle" color={tone.parchment}>
                {roman(chapter + 1)}
              </AppText>
            </View>
          </View>
          <AppText variant="label" color={tone.gold} style={styles.kicker} testID="library-done-kicker">
            {bookDone ? t('library.done.kicker_book', { n: cycle }) : t('library.done.kicker', { n: cycle })}
          </AppText>
          <AppText variant="heading" accessibilityRole="header" style={styles.title}>
            {localized(c.title, lang)}
          </AppText>
          <AppText variant="body" color={eos.ash} style={styles.lede} testID="library-done-lede">
            {lede}
          </AppText>
        </View>

        <View style={styles.card} testID="library-done-stats">
          <View style={styles.compare}>
            {prev ? <CycleColumn stats={prev} dim /> : null}
            {prev ? <ArrowRight size={20} color={eos.dust} strokeWidth={2} /> : null}
            <CycleColumn stats={now} />
          </View>
          <Bars stats={now} />
          <View style={styles.barsFoot}>
            <AppText variant="caption" color={eos.dust}>
              {t('library.done.time_per')}
            </AppText>
            <AppText variant="caption" color={eos.dust} testID="library-done-misses">
              {now.missed > 0 ? plural(tn, 'library.done.misses', now.missed) : t('library.done.no_misses')}
            </AppText>
          </View>
        </View>

        {nextTarget != null ? (
          <View style={styles.target} testID="library-done-target">
            <Clock size={22} color={tone.gold} strokeWidth={1.8} />
            <AppText variant="body" color={tone.goldInk} style={styles.flex}>
              {t('library.done.target', { n: cycle + 1, s: nextTarget })}
            </AppText>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]}>
        {next && nextIndex != null ? (
          <PlateButton
            testID="library-done-next"
            label={t('library.done.next', { ch: roman(nextIndex + 1), title: localized(next.title, lang) })}
            size="lg"
            block
            onPress={() => openSolve(bookId, { chapter: nextIndex, cycle }, true)}
          />
        ) : (
          <PlateButton
            testID="library-done-again"
            label={t('library.done.again', { n: cycle + 1 })}
            size="lg"
            block
            onPress={() => openSolve(bookId, { chapter: 0, cycle: cycle + 1 }, true)}
          />
        )}
        <Tap testID="library-done-back" accessibilityRole="button" accessibilityLabel={t('library.done.back')} onPress={toBook} style={styles.backBtn}>
          <AppText variant="body" color={eos.ash}>
            {t('library.done.back')}
          </AppText>
        </Tap>
      </View>
    </View>
  );
}

function CycleColumn({ stats, dim = false }: { stats: ChapterCycleStats; dim?: boolean }) {
  const t = useT();
  return (
    <View style={styles.column} testID={`library-done-cycle-${stats.cycle}`}>
      <AppText variant="label" color={dim ? eos.ash : tone.roseSoft}>
        {t('library.done.cycle', { n: stats.cycle })}
      </AppText>
      <AppText variant="value" color={dim ? tone.mist : eos.bone} style={styles.big}>
        {t('library.done.sec', { s: stats.avgSec ?? 0 })}
      </AppText>
      <AppText variant="caption" color={dim ? eos.dust : tone.sage}>
        {t('library.done.right', { clean: stats.clean, total: stats.total })}
      </AppText>
    </View>
  );
}

function Bars({ stats }: { stats: ChapterCycleStats }) {
  const t = useT();
  const max = Math.max(1, ...stats.times.map((x) => x ?? 0));
  const slowest = stats.times.indexOf(max);
  return (
    <View
      style={styles.bars}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('library.done.chart_a11y', { list: stats.times.map((x) => (x == null ? '–' : Math.round(x))).join(', ') })}
    >
      {stats.times.map((x, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: x == null ? 2 : Math.max(4, Math.round((x / max) * BAR_MAX)) },
            { backgroundColor: i === slowest ? tone.rose : alpha(eos.ember, 0.8) },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  scroll: { paddingHorizontal: layout.gutter },
  hero: { alignItems: 'center', paddingHorizontal: space[1] },
  coverTilt: { transform: [{ rotate: '-4deg' }] },
  seal: {
    position: 'absolute',
    right: -16,
    bottom: -12,
    width: 52,
    height: 52,
    borderRadius: radii.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: tone.gold,
    transform: [{ rotate: '4deg' }],
  },
  kicker: { marginTop: 26 },
  title: { marginTop: space[1.5], textAlign: 'center' },
  lede: { marginTop: space[2], maxWidth: 320, textAlign: 'center', lineHeight: 21 },
  card: { marginTop: 22, padding: space[4], borderRadius: radii.xl, backgroundColor: eos.slate, borderWidth: 1, borderColor: alpha(eos.bone, 0.05) },
  compare: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[3] },
  column: { flex: 1, alignItems: 'center' },
  big: { marginTop: space[1], fontSize: 26 },
  bars: { marginTop: space[4], height: BAR_MAX, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barsFoot: { marginTop: space[1.5], flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  target: {
    marginTop: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3.5],
    borderRadius: radii.xl,
    backgroundColor: alpha(tone.gold, 0.08),
    borderWidth: 1,
    borderColor: alpha(tone.gold, 0.3),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space[4], gap: space[1.5], backgroundColor: eos.ink },
  backBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
});

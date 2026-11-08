import { cycleTargetSec, localized, type BookProgress, type LibraryBookSummary } from '@tac/core/library';
import { alpha, eos, graphite, layout, radii, space, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Check, ChevronLeft, Download, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HAS_OFFLINE } from '@/platform/capabilities';
import { toast } from '@/shell/toast/store';
import { AppText, PlateButton, ProgressBar, Tap, useLang } from '@/ui';
import { useT } from '@/ui/lang';
import { BookCover } from './BookCover';
import { roman, useBookProgress, useBookSummary, useDownloadView, useShelf } from './model';
import { bookBytes, useLibraryStore } from './store';
import { downloadBook } from './sync';

// /library/[bookId] (canvas LibBook; LearnOpenBook's end state: the
// title-page cover under an ember glow): cover, description, numbers, the
// cycles strip, chapters with progress, and the docked Continue CTA. The
// header chip is the download state (Download / Downloading / Offline).

const DOCK_H = layout.plateHeight.lg + space[6] + space[8];

export type SolveTarget = { chapter: number; cycle: number };

/** Where Continue goes: the next puzzle of this cycle, or the top of the next one. */
export function continueTarget(p: BookProgress): SolveTarget {
  if (p.cycleComplete || !p.next) return { chapter: 0, cycle: p.cycle + 1 };
  return { chapter: p.next.chapterIndex, cycle: p.cycle };
}

export function openSolve(bookId: string, to: SolveTarget, replace = false) {
  const href = `/library/solve?book=${bookId}&chapter=${to.chapter}&cycle=${to.cycle}` as Href;
  if (replace) router.replace(href);
  else router.push(href);
}

export function BookScreen({ bookId }: { bookId: string }) {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  // A deep link can land here first: the shelf brings the summary (and
  // newer content for a downloaded copy).
  useShelf();
  const book = useBookSummary(bookId);
  const progress = useBookProgress(book);
  // Opened from a Learn cover: the page fades in under the open-book
  // transition (and fades out on back) instead of sliding.
  const { via } = useLocalSearchParams<{ via?: string }>();
  const fade = via === 'cover' ? <Stack.Screen options={{ animation: 'fade' }} /> : null;

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/learn' as Href);
  };

  if (!book || !progress) {
    return (
      <View style={[styles.root, styles.center]} testID="library-book">
        {fade}
        <ActivityIndicator color={eos.ash} />
      </View>
    );
  }

  const cta = progress.started
    ? progress.cycleComplete
      ? t('library.cta_again', { n: progress.cycle + 1 })
      : progress.next
        ? t('library.cta_continue', { ch: roman(progress.next.chapterIndex + 1), n: progress.next.puzzleIndex + 1 })
        : t('library.cta_start')
    : t('library.cta_start');

  const openChapter = (index: number) => {
    const ch = progress.chapters[index];
    if (ch.complete) router.push(`/library/done?book=${bookId}&chapter=${index}&cycle=${progress.cycle}` as Href);
    else openSolve(bookId, { chapter: index, cycle: progress.cycle });
  };

  return (
    <View style={styles.root} testID="library-book">
      {fade}
      <View style={[styles.header, { marginTop: insets.top }]}>
        <Tap testID="library-book-back" accessibilityRole="button" accessibilityLabel={t('learn.tab')} onPress={back} style={styles.back}>
          <ChevronLeft size={18} color={eos.ash} strokeWidth={1.8} />
          <AppText variant="bodyStrong" color={eos.ash}>
            {t('learn.tab')}
          </AppText>
        </Tap>
        <View style={styles.flex} />
        <DownloadChip bookId={bookId} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: DOCK_H + insets.bottom }]}>
        <View style={styles.hero}>
          <View pointerEvents="none" style={styles.glow}>
            <Svg width={380} height={380}>
              <Defs>
                <RadialGradient id="bookGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={eos.ember} stopOpacity={0.3} />
                  <Stop offset="65%" stopColor={eos.ink} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={190} cy={190} r={190} fill="url(#bookGlow)" />
            </Svg>
          </View>
          <BookCover book={book} width={132} testID="library-book-cover" />
          <View style={styles.heroText}>
            <AppText variant="label" color={tone.rose}>
              {localized(book.era, lang)}
            </AppText>
            <AppText variant="heading" accessibilityRole="header" style={styles.title}>
              {localized(book.title, lang)}
            </AppText>
            <AppText variant="body" color={eos.ash} style={styles.players}>
              {localized(book.players, lang)}
            </AppText>
          </View>
        </View>

        <AppText variant="body" color={graphite[300]} style={styles.description}>
          {localized(book.description, lang)}
        </AppText>

        <View style={styles.stats}>
          <Stat value={String(book.puzzleCount)} label={t('library.stat.puzzles')} />
          <Stat value={`${book.ratingMin}–${book.ratingMax}`} label={t('library.stat.level')} />
          <Stat
            value={book.minutesPerCycle >= 90 ? t('library.hours', { n: Math.round(book.minutesPerCycle / 60) }) : t('library.minutes', { n: book.minutesPerCycle })}
            label={t('library.stat.cycle')}
          />
        </View>

        <CyclesCard progress={progress} />

        <View style={styles.chaptersHead}>
          <AppText variant="label">{t('library.chapters')}</AppText>
          <AppText variant="caption" color={eos.dust} testID="library-solved-of">
            {t('library.solved_of', { done: progress.done, total: progress.total })}
          </AppText>
        </View>
        <View style={styles.chapters}>
          {book.chapters.map((c, i) => (
            <ChapterRow key={c.id} book={book} index={i} progress={progress} onPress={() => openChapter(i)} />
          ))}
        </View>

        <RemoveDownload bookId={bookId} />
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]} pointerEvents="box-none">
        <LinearGradient pointerEvents="none" colors={['transparent', eos.ink]} locations={[0, 0.3]} style={StyleSheet.absoluteFill} />
        <PlateButton testID="library-cta" label={cta} size="lg" block onPress={() => openSolve(bookId, continueTarget(progress))} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="valueSm" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="label" style={styles.statLabel}>
        {label}
      </AppText>
    </View>
  );
}

type CycleBox = { n: number; kind: 'done' | 'now' | 'later'; line: string };

function CyclesCard({ progress }: { progress: BookProgress }) {
  const t = useT();
  const c = progress.cycle;
  const start = progress.cycleComplete ? c : Math.max(1, c - 1);
  const boxes: CycleBox[] = [0, 1, 2].map((i) => {
    const n = start + i;
    const stats = progress.cycles.find((x) => x.cycle === n);
    const done = !!stats?.complete && !(n === c && !progress.cycleComplete);
    const now = progress.cycleComplete ? n === c + 1 : n === c;
    const target = cycleTargetSec(progress.cycles, n);
    const line = done
      ? t('library.cycle_avg', { s: stats?.avgSec ?? 0 })
      : target != null
        ? t('library.cycle_target', { s: target })
        : n === 1
          ? t('library.cycle_first')
          : '—';
    return { n, kind: done ? 'done' : now ? 'now' : 'later', line };
  });
  return (
    <View style={styles.cycles} testID="library-cycles">
      <View style={styles.cyclesHead}>
        <AppText variant="label">{t('library.cycles')}</AppText>
        <AppText variant="caption" color={eos.ash}>
          {t('library.cycles_hint')}
        </AppText>
      </View>
      <View style={styles.cycleRow}>
        {boxes.map((b) => (
          <View key={b.n} style={[styles.cycleBox, styles[`cycle_${b.kind}`]]} testID={`library-cycle-${b.n}`}>
            <AppText
              variant="captionStrong"
              numberOfLines={1}
              color={b.kind === 'done' ? tone.sage : b.kind === 'now' ? tone.roseSoft : eos.dust}
              style={styles.cycleKicker}
            >
              {b.kind === 'done' ? t('library.cycle_done', { n: b.n }) : b.kind === 'now' ? t('library.cycle_now', { n: b.n }) : t('library.cycle_next', { n: b.n })}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1} color={b.kind === 'later' ? tone.mist : eos.bone}>
              {b.line}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function ChapterRow({ book, index, progress, onPress }: { book: LibraryBookSummary; index: number; progress: BookProgress; onPress: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const c = book.chapters[index];
  const p = progress.chapters[index];
  const current = !progress.cycleComplete && progress.next?.chapterIndex === index;
  const title = localized(c.title, lang);
  return (
    <Tap
      testID={`library-chapter-${index}`}
      accessibilityRole="button"
      accessibilityLabel={t('library.chapter_a11y', { n: index + 1, title, done: p.done, total: p.total })}
      onPress={onPress}
      style={[styles.chapter, index > 0 && styles.chapterSeam, current && styles.chapterNow]}
    >
      {p.complete ? (
        <View style={[styles.badge, styles.badgeDone]}>
          <Check size={14} color={tone.sageDeep} strokeWidth={2.4} />
        </View>
      ) : (
        <View style={[styles.badge, current ? styles.badgeNow : styles.badgeLater]}>
          <AppText variant="turnTitle" color={current ? eos.bone : eos.dust} style={styles.roman}>
            {roman(index + 1)}
          </AppText>
        </View>
      )}
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={p.complete || current ? eos.bone : graphite[300]} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color={tone.mist} numberOfLines={1}>
          {localized(c.subtitle, lang)}
        </AppText>
        {current && p.done > 0 ? <ProgressBar value={p.done / p.total} height={3} trackColor={eos.well} style={styles.chapterBar} /> : null}
      </View>
      <AppText
        variant="captionStrong"
        color={p.complete ? tone.sageDeep : p.done > 0 ? eos.ash : tone.pewter}
        style={styles.tabular}
        testID={`library-chapter-${index}-count`}
      >
        {`${p.done} / ${p.total}`}
      </AppText>
    </Tap>
  );
}

/** Offline copies are app-only (platform/capabilities). */
function DownloadChip({ bookId }: { bookId: string }) {
  return HAS_OFFLINE ? <DownloadChipInner bookId={bookId} /> : null;
}

function DownloadChipInner({ bookId }: { bookId: string }) {
  const t = useT();
  const state = useDownloadView(bookId);
  const failed = useLibraryStore((s) => s.downloads[bookId] === 'error' || s.downloads[bookId] === 'offline');
  if (state === 'downloaded') {
    return (
      <View style={[styles.chip, styles.chipOffline]} testID="library-offline-chip">
        <Check size={14} color={tone.sageDeep} strokeWidth={2.4} />
        <AppText variant="captionStrong" color={tone.sage}>
          {t('library.offline_chip')}
        </AppText>
      </View>
    );
  }
  if (state === 'downloading') {
    return (
      <View style={[styles.chip, styles.chipIdle]} testID="library-downloading">
        <ActivityIndicator size="small" color={tone.copper} style={styles.chipSpinner} />
        <AppText variant="captionStrong" color={eos.ash}>
          {t('library.downloading')}
        </AppText>
      </View>
    );
  }
  return (
    <Tap
      testID="library-download"
      accessibilityRole="button"
      accessibilityLabel={failed ? t('library.download_failed') : t('library.download')}
      onPress={() => void downloadBook(bookId)}
      hitSlop={{ top: 9, bottom: 9 }}
      style={[styles.chip, styles.chipIdle]}
    >
      <Download size={14} color={failed ? tone.rose : eos.bone} strokeWidth={2} />
      <AppText variant="captionStrong" color={failed ? tone.rose : eos.bone}>
        {failed ? t('library.download_failed') : t('library.download')}
      </AppText>
    </Tap>
  );
}

function RemoveDownload({ bookId }: { bookId: string }) {
  const t = useT();
  const stored = useLibraryStore((s) => s.books[bookId]);
  if (!stored) return null;
  const kb = Math.max(1, Math.round(bookBytes(stored) / 1024));
  return (
    <Tap
      testID="library-remove"
      accessibilityRole="button"
      accessibilityLabel={t('library.remove_a11y')}
      onPress={() => {
        useLibraryStore.getState().removeBook(bookId);
        toast.show({ title: t('library.removed') });
      }}
      style={styles.remove}
    >
      <Trash2 size={16} color={eos.ash} strokeWidth={1.8} />
      <AppText variant="bodyStrong" color={eos.ash}>
        {t('library.remove')}
      </AppText>
      <AppText variant="caption" color={eos.dust}>
        {t('library.size', { kb })}
      </AppText>
    </Tap>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  back: { height: layout.headerButton, paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space[1] },
  hero: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  glow: { position: 'absolute', left: '50%', top: -44, marginLeft: -190 },
  heroText: { flex: 1, minWidth: 0, paddingBottom: space[1] },
  title: { marginTop: space[1], fontSize: 24, lineHeight: 29 },
  players: { marginTop: space[1], fontSize: 13 },
  description: { marginTop: space[4], lineHeight: 21 },
  stats: { marginTop: 14, flexDirection: 'row', gap: space[2] },
  stat: { flex: 1, padding: space[2.5], borderRadius: radii.lg, backgroundColor: eos.slate },
  statLabel: { fontSize: 10 },
  cycles: {
    marginTop: space[3],
    padding: space[3.5],
    borderRadius: radii.xl,
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: alpha(eos.bone, 0.05),
  },
  cyclesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] },
  cycleRow: { marginTop: space[2.5], flexDirection: 'row', gap: space[2] },
  cycleBox: { flex: 1, minWidth: 0, paddingVertical: space[2], paddingHorizontal: space[2.5], borderRadius: radii.md, borderWidth: 1 },
  cycle_done: { backgroundColor: alpha(tone.sageDeep, 0.1), borderColor: alpha(tone.sageDeep, 0.35) },
  cycle_now: { backgroundColor: alpha(eos.ember, 0.14), borderColor: alpha(eos.ember, 0.6) },
  cycle_later: { backgroundColor: eos.well, borderColor: 'transparent' },
  cycleKicker: { fontSize: 11, textTransform: 'uppercase', marginBottom: space[0.5] },
  chaptersHead: { marginTop: space[5], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  chapters: { marginTop: space[2], borderRadius: radii.xl, backgroundColor: eos.slate, overflow: 'hidden' },
  chapter: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[3.5], minHeight: 56 },
  chapterSeam: { borderTopWidth: 1, borderTopColor: graphite[800] },
  chapterNow: { backgroundColor: alpha(eos.ember, 0.1) },
  chapterBar: { marginTop: space[1.5] },
  badge: { width: 28, height: 28, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  badgeDone: { backgroundColor: alpha(tone.sageDeep, 0.16) },
  badgeNow: { borderWidth: 1.5, borderColor: eos.ember },
  badgeLater: { borderWidth: 1.5, borderColor: eos.seam },
  roman: { fontSize: 12 },
  chip: { height: 26, paddingHorizontal: space[2.5], marginRight: space[2], borderRadius: radii.full, flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  chipOffline: { backgroundColor: alpha(tone.sageDeep, 0.14) },
  chipIdle: { backgroundColor: eos.rise },
  chipSpinner: { transform: [{ scale: 0.6 }] },
  remove: { marginTop: space[4], minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[2], alignSelf: 'flex-start' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space[6], paddingHorizontal: layout.gutter },
});

import { bookProgress, localized, type BookProgress, type LibraryBookSummary } from '@tac/core/library';
import { control, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Check, ChevronLeft, Download, WifiOff } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOffline } from '@/shell/OfflineBanner';
import { AppText, Chip, HeroCard, PlateButton, ProgressBar, Tap, useLang } from '@/ui';
import { plural } from '@/features/offline/format';
import { useT, useTn } from '@/ui/lang';
import { BookCover } from './BookCover';
import { lastReadBookId, useDownloadView, useShelf, type DownloadView } from './model';
import { useAttempts, useLibraryStore } from './store';

// /library (canvas LibShelf): the book read last with "Continue", filter
// chips, and the shelf of covers with progress and the download state.

type Filter = 'all' | 'progress' | 'downloaded' | 'finished';
const FILTERS: readonly Filter[] = ['all', 'progress', 'downloaded', 'finished'];

const GAP = space[4];

export function ShelfScreen() {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const offline = useIsOffline();
  const { width } = useWindowDimensions();
  const { books, load, retry } = useShelf();
  const stored = useLibraryStore((s) => s.books);
  const attempts = useAttempts();
  const [filter, setFilter] = useState<Filter>('all');

  // Offline with no list yet: the downloaded books are the shelf.
  const shelf = useMemo<LibraryBookSummary[]>(() => books ?? Object.values(stored), [books, stored]);
  const progress = useMemo(() => new Map(shelf.map((b) => [b.id, bookProgress(b, attempts)])), [shelf, attempts]);
  const lastId = lastReadBookId(attempts);
  const current = shelf.find((b) => b.id === lastId) ?? null;

  const shown = shelf.filter((b) => {
    const p = progress.get(b.id);
    switch (filter) {
      case 'progress':
        return !!p && p.started && !(p.cycleComplete && p.cycle === 1);
      case 'downloaded':
        return !!stored[b.id];
      case 'finished':
        return !!p?.finishedOnce;
      default:
        return true;
    }
  });

  const cardW = Math.floor((width - layout.gutter * 2 - GAP) / 2);
  const open = (id: string) => router.push(`/library/${id}` as Href);
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/play' as Href);
  };

  return (
    <View style={styles.root} testID="library-shelf">
      <View style={[styles.header, { marginTop: insets.top }]}>
        <Tap testID="library-back" accessibilityRole="button" accessibilityLabel={t('play')} onPress={back} style={styles.back}>
          <ChevronLeft size={18} color={eos.ash} strokeWidth={1.8} />
          <AppText variant="bodyStrong" color={eos.ash}>
            {t('play')}
          </AppText>
        </Tap>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space[10] }]}>
        <AppText variant="heading" accessibilityRole="header">
          {t('library.title')}
        </AppText>

        {current && progress.get(current.id) ? (
          <ContinueCard book={current} progress={progress.get(current.id)!} onPress={() => open(current.id)} />
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsWrap} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip
              key={f}
              testID={`library-filter-${f}`}
              label={t(`library.filter.${f}`)}
              accessibilityLabel={t('library.filter_a11y', { filter: t(`library.filter.${f}`) })}
              selected={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>

        {offline ? (
          <View style={styles.note} testID="library-offline-note">
            <WifiOff size={16} color={eos.ash} />
            <AppText variant="caption" style={styles.flex}>
              {t('library.offline_shelf')}
            </AppText>
          </View>
        ) : null}

        {shelf.length === 0 ? (
          load === 'error' ? (
            <View style={styles.center}>
              <AppText variant="body" color={eos.ash}>
                {t('library.load_failed')}
              </AppText>
              <PlateButton testID="library-retry" label={t('library.retry')} variant="slate" size="sm" onPress={retry} />
            </View>
          ) : (
            <View style={styles.center}>
              <ActivityIndicator color={eos.ash} />
            </View>
          )
        ) : (
          <View style={styles.grid}>
            {shown.map((b) => (
              <ShelfBook key={b.id} book={b} width={cardW} progress={progress.get(b.id)!} onPress={() => open(b.id)} lang={lang} />
            ))}
            {shown.length === 0 ? (
              <AppText variant="body" color={eos.dust} style={styles.empty} testID="library-empty">
                {t('library.empty_filter')}
              </AppText>
            ) : null}
          </View>
        )}

        <AppText variant="caption" color={eos.dust} style={styles.footnote}>
          {t('library.footnote')}
        </AppText>
      </ScrollView>
    </View>
  );
}

function ContinueCard({ book, progress, onPress }: { book: LibraryBookSummary; progress: BookProgress; onPress: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const ch = progress.next ? progress.next.chapterIndex : Math.max(0, book.chapters.length - 1);
  const chapter = book.chapters[ch];
  const nextCycle = progress.cycleComplete ? progress.cycle + 1 : progress.cycle;
  return (
    <HeroCard style={styles.continue} testID="library-continue">
      <BookCover book={book} width={92} />
      <View style={styles.flex}>
        <AppText variant="label" color={tone.rose}>
          {t('library.continue_reading')}
        </AppText>
        <AppText variant="navTitle" numberOfLines={2} style={styles.continueTitle}>
          {localized(book.title, lang)}
        </AppText>
        {chapter ? (
          <AppText variant="caption" color={eos.ash} numberOfLines={1}>
            {t('library.chapter_line', { n: ch + 1, title: localized(chapter.title, lang) })}
          </AppText>
        ) : null}
        <View style={styles.continueBar}>
          <ProgressBar value={progress.total ? progress.done / progress.total : 0} height={5} trackColor={eos.well} style={styles.flex} />
          <AppText variant="captionStrong" color={eos.ash} style={styles.tabular}>
            {`${progress.done} / ${progress.total}`}
          </AppText>
        </View>
        <PlateButton
          testID="library-continue-cta"
          label={progress.cycleComplete ? t('library.start_cycle', { n: nextCycle }) : t('library.continue_cycle', { n: progress.cycle })}
          size="sm"
          onPress={onPress}
          style={styles.continueCta}
        />
      </View>
    </HeroCard>
  );
}

function ShelfBook({
  book,
  width,
  progress,
  onPress,
  lang,
}: {
  book: LibraryBookSummary;
  width: number;
  progress: BookProgress;
  onPress: () => void;
  lang: 'en' | 'uk';
}) {
  const t = useT();
  const tn = useTn();
  const state = useDownloadView(book.id);
  const count = plural(tn, 'library.puzzles', book.puzzleCount);
  // Done until the next cycle starts; mid-cycle it shows the chapter.
  const done = progress.cycleComplete;
  const sub = done
    ? `${count} · ${t('library.card_done')}`
    : progress.started && progress.next
      ? `${count} · ${t('library.card_chapter', { n: progress.next.chapterIndex + 1 })}`
      : count;
  const ratio = progress.total ? progress.done / progress.total : 0;
  return (
    <Tap
      testID={`library-book-${book.id}`}
      accessibilityRole="button"
      accessibilityLabel={t('library.book_a11y', { title: localized(book.title, lang), count: sub, state: t(`library.state.${state}`) })}
      onPress={onPress}
      style={[styles.book, { width }]}
    >
      <BookCover book={book} width={width} />
      <View style={styles.bookMeta}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {localized(book.title, lang)}
          </AppText>
          <AppText variant="caption" color={tone.mist} numberOfLines={1} testID={`library-book-${book.id}-sub`}>
            {sub}
          </AppText>
        </View>
        <StateIcon state={state} testID={`library-book-${book.id}-state`} />
      </View>
      <ProgressBar
        value={ratio}
        height={4}
        trackColor={eos.slate}
        colors={done ? [tone.sageDeep, tone.sageDeep] : control.rankProgress}
      />
    </Tap>
  );
}

function StateIcon({ state, testID }: { state: DownloadView; testID: string }) {
  if (state === 'downloaded') return <Check testID={testID} size={14} color={tone.sageDeep} strokeWidth={2.4} />;
  if (state === 'downloading') return <ActivityIndicator testID={testID} size="small" color={tone.copper} style={styles.spinner} />;
  return <Download testID={testID} size={14} color={eos.dust} strokeWidth={2} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  back: { height: layout.headerButton, paddingHorizontal: space[3], flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space[1] },
  continue: { marginTop: space[3], padding: space[4], flexDirection: 'row', alignItems: 'center', gap: space[4] },
  continueTitle: { marginTop: space[1] },
  continueBar: { marginTop: space[2.5], flexDirection: 'row', alignItems: 'center', gap: space[2] },
  continueCta: { marginTop: space[3] },
  chipsWrap: { marginTop: space[5], marginHorizontal: -layout.gutter },
  chips: { paddingHorizontal: layout.gutter, gap: space[2] },
  note: {
    marginTop: space[3],
    padding: space[3],
    borderRadius: radii.lg,
    backgroundColor: eos.slate,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  grid: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: space[6] },
  book: { gap: space[2] },
  bookMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1.5] },
  spinner: { transform: [{ scale: 0.7 }], marginTop: -4 },
  center: { paddingVertical: space[10], alignItems: 'center', gap: space[3] },
  empty: { paddingVertical: space[6] },
  footnote: { marginTop: space[6], lineHeight: 18 },
});

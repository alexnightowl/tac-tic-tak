import { bookProgress, localized, type BookProgress, type LibraryBookSummary } from '@tac/core/library';
import { eos, radii, space, tone } from '@tac/core/tokens';
import { WifiOff } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type HostInstance } from 'react-native';

import { BookCover } from '@/features/library/BookCover';
import { lastPlayedIn, useDownloadView, useShelf } from '@/features/library/model';
import { useAttempts, useLibraryStore } from '@/features/library/store';
import { plural } from '@/features/offline/format';
import { useIsOffline } from '@/shell/OfflineBanner';
import { AppText, HeroCard, PlateButton, ProgressBar, Tap, useLang } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { Footnote, FilterChips, GRID_GAP, StatusIcon, TileMeta, type LearnFilter } from './parts';

// Learn → Books (canvas LearnBooks; the old /library shelf): the book read
// last with "Continue reading", filters, the 2-column grid of title-page
// covers with the download state and progress, and the footnote. A cover
// tap opens the book with the open-book transition (OpenBook.tsx).

export type OpenBook = (book: LibraryBookSummary, from: HostInstance | null, chapterIndex: number) => void;

export function BooksPane({ width, onOpen }: { width: number; onOpen: OpenBook }) {
  const t = useT();
  const offline = useIsOffline();
  const { books, load, retry } = useShelf();
  const stored = useLibraryStore((s) => s.books);
  const attempts = useAttempts();
  const [filter, setFilter] = useState<LearnFilter>('all');

  // Offline with no list yet: the downloaded books are the shelf.
  const shelf = useMemo<LibraryBookSummary[]>(() => books ?? Object.values(stored), [books, stored]);
  const progress = useMemo(() => new Map(shelf.map((b) => [b.id, bookProgress(b, attempts)])), [shelf, attempts]);
  const lastId = lastPlayedIn(attempts, new Set(shelf.map((b) => b.id)));
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
  const cardW = Math.floor((width - GRID_GAP) / 2);

  return (
    <View testID="learn-books">
      {current && progress.get(current.id) ? <ContinueBook book={current} progress={progress.get(current.id)!} onOpen={onOpen} /> : null}

      <FilterChips value={filter} onChange={setFilter} testID="library-filter" />

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
            <ShelfBook key={b.id} book={b} width={cardW} progress={progress.get(b.id)!} onOpen={onOpen} />
          ))}
          {shown.length === 0 ? (
            <AppText variant="body" color={eos.dust} style={styles.empty} testID="library-empty">
              {t('library.empty_filter')}
            </AppText>
          ) : null}
        </View>
      )}

      <Footnote>{t('library.footnote')}</Footnote>
    </View>
  );
}

function ContinueBook({ book, progress, onOpen }: { book: LibraryBookSummary; progress: BookProgress; onOpen: OpenBook }) {
  const t = useT();
  const { lang } = useLang();
  const ref = useRef<HostInstance>(null);
  const ch = progress.next ? progress.next.chapterIndex : Math.max(0, book.chapters.length - 1);
  const chapter = book.chapters[ch];
  const nextCycle = progress.cycleComplete ? progress.cycle + 1 : progress.cycle;
  return (
    <HeroCard style={styles.continue} testID="library-continue">
      <View ref={ref} collapsable={false}>
        <BookCover book={book} width={92} small />
      </View>
      <View style={styles.flex}>
        <AppText variant="label" color={tone.rose}>
          {t('library.continue_reading')}
        </AppText>
        <AppText variant="navTitle" style={styles.continueTitle}>
          {localized(book.title, lang)}
        </AppText>
        {chapter ? (
          <AppText variant="caption" color={eos.ash} style={styles.line}>
            {t('library.chapter_line', { n: ch + 1, title: localized(chapter.title, lang) })}
          </AppText>
        ) : null}
        <View style={styles.bar}>
          <ProgressBar value={progress.total ? progress.done / progress.total : 0} height={5} trackColor={eos.well} style={styles.flex} />
          <AppText variant="captionStrong" color={eos.ash} style={styles.tabular}>
            {`${progress.done} / ${progress.total}`}
          </AppText>
        </View>
        <PlateButton
          testID="library-continue-cta"
          label={progress.cycleComplete ? t('library.start_cycle', { n: nextCycle }) : t('library.continue_cycle', { n: progress.cycle })}
          size="sm"
          onPress={() => onOpen(book, ref.current, ch)}
          style={styles.cta}
        />
      </View>
    </HeroCard>
  );
}

function ShelfBook({ book, width, progress, onOpen }: { book: LibraryBookSummary; width: number; progress: BookProgress; onOpen: OpenBook }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const ref = useRef<HostInstance>(null);
  const state = useDownloadView(book.id);
  const count = plural(tn, 'library.puzzles', book.puzzleCount);
  // Done until the next cycle starts; mid-cycle it shows the chapter.
  const done = progress.cycleComplete;
  const sub = done
    ? `${count} · ${t('library.card_done')}`
    : progress.started && progress.next
      ? `${count} · ${t('library.card_chapter', { n: progress.next.chapterIndex + 1 })}`
      : count;
  const title = localized(book.title, lang);
  return (
    <Tap
      testID={`library-book-${book.id}`}
      accessibilityRole="button"
      accessibilityLabel={t('library.book_a11y', { title, count: sub, state: t(`library.state.${state}`) })}
      onPress={() => onOpen(book, ref.current, progress.next?.chapterIndex ?? 0)}
      style={[styles.book, { width }]}
    >
      <View ref={ref} collapsable={false}>
        <BookCover book={book} width={width} />
      </View>
      <TileMeta
        title={title}
        status={sub}
        icon={<StatusIcon state={state} testID={`library-book-${book.id}-state`} />}
        ratio={progress.total ? progress.done / progress.total : 0}
        done={done}
        testID={`library-book-${book.id}`}
      />
    </Tap>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  continue: { marginTop: space[4], padding: space[4], flexDirection: 'row', alignItems: 'center', gap: space[4] },
  continueTitle: { marginTop: space[1], fontSize: 19, lineHeight: 24 },
  line: { marginTop: space[0.5], fontSize: 12.5 },
  bar: { marginTop: space[2.5], flexDirection: 'row', alignItems: 'center', gap: space[2] },
  cta: { marginTop: space[3] },
  note: {
    marginTop: space[3],
    padding: space[3],
    borderRadius: radii.lg,
    backgroundColor: eos.slate,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  grid: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', columnGap: GRID_GAP, rowGap: space[6] },
  book: { gap: space[2] },
  center: { paddingVertical: space[10], alignItems: 'center', gap: space[3] },
  empty: { paddingVertical: space[6] },
});

import { localized, type BookProgress, type LibraryBookSummary } from '@tac/core/library';
import { alpha, eos, graphite } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { setLearnSegment } from '@/features/learn/segment';
import { BookCover } from '@/features/library/BookCover';
import { continueTarget, openSolve } from '@/features/library/BookScreen';
import { roman, useBookProgress, useBookSummary, useShelf } from '@/features/library/model';
import { useRawWindow } from '@/platform/webFrame';
import { PlateButton } from '@/ui';
import { useLang, useT } from '@/ui/lang';
import { Bar, DText, Hover, Label, Num, RowRule, Tile, Title } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { CyclePills, LearnSwitch, SectionHead } from './parts';

// /library/[bookId] on a desktop window (canvas DXBook): the cover and the
// Continue plate on the left; era, title, players, description, the
// numbers with the cycles, and the chapters on the right. Same data and
// actions as the phone book page (BookScreen).

export function DxBook({ bookId }: { bookId: string }) {
  const t = useT();
  const { lang } = useLang();
  useShelf();
  const book = useBookSummary(bookId);
  const progress = useBookProgress(book);
  const { width: winW } = useRawWindow();
  const back = {
    label: t('learn.segment.books'),
    onPress: () => {
      setLearnSegment('books');
      if (router.canGoBack()) router.back();
      else router.replace('/learn' as Href);
    },
  };

  if (!book || !progress) {
    return (
      <DesktopPage testID="dx-book" title={t('learn.title')} back={back} right={<LearnSwitch value="books" />}>
        <View style={styles.center}>
          <ActivityIndicator color={eos.ash} />
        </View>
      </DesktopPage>
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
    if (progress.chapters[index].complete) router.push(`/library/done?book=${bookId}&chapter=${index}&cycle=${progress.cycle}` as Href);
    else openSolve(bookId, { chapter: index, cycle: progress.cycle });
  };
  const leftW = winW < 1280 ? 260 : 320;
  const coverW = leftW - 20;

  return (
    <DesktopPage testID="dx-book" title={localized(book.title, lang)} back={back} right={<LearnSwitch value="books" />}>
      <View style={styles.cols}>
        <View style={[styles.left, { width: leftW }]}>
          <BookCover book={book} width={coverW} testID="dx-book-cover" />
          <PlateButton testID="dx-book-cta" label={cta} size={leftW < 300 ? 'sm' : 'md'} block onPress={() => openSolve(bookId, continueTarget(progress))} />
        </View>

        <View style={styles.flex}>
          <Label color={dx.rose}>{localized(book.era, lang)}</Label>
          <Title size={36} style={styles.mt4}>
            {localized(book.title, lang)}
          </Title>
          <DText size={14} color={dx.ash} style={styles.mt2}>
            {localized(book.players, lang)}
          </DText>
          <DText size={15} lh={24} color={graphite[300]} style={styles.description}>
            {localized(book.description, lang)}
          </DText>

          <View style={styles.stats}>
            <Stat value={String(book.puzzleCount)} label={t('library.stat.puzzles')} />
            <Stat value={`${book.ratingMin}–${book.ratingMax}`} label={t('library.stat.level')} wide />
            <Stat
              value={book.minutesPerCycle >= 90 ? t('library.hours', { n: Math.round(book.minutesPerCycle / 60) }) : t('library.minutes', { n: book.minutesPerCycle })}
              label={t('library.stat.cycle')}
            />
            <Tile style={styles.cycles} testID="dx-book-cycles-tile">
              <View style={styles.cyclesHead}>
                <Label size={10}>{t('library.cycles')}</Label>
                <DText size={12} color={dx.dust} testID="dx-book-cycles-hint">
                  {t('library.cycles_hint')}
                </DText>
              </View>
              <CyclePills progress={progress} testID="dx-book-cycles" />
            </Tile>
          </View>

          <View style={styles.mt24}>
            <SectionHead label={t('library.chapters')} right={t('library.solved_of', { done: progress.done, total: progress.total })} testID="dx-book-solved-of" />
          </View>
          <View style={styles.list}>
            {book.chapters.map((_, i) => (
              <View key={i}>
                {i > 0 ? <RowRule /> : null}
                <ChapterRow book={book} index={i} progress={progress} onPress={() => openChapter(i)} />
              </View>
            ))}
          </View>
        </View>
      </View>
    </DesktopPage>
  );
}

function Stat({ value, label, wide }: { value: string; label: string; wide?: boolean }) {
  return (
    <Tile style={[styles.stat, wide && styles.statWide]}>
      <Num size={22}>{value}</Num>
      <Label size={10} style={styles.mt4}>
        {label}
      </Label>
    </Tile>
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
    <Hover
      testID={`dx-book-chapter-${index}`}
      accessibilityLabel={t('library.chapter_a11y', { n: index + 1, title, done: p.done, total: p.total })}
      onPress={onPress}
      style={[styles.row, current && styles.rowNow]}
    >
      <View style={[styles.badge, p.complete ? styles.badgeDone : current ? styles.badgeNow : styles.badgeLater]}>
        {p.complete ? (
          <Check size={15} color={dx.sage} strokeWidth={2.4} />
        ) : (
          <DText serif weight={700} size={13} color={current ? eos.bone : dx.dust}>
            {roman(index + 1)}
          </DText>
        )}
      </View>
      <View style={styles.flex}>
        <DText size={14.5} weight={800} numberOfLines={1}>
          {title}
        </DText>
        <DText size={12.5} color={dx.dust} numberOfLines={1}>
          {localized(c.subtitle, lang)}
        </DText>
        {current && p.done > 0 ? <Bar value={p.done / p.total} height={3} style={styles.mt6} /> : null}
      </View>
      <DText size={13} weight={800} color={p.complete ? dx.sage : dx.ash} tabular testID={`dx-book-chapter-${index}-count`}>
        {`${p.done}/${p.total}`}
      </DText>
      <ChevronRight size={16} color={dx.dust} strokeWidth={2} />
    </Hover>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  cyclesHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 2 },
  mt24: { marginTop: 24 },
  center: { paddingVertical: 80, alignItems: 'center' },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 36 },
  left: { alignItems: 'center', gap: 16 },
  description: { marginTop: 14, maxWidth: 620 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  stat: { flexGrow: 1, flexBasis: 110 },
  statWide: { flexBasis: 150 },
  cycles: { flexGrow: 2, flexBasis: 240 },
  list: {
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: dx.card,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  rowNow: { backgroundColor: alpha(eos.ember, 0.1) },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeDone: { backgroundColor: alpha(dx.sage, 0.16) },
  badgeNow: { borderWidth: 1.5, borderColor: eos.ember },
  badgeLater: { borderWidth: 1.5, borderColor: eos.seam },
});

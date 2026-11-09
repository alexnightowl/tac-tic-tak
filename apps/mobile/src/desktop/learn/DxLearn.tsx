import { bookProgress, cycleTargetSec, localized, suggestedCourse, type BookProgress, type CourseProgress, type CourseSummary, type LibraryBookSummary } from '@tac/core/library';
import { levelFor } from '@tac/core/runner';
import { alpha, eos, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Search, Star } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View, type HostInstance } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { CourseEmblem } from '@/features/learn/CourseEmblem';
import { courseColor } from '@/features/learn/courseColor';
import { bookInFilter, courseInFilter, lessonTotals, useCourseProgressMap, useLearnCourses } from '@/features/learn/data';
import { OpenBookOverlay, type OpenBookRun } from '@/features/learn/OpenBook';
import { FILTERS, type LearnFilter } from '@/features/learn/parts';
import { useLearnSegment } from '@/features/learn/segment';
import { BookCover } from '@/features/library/BookCover';
import { lastPlayedIn, useShelf } from '@/features/library/model';
import { useAttempts, useLibraryStore } from '@/features/library/store';
import { plural } from '@/features/offline/format';
import { readLastStyle } from '@/features/play/setupPrefs';
import { useRawWindow } from '@/platform/webFrame';
import { useAppStore } from '@/stores/appStore';
import { PlateButton } from '@/ui';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT, useTn } from '@/ui/lang';
import { Bar, Card, Chip, DText, Hover, Label, Pill, Title } from '../kit';
import { DesktopPage } from '../Page';
import { dx, dxSize } from '../tokens';
import { colWidth, LearnSwitch, usePageWidth } from './parts';

// /learn on a desktop window (canvas DXLearn, DXBooks): the Курси / Книги
// switch in the header picks the pane, as the phone's segment does.

const openCourse = (id: string) => router.push(`/course/${encodeURIComponent(id)}` as Href);

export function DxLearn() {
  const t = useT();
  const [segment] = useLearnSegment();
  const book = useOpenBook();
  return (
    <>
      <DesktopPage
        testID="dx-learn"
        title={t('learn.title')}
        subtitle={segment === 'courses' ? t('learn.subtitle') : t('dx.learn.books_subtitle')}
        right={<LearnSwitch value={segment} />}
      >
        {segment === 'courses' ? <Courses /> : <Books onOpen={book.open} />}
      </DesktopPage>
      {book.overlay}
    </>
  );
}

type OpenBook = (book: LibraryBookSummary, from: HostInstance | null, chapterIndex: number) => void;

/**
 * A cover click opens the book with the phone's open-book transition
 * (features/learn/OpenBook), risen in the page body's column rather than
 * the whole window; reduced motion just opens the page.
 */
function useOpenBook(): { open: OpenBook; overlay: ReactNode } {
  const reduced = useReducedMotion();
  const { width: winW, height: winH } = useRawWindow();
  const [run, setRun] = useState<OpenBookRun | null>(null);
  const busy = useRef(false);
  const href = (id: string) => `/library/${encodeURIComponent(id)}` as Href;
  const open: OpenBook = (book, from, chapterIndex) => {
    if (busy.current) return;
    if (reduced || !from) {
      router.push(href(book.id));
      return;
    }
    busy.current = true;
    from.measureInWindow((x, y, w, h) => {
      if (!(w > 0 && h > 0)) {
        busy.current = false;
        router.push(href(book.id));
        return;
      }
      setRun({ book, rect: { x, y, w, h }, chapterIndex });
    });
  };
  const onPush = useCallback(() => {
    if (run) router.push(href(run.book.id));
  }, [run]);
  const onDone = useCallback(() => {
    busy.current = false;
    setRun(null);
  }, []);
  const bodyW = Math.max(0, winW - dxSize.sidebar);
  const stageW = Math.min(bodyW, Math.round(winH * 0.62));
  const stage = { left: dxSize.sidebar + (bodyW - stageW) / 2, width: stageW, height: winH };
  return { open, overlay: run ? <OpenBookOverlay run={run} stage={stage} onPush={onPush} onDone={onDone} /> : null };
}

// ── Courses ─────────────────────────────────────────────────────────────

function Courses() {
  const t = useT();
  const { lang } = useLang();
  const data = useLearnCourses();
  const progress = useCourseProgressMap(data);
  const stored = useLibraryStore((s) => s.courses);
  const [filter, setFilter] = useState<LearnFilter>('all');
  // D39: courses are suggested for the level (the player's only number).
  const prog = useAppStore((s) => s.progressions[readLastStyle()]);
  const rating = prog ? levelFor(prog) : null;
  const w = usePageWidth();

  if (!data.courses) {
    return (
      <View style={styles.center} testID="dx-learn-courses-loading">
        {data.load === 'error' ? (
          <>
            <DText size={14} color={dx.ash}>
              {t('learn.load_failed')}
            </DText>
            <PlateButton testID="dx-learn-courses-retry" label={t('library.retry')} variant="slate" size="sm" onPress={data.retry} />
          </>
        ) : (
          <ActivityIndicator color={eos.ash} />
        )}
      </View>
    );
  }

  const courses = data.courses;
  const lastId = lastPlayedIn(data.attempts, new Set(courses.map((c) => c.id)));
  const current = courses.find((c) => c.id === lastId) ?? null;
  const suggest = suggestedCourse(courses, rating);
  const shown = courses.filter((c) => courseInFilter(filter, progress.get(c.id), !!stored[c.id]));
  const cols = w >= 860 ? 4 : 2;
  const cardW = colWidth(w, cols, 16);

  return (
    <View testID="dx-learn-courses">
      {current && progress.get(current.id) ? <ContinueCourse course={current} progress={progress.get(current.id)!} wide={w >= 900} /> : null}

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            testID={`dx-learn-course-filter-${f}`}
            label={t(`learn.filter.${f}`)}
            accessibilityLabel={t('library.filter_a11y', { filter: t(`learn.filter.${f}`) })}
            on={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
        <View style={styles.flex} />
        {suggest && rating != null ? (
          <Hover
            testID="dx-learn-suggest"
            accessibilityRole="link"
            accessibilityLabel={t('dx.learn.suggest', { level: rating, course: localized(suggest.title, lang) })}
            onPress={() => openCourse(suggest.id)}
            style={styles.suggest}
          >
            <Star size={14} color={tone.gold} strokeWidth={2} />
            <Suggestion rating={rating} course={localized(suggest.title, lang)} />
          </Hover>
        ) : null}
      </View>

      <View style={styles.grid}>
        {w > 0
          ? shown.map((c) => (
              <CourseCard key={c.id} course={c} progress={progress.get(c.id)!} width={cardW} current={c.id === current?.id} />
            ))
          : null}
        {shown.length === 0 ? (
          <DText size={14} color={dx.dust} style={styles.empty} testID="dx-learn-courses-empty">
            {t('learn.empty_courses')}
          </DText>
        ) : null}
      </View>
    </View>
  );
}

/** "З рівнем 1600 радимо **Середній**." */
function Suggestion({ rating, course }: { rating: number; course: string }) {
  const t = useT();
  const MARK = '\u0001';
  const [pre, post = ''] = t('dx.learn.suggest', { level: rating, course: MARK }).split(MARK);
  return (
    <DText size={13} color={dx.ash} numberOfLines={1}>
      {pre}
      <DText size={13} weight={800} color={eos.bone}>
        {course}
      </DText>
      {post}
    </DText>
  );
}

function ContinueCourse({ course, progress, wide }: { course: CourseSummary; progress: CourseProgress; wide: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const { done, total } = lessonTotals(progress);
  const next = progress.next;
  const examIndex = course.chapters.length;
  let line: string | null = null;
  if (next && next.chapterIndex < examIndex) {
    const ch = course.chapters[next.chapterIndex];
    const p = progress.chapters[next.chapterIndex];
    line = t('learn.course.chapter_line', { n: next.chapterIndex + 1, title: localized(ch.title, lang), done: p.done, total: p.total });
  } else if (next) {
    line = t('learn.course.exam_line');
  }
  const cta = progress.cycleComplete ? t('learn.course.start_cycle', { n: progress.cycle + 1 }) : t('learn.course.continue_cycle', { n: progress.cycle });
  const target = progress.cycle > 1 && !progress.cycleComplete ? cycleTargetSec(progress.cycles, progress.cycle) : null;
  const cycle = target != null ? `${t('courses.cycle', { n: progress.cycle })} · ${t('courses.cycle_target', { s: target })}` : t('courses.cycle', { n: progress.cycle });
  const bar = (
    <View style={wide ? styles.barWide : styles.barNarrow}>
      <Bar value={total ? done / total : 0} />
      <View style={styles.barFoot}>
        <DText size={12} color={dx.dust} numberOfLines={1} style={styles.shrink} testID="dx-learn-continue-cycle">
          {cycle}
        </DText>
        <DText size={12} color={dx.dust} tabular>{`${done} / ${total}`}</DText>
      </View>
    </View>
  );
  return (
    <Card texture style={styles.hero} testID="dx-learn-continue">
      <CourseEmblem color={course.color} piece={course.piece} state={progress.emblem} ring={progress.ring} size={72} />
      <View style={styles.flex}>
        <Label color={dx.rose}>{t('learn.continue')}</Label>
        <Title size={22} style={styles.mt4} numberOfLines={1}>
          {localized(course.title, lang)}
        </Title>
        {line ? (
          <DText size={13.5} color={dx.ash} numberOfLines={1}>
            {line}
          </DText>
        ) : null}
        {wide ? null : bar}
      </View>
      {wide ? bar : null}
      <PlateButton testID="dx-learn-continue-cta" label={cta} size="lg" onPress={() => openCourse(course.id)} style={wide ? styles.heroCta : undefined} />
    </Card>
  );
}

function CourseCard({ course, progress, width, current }: { course: CourseSummary; progress: CourseProgress; width: number; current: boolean }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const title = localized(course.title, lang);
  const range = `${course.ratingMin}–${course.ratingMax}`;
  const counts = `${plural(tn, 'dx.learn.chapters_exam', course.chapters.length)} · ${plural(tn, 'library.puzzles', course.puzzleCount)}`;
  const { done, total } = lessonTotals(progress);
  const passed = progress.emblem === 'passed' && progress.passedExam;
  const next = progress.next?.chapterIndex ?? 0;
  const where =
    next >= course.chapters.length ? t('courses.exam') : t('dx.learn.chapter_of', { n: next + 1, total: course.chapters.length });
  // The phone's status line: from cycle 2 the cycle's target time a puzzle.
  const target = progress.cycle > 1 && done > 0 ? cycleTargetSec(progress.cycles, progress.cycle) : null;
  const status = passed
    ? t('courses.exam_passed', { score: passed.score, total: passed.total })
    : progress.started
      ? [progress.cycle > 1 ? t('courses.cycle', { n: progress.cycle }) : null, where, `${done} / ${total}`, target != null ? t('courses.cycle_target_line', { s: target }) : null]
          .filter(Boolean)
          .join(' · ')
      : t('dx.learn.not_started');
  const color = courseColor(course.color, eos.ember);
  return (
    <Hover
      testID={`dx-learn-course-${course.id}`}
      accessibilityLabel={t('learn.course_a11y', { title, range, status })}
      onPress={() => openCourse(course.id)}
      style={[styles.courseCard, { width }, current && { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color, inset: true }] }]}
      hoverStyle={styles.courseHover}
    >
      <CourseEmblem color={course.color} piece={course.piece} state={progress.emblem} ring={progress.ring} size={110} />
      <View style={styles.centerText}>
        <Title size={22} numberOfLines={1}>
          {title}
        </Title>
        <DText size={12.5} weight={700} ls={1} color={dx.dust} style={styles.mt4} align="center">
          {range}
        </DText>
      </View>
      <DText size={12.5} color={dx.ash} align="center">
        {counts}
      </DText>
      <View style={styles.flex} />
      {passed ? (
        <Pill label={status} tone="sage" style={styles.selfCenter} />
      ) : progress.started ? (
        <View style={styles.full}>
          <Bar value={total ? done / total : 0} />
          <View style={styles.barFoot}>
            <DText size={12} color={dx.dust} numberOfLines={1} style={styles.shrink}>
              {progress.cycle > 1 ? `${t('courses.cycle', { n: progress.cycle })} · ${where}` : where}
            </DText>
            <DText size={12} color={dx.dust} tabular>{`${done} / ${total}`}</DText>
          </View>
          {target != null ? (
            <DText size={12} weight={700} color={tone.roseSoft} style={styles.mt4} testID={`dx-learn-course-${course.id}-target`}>
              {t('courses.cycle_target_line', { s: target })}
            </DText>
          ) : null}
        </View>
      ) : (
        <DText size={12.5} color={dx.dust}>
          {status}
        </DText>
      )}
    </Hover>
  );
}

// ── Books ───────────────────────────────────────────────────────────────

function Books({ onOpen }: { onOpen: OpenBook }) {
  const t = useT();
  const { lang } = useLang();
  const { books, load, retry } = useShelf();
  const stored = useLibraryStore((s) => s.books);
  const attempts = useAttempts();
  const [filter, setFilter] = useState<LearnFilter>('all');
  const [query, setQuery] = useState('');
  const w = usePageWidth();

  const shelf = useMemo<LibraryBookSummary[]>(() => books ?? Object.values(stored), [books, stored]);
  const progress = useMemo(() => new Map(shelf.map((b) => [b.id, bookProgress(b, attempts)])), [shelf, attempts]);
  const lastId = lastPlayedIn(attempts, new Set(shelf.map((b) => b.id)));
  const current = shelf.find((b) => b.id === lastId) ?? null;
  const q = query.trim().toLocaleLowerCase();
  const shown = shelf.filter((b) => {
    if (!bookInFilter(filter, progress.get(b.id), !!stored[b.id])) return false;
    if (!q) return true;
    return [b.title, b.authors, b.players].some((l) => localized(l, lang).toLocaleLowerCase().includes(q));
  });
  // 196 px covers 24+ px apart: a wider window takes more of them, not wider gaps.
  const cols = Math.max(3, Math.min(7, Math.floor((w + 28) / 224)));
  const coverW = Math.min(196, colWidth(w, cols, 24));

  return (
    <View testID="dx-learn-books">
      {current && progress.get(current.id) ? <ContinueBook book={current} progress={progress.get(current.id)!} wide={w >= 900} onOpen={onOpen} /> : null}

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const label = f === 'all' && shelf.length ? `${t('library.filter.all')} ${shelf.length}` : t(`library.filter.${f}`);
          return (
            <Chip
              key={f}
              testID={`dx-learn-book-filter-${f}`}
              label={label}
              accessibilityLabel={t('library.filter_a11y', { filter: t(`library.filter.${f}`) })}
              on={filter === f}
              onPress={() => setFilter(f)}
            />
          );
        })}
        <View style={styles.flex} />
        <View style={styles.search}>
          <Search size={14} color={dx.dust} strokeWidth={2} />
          <TextInput
            testID="dx-learn-book-search"
            accessibilityLabel={t('dx.learn.search_a11y')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('dx.learn.search')}
            placeholderTextColor={dx.dust}
            style={[styles.searchInput, { fontFamily: fontFamily(lang, 'body', 500) }]}
          />
        </View>
      </View>

      {shelf.length === 0 ? (
        <View style={styles.center}>
          {load === 'error' ? (
            <>
              <DText size={14} color={dx.ash}>
                {t('library.load_failed')}
              </DText>
              <PlateButton testID="dx-learn-books-retry" label={t('library.retry')} variant="slate" size="sm" onPress={retry} />
            </>
          ) : (
            <ActivityIndicator color={eos.ash} />
          )}
        </View>
      ) : (
        <View style={[styles.shelf, { columnGap: cols > 1 ? Math.max(24, Math.floor((w - coverW * cols) / (cols - 1))) : 0 }]}>
          {w > 0 ? shown.map((b) => <ShelfBook key={b.id} book={b} width={coverW} progress={progress.get(b.id)!} onOpen={onOpen} />) : null}
          {shown.length === 0 ? (
            <DText size={14} color={dx.dust} style={styles.empty} testID="dx-learn-books-empty">
              {q ? t('dx.learn.no_match') : t('library.empty_filter')}
            </DText>
          ) : null}
        </View>
      )}

      <DText size={12} color={dx.dust} style={styles.footnote}>
        {t('library.footnote')}
      </DText>
    </View>
  );
}

/** The book read last (the phone's "Continue reading" card): its chapter, the cycle's bar, Continue · cycle N. */
function ContinueBook({ book, progress, wide, onOpen }: { book: LibraryBookSummary; progress: BookProgress; wide: boolean; onOpen: OpenBook }) {
  const t = useT();
  const { lang } = useLang();
  const ref = useRef<HostInstance>(null);
  const ch = progress.next ? progress.next.chapterIndex : Math.max(0, book.chapters.length - 1);
  const chapter = book.chapters[ch];
  const cta = progress.cycleComplete ? t('library.start_cycle', { n: progress.cycle + 1 }) : t('library.continue_cycle', { n: progress.cycle });
  const bar = (
    <View style={wide ? styles.barWide : styles.barNarrow}>
      <Bar value={progress.total ? progress.done / progress.total : 0} />
      <View style={styles.barFoot}>
        <DText size={12} color={dx.dust}>
          {t('courses.cycle', { n: progress.cycle })}
        </DText>
        <DText size={12} color={dx.dust} tabular testID="dx-learn-continue-book-count">{`${progress.done} / ${progress.total}`}</DText>
      </View>
    </View>
  );
  return (
    <Card texture style={styles.hero} testID="dx-learn-continue-book">
      <View ref={ref} collapsable={false}>
        <BookCover book={book} width={64} small />
      </View>
      <View style={styles.flex}>
        <Label color={dx.rose}>{t('library.continue_reading')}</Label>
        <Title size={22} style={styles.mt4} numberOfLines={1}>
          {localized(book.title, lang)}
        </Title>
        {chapter ? (
          <DText size={13.5} color={dx.ash} numberOfLines={1}>
            {t('library.chapter_line', { n: ch + 1, title: localized(chapter.title, lang) })}
          </DText>
        ) : null}
        {wide ? null : bar}
      </View>
      {wide ? bar : null}
      <PlateButton testID="dx-learn-continue-book-cta" label={cta} size="lg" onPress={() => onOpen(book, ref.current, ch)} style={wide ? styles.heroCta : undefined} />
    </Card>
  );
}

function ShelfBook({ book, width, progress, onOpen }: { book: LibraryBookSummary; width: number; progress: BookProgress; onOpen: OpenBook }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const ref = useRef<HostInstance>(null);
  const count = plural(tn, 'library.puzzles', book.puzzleCount);
  // As the phone tile: done until the next cycle starts; mid-cycle the chapter.
  const done = progress.cycleComplete;
  const sub = done
    ? `${count} · ${t('library.card_done')}`
    : progress.started && progress.next
      ? `${count} · ${t('library.card_chapter', { n: progress.next.chapterIndex + 1 })} · ${progress.done}/${progress.total}`
      : count;
  const title = localized(book.title, lang);
  return (
    <Hover
      testID={`dx-learn-book-${book.id}`}
      accessibilityLabel={`${title}, ${sub}`}
      onPress={() => onOpen(book, ref.current, progress.next?.chapterIndex ?? 0)}
      style={[styles.book, { width }]}
      hoverStyle={styles.bookHover}
    >
      <View ref={ref} collapsable={false}>
        <BookCover book={book} width={width} />
      </View>
      <View>
        <DText size={14} weight={800} numberOfLines={2}>
          {title}
        </DText>
        <DText size={12} color={done ? eos.sage : dx.dust} numberOfLines={1} testID={`dx-learn-book-${book.id}-sub`}>
          {sub}
        </DText>
        {progress.started || done ? (
          <Bar
            value={done ? 1 : progress.total ? progress.done / progress.total : 0}
            height={4}
            colors={done ? [tone.sageDeep, tone.sageDeep] : undefined}
            style={styles.mt8}
          />
        ) : null}
      </View>
    </Hover>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  full: { width: '100%' },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  selfCenter: { alignSelf: 'center' },
  centerText: { alignItems: 'center' },
  center: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  hero: { paddingVertical: 22, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 22 },
  heroCta: { minWidth: 220 },
  barWide: { width: 260 },
  barNarrow: { marginTop: 10, maxWidth: 320 },
  barFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 8, borderRadius: 8, flexShrink: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16 },
  courseCard: {
    minHeight: 330,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    backgroundColor: dx.card,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  courseHover: { backgroundColor: dx.card2 },
  empty: { paddingVertical: 24 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 240,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: dx.input,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.inputEdge, inset: true }],
  },
  searchInput: { flex: 1, minWidth: 0, height: 34, color: eos.bone, fontSize: 13 },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 26, marginTop: 20 },
  book: { gap: 10, borderRadius: 8 },
  bookHover: { opacity: 0.92, backgroundColor: alpha(eos.bone, 0) },
  footnote: { marginTop: 24 },
});

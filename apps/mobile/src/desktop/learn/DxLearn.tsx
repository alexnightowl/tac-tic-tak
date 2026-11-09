import { bookProgress, localized, suggestedCourse, type BookProgress, type CourseProgress, type CourseSummary, type LibraryBookSummary } from '@tac/core/library';
import { alpha, eos, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Search, Star } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { CourseEmblem } from '@/features/learn/CourseEmblem';
import { courseColor } from '@/features/learn/courseColor';
import { bookInFilter, courseInFilter, lessonTotals, useCourseProgressMap, useLearnCourses } from '@/features/learn/data';
import { FILTERS, type LearnFilter } from '@/features/learn/parts';
import { useLearnSegment } from '@/features/learn/segment';
import { BookCover } from '@/features/library/BookCover';
import { lastPlayedIn, useShelf } from '@/features/library/model';
import { useAttempts, useLibraryStore } from '@/features/library/store';
import { plural } from '@/features/offline/format';
import { readLastStyle } from '@/features/play/setupPrefs';
import { useAppStore } from '@/stores/appStore';
import { PlateButton } from '@/ui';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT, useTn } from '@/ui/lang';
import { Bar, Card, Chip, DText, Hover, Label, Pill, Title } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { colWidth, LearnSwitch, usePageWidth } from './parts';

// /learn on a desktop window (canvas DXLearn, DXBooks): the Курси / Книги
// switch in the header picks the pane, as the phone's segment does.

const openCourse = (id: string) => router.push(`/course/${encodeURIComponent(id)}` as Href);

export function DxLearn() {
  const t = useT();
  const [segment] = useLearnSegment();
  return (
    <DesktopPage
      testID="dx-learn"
      title={t('learn.title')}
      subtitle={segment === 'courses' ? t('learn.subtitle') : t('dx.learn.books_subtitle')}
      right={<LearnSwitch value={segment} />}
    >
      {segment === 'courses' ? <Courses /> : <Books />}
    </DesktopPage>
  );
}

// ── Courses ─────────────────────────────────────────────────────────────

function Courses() {
  const t = useT();
  const { lang } = useLang();
  const data = useLearnCourses();
  const progress = useCourseProgressMap(data);
  const stored = useLibraryStore((s) => s.courses);
  const [filter, setFilter] = useState<LearnFilter>('all');
  const rating = useAppStore((s) => s.progressions[readLastStyle()]?.currentPuzzleRating ?? null);
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
            accessibilityLabel={t('learn.suggest', { rating, course: localized(suggest.title, lang) })}
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

/** "З рейтингом 1612 радимо **Середній**." */
function Suggestion({ rating, course }: { rating: number; course: string }) {
  const t = useT();
  const MARK = '\u0001';
  const [pre, post = ''] = t('learn.suggest', { rating, course: MARK }).split(MARK);
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
  const cta = progress.cycleComplete ? t('learn.course.start_cycle', { n: progress.cycle + 1 }) : t('learn.continue');
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
      </View>
      <View style={{ width: wide ? 260 : 150 }}>
        <Bar value={total ? done / total : 0} />
        <View style={styles.barFoot}>
          <DText size={12} color={dx.dust}>
            {t('courses.cycle', { n: progress.cycle })}
          </DText>
          <DText size={12} color={dx.dust} tabular>{`${done} / ${total}`}</DText>
        </View>
      </View>
      <PlateButton testID="dx-learn-continue-cta" label={cta} size="lg" onPress={() => openCourse(course.id)} style={styles.heroCta} />
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
  const status = passed
    ? t('courses.exam_passed', { score: passed.score, total: passed.total })
    : progress.started
      ? `${progress.cycle > 1 ? `${t('courses.cycle', { n: progress.cycle })} · ` : ''}${where} · ${done} / ${total}`
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

function Books() {
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
  const q = query.trim().toLocaleLowerCase();
  const shown = shelf.filter((b) => {
    if (!bookInFilter(filter, progress.get(b.id), !!stored[b.id])) return false;
    if (!q) return true;
    return [b.title, b.authors, b.players].some((l) => localized(l, lang).toLocaleLowerCase().includes(q));
  });
  const cols = w >= 1000 ? 5 : w >= 760 ? 4 : 3;
  const coverW = Math.min(196, colWidth(w, cols, 24));

  return (
    <View testID="dx-learn-books">
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
          {w > 0 ? shown.map((b) => <ShelfBook key={b.id} book={b} width={coverW} progress={progress.get(b.id)!} />) : null}
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

function ShelfBook({ book, width, progress }: { book: LibraryBookSummary; width: number; progress: BookProgress }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const count = plural(tn, 'library.puzzles', book.puzzleCount);
  const sub = progress.cycleComplete
    ? `${count} · ${t('library.card_done')}`
    : progress.started
      ? `${count} · ${t('dx.learn.book_reading', { done: progress.done, total: progress.total })}`
      : count;
  const title = localized(book.title, lang);
  return (
    <Hover
      testID={`dx-learn-book-${book.id}`}
      accessibilityLabel={`${title}, ${sub}`}
      onPress={() => router.push(`/library/${encodeURIComponent(book.id)}` as Href)}
      style={[styles.book, { width }]}
      hoverStyle={styles.bookHover}
    >
      <BookCover book={book} width={width} />
      <View>
        <DText size={14} weight={800} numberOfLines={2}>
          {title}
        </DText>
        <DText size={12} color={progress.cycleComplete ? eos.sage : dx.dust} numberOfLines={1} testID={`dx-learn-book-${book.id}-sub`}>
          {sub}
        </DText>
      </View>
    </Hover>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  full: { width: '100%' },
  mt4: { marginTop: 4 },
  selfCenter: { alignSelf: 'center' },
  centerText: { alignItems: 'center' },
  center: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  hero: { paddingVertical: 22, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 22 },
  heroCta: { minWidth: 220 },
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

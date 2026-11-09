import { localized, suggestedCourse, type CourseProgress, type CourseSummary } from '@tac/core/library';
import { alpha, eos, space, tone } from '@tac/core/tokens';
import { levelFor } from '@tac/core/runner';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { lastPlayedIn } from '@/features/library/model';
import { useLibraryStore } from '@/features/library/store';
import { readLastStyle } from '@/features/play/setupPrefs';
import { useAppStore } from '@/stores/appStore';
import { AppText, HeroCard, PlateButton, ProgressBar, Tap, useLang } from '@/ui';
import { useT } from '@/ui/lang';
import { CourseCardFace, CourseTile } from './CourseCard';
import { courseInFilter, lessonTotals, useCourseProgressMap, useLearnCourses } from './data';
import { FilterChips, GRID_GAP, type LearnFilter } from './parts';

// Learn → Courses (canvas LearnHome): the course played last with
// Continue, filters, "At {rating} we suggest …", and the 2-column grid.
// Courses are independent: the list is the data's order, no numbering.

const openCourse = (id: string) => router.push(`/course/${encodeURIComponent(id)}` as Href);

export function CoursesPane({ width }: { width: number }) {
  const t = useT();
  const { lang } = useLang();
  const { width: screenW } = useWindowDimensions();
  const data = useLearnCourses();
  const progress = useCourseProgressMap(data);
  const stored = useLibraryStore((s) => s.courses);
  const [filter, setFilter] = useState<LearnFilter>('all');
  // The level of the style the player trains in (Play remembers it; D39).
  const rating = useAppStore((s) => {
    const p = s.progressions[readLastStyle()];
    return p ? levelFor(p) : null;
  });

  const courses = data.courses ?? [];
  const lastId = lastPlayedIn(data.attempts, new Set(courses.map((c) => c.id)));
  const current = courses.find((c) => c.id === lastId) ?? null;
  const suggest = suggestedCourse(courses, rating);

  const shown = courses.filter((c) => courseInFilter(filter, progress.get(c.id), !!stored[c.id]));
  const cardW = Math.floor(((width || screenW) - GRID_GAP) / 2);

  if (!data.courses) {
    return (
      <View style={styles.center} testID="learn-courses-loading">
        {data.load === 'error' ? (
          <>
            <AppText variant="body" color={eos.ash}>
              {t('learn.load_failed')}
            </AppText>
            <PlateButton testID="learn-courses-retry" label={t('library.retry')} variant="slate" size="sm" onPress={data.retry} />
          </>
        ) : (
          <ActivityIndicator color={eos.ash} />
        )}
      </View>
    );
  }

  return (
    <View testID="learn-courses">
      {current && progress.get(current.id) ? <ContinueCourse course={current} progress={progress.get(current.id)!} /> : null}

      <FilterChips value={filter} onChange={setFilter} testID="learn-course-filter" keys="learn.filter" />

      {suggest && rating != null ? (
        <Tap
          testID="learn-suggest"
          accessibilityRole="button"
          accessibilityLabel={t('learn.suggest', { rating, course: localized(suggest.title, lang) })}
          onPress={() => openCourse(suggest.id)}
          style={styles.suggest}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={tone.gold} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />
          </Svg>
          <Suggestion rating={rating} course={localized(suggest.title, lang)} />
        </Tap>
      ) : null}

      <View style={styles.grid}>
        {shown.map((c) => (
          <CourseTile key={c.id} course={c} progress={progress.get(c.id)!} width={cardW} onPress={() => openCourse(c.id)} />
        ))}
        {shown.length === 0 ? (
          <AppText variant="body" color={eos.dust} style={styles.empty} testID="learn-courses-empty">
            {t('learn.empty_courses')}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** "At 1612 we suggest **Intermediate**." — the course name in bold. */
function Suggestion({ rating, course }: { rating: number; course: string }) {
  const t = useT();
  const MARK = '\u0001';
  const [pre, post = ''] = t('learn.suggest', { rating, course: MARK }).split(MARK);
  return (
    <AppText variant="caption" color={tone.goldInk} style={styles.suggestText}>
      {pre}
      <AppText variant="captionStrong" color={tone.goldInk} style={styles.suggestText}>
        {course}
      </AppText>
      {post}
    </AppText>
  );
}

function ContinueCourse({ course, progress }: { course: CourseSummary; progress: CourseProgress }) {
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
  return (
    <HeroCard style={styles.continue} testID="learn-course-continue">
      <CourseCardFace course={course} progress={progress} width={92} height={108} />
      <View style={styles.flex}>
        <AppText variant="label" color={tone.rose}>
          {t('learn.continue')}
        </AppText>
        <AppText variant="navTitle" style={styles.continueTitle}>
          {localized(course.title, lang)}
        </AppText>
        {line ? (
          <AppText variant="caption" color={eos.ash} style={styles.line}>
            {line}
          </AppText>
        ) : null}
        <View style={styles.bar}>
          <ProgressBar value={total ? done / total : 0} height={5} trackColor={eos.well} style={styles.flex} />
          <AppText variant="captionStrong" color={eos.ash} style={styles.tabular}>
            {`${done} / ${total}`}
          </AppText>
        </View>
        <PlateButton testID="learn-course-continue-cta" label={cta} size="sm" onPress={() => openCourse(course.id)} style={styles.cta} />
      </View>
    </HeroCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ['tabular-nums'] },
  center: { paddingVertical: space[10], alignItems: 'center', gap: space[3] },
  continue: { marginTop: space[4], padding: space[4], flexDirection: 'row', alignItems: 'center', gap: space[4] },
  continueTitle: { marginTop: space[1], fontSize: 19, lineHeight: 24 },
  line: { marginTop: space[0.5], fontSize: 12.5 },
  bar: { marginTop: space[2.5], flexDirection: 'row', alignItems: 'center', gap: space[2] },
  cta: { marginTop: space[3] },
  suggest: {
    marginTop: space[3],
    paddingVertical: space[2.5],
    paddingHorizontal: space[3],
    borderRadius: 10,
    backgroundColor: alpha(tone.gold, 0.08),
    borderWidth: 1,
    borderColor: alpha(tone.gold, 0.28),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  suggestText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  grid: { marginTop: space[4], flexDirection: 'row', flexWrap: 'wrap', columnGap: GRID_GAP, rowGap: space[6] },
  empty: { paddingVertical: space[6] },
});

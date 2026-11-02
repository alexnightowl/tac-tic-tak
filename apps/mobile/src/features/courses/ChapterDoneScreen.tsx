import { chapterCycleStats, cycleTargetSec, localized, type ChapterCycleStats } from '@tac/core/library';
import { alpha, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { useCourseContent, useCourseProgress, useCourseSummary } from '@/features/library/model';
import { useAttempts } from '@/features/library/store';
import { plural } from '@/features/offline/format';
import { ThemeIcon } from '@/features/review/ThemeIcon';
import { AppText, PlateButton, ProgressBar, Tap, useLang } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { Medal } from './Medal';
import { clock, courseHref, fitPlate, lessonsOf, openChapter, passedInCycle, resultsIn, type CourseLike } from './model';
import { useGlowStyle, useSettleStyle } from './motion';
import { Glow } from './parts';
import { courseTones, type CourseTones } from './tones';

// /course/done?course&chapter&cycle[&fresh] (canvas LearnChapterDone):
// the chapter's medal, "Chapter 3 of 10 complete", how many were solved
// on one's own, the numbers (solved, average, next cycle's target), one
// bar per puzzle (misses in the light course ink), the course progress
// and the way on: the next unfinished chapter, else the exam.

const BAR_MAX = 50;

export function CourseChapterDoneScreen({ courseId, chapter, cycle, fresh }: { courseId: string; chapter: number; cycle: number; fresh: boolean }) {
  const insets = useSafeAreaInsets();
  const summary = useCourseSummary(courseId);
  const content = useCourseContent(courseId);
  const course: CourseLike | null = summary ?? content.course;
  if (!course || !course.chapters[chapter]) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="course-done">
        <ActivityIndicator color={eos.ash} />
      </View>
    );
  }
  return <Done course={course} chapter={chapter} cycle={cycle} fresh={fresh} />;
}

function Done({ course, chapter, cycle, fresh }: { course: CourseLike; chapter: number; cycle: number; fresh: boolean }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const attempts = useAttempts();
  const progress = useCourseProgress(course);
  const tones = courseTones(course.color);
  const c = course.chapters[chapter];
  const glow = useGlowStyle();
  const settle = useSettleStyle();

  const { now, prev, missed } = useMemo(() => {
    const results = resultsIn(course.id, attempts, cycle);
    return {
      now: chapterCycleStats(course.id, c.puzzleIds, attempts, cycle),
      prev: cycle > 1 ? chapterCycleStats(course.id, c.puzzleIds, attempts, cycle - 1) : null,
      missed: c.puzzleIds.map((id) => !!results.get(id) && results.get(id)?.result !== 'clean'),
    };
  }, [course.id, c.puzzleIds, attempts, cycle]);

  useEffect(() => {
    if (fresh) feel.emit('achievementToast');
  }, [fresh]);

  if (!progress) return null;
  const lessons = lessonsOf(progress);
  const doneLessons = lessons.filter((l) => l.complete).length;
  const target = cycleTargetSec(progress.cycles, cycle + 1);
  const sameCycle = progress.cycle === cycle;
  // The way on: the next unfinished chapter after this one (wrapping), else the exam.
  const order = lessons.map((_, i) => (chapter + 1 + i) % lessons.length);
  const nextIndex = sameCycle ? (order.find((i) => !lessons[i].complete) ?? null) : null;

  let lede: string;
  if (prev && prev.avgSec != null && now.avgSec != null) {
    const pct = Math.round((1 - now.avgSec / Math.max(1, prev.avgSec)) * 100);
    lede = t(pct > 0 ? 'courses.done.faster' : 'courses.done.slower', { clean: now.clean, total: now.total, pct, prev: cycle - 1 });
  } else {
    lede = now.clean >= now.total ? t('courses.done.all_clean', { total: now.total }) : t('courses.done.clean', { clean: now.clean, total: now.total });
  }

  const toCourse = () => router.dismissTo(courseHref.page(course.id));

  let cta: { id: string; label: string; run: () => void };
  if (nextIndex != null) {
    cta = {
      id: 'course-done-next',
      label: fitPlate(t('courses.done.next', { title: localized(course.chapters[nextIndex].title, lang) }), t('courses.done.next_short', { ch: nextIndex + 1 })),
      run: () => openChapter(course, progress, nextIndex, true),
    };
  } else if (progress.examOpen && !passedInCycle(progress)) {
    cta = { id: 'course-done-exam', label: t('courses.cta_exam'), run: () => router.replace(courseHref.exam(course.id)) };
  } else {
    cta = { id: 'course-done-again', label: t('courses.cta_cycle', { n: progress.cycle + 1 }), run: () => router.replace(courseHref.solve(course.id, 0, progress.cycle + 1)) };
  }

  return (
    <View style={styles.root} testID="course-done">
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 30, paddingBottom: 150 + insets.bottom }]}>
        <View style={styles.hero}>
          <Animated.View style={[styles.glow, glow]} pointerEvents="none">
            <Glow color={tones.tint(0.3)} size={340} stop={0.62} />
          </Animated.View>
          <Animated.View style={settle}>
            <Medal size={108} stops={tones.seal}>
              <ThemeIcon slug={c.theme} size={54} color={tone.parchment} />
            </Medal>
          </Animated.View>
          <AppText variant="label" color={tone.gold} style={styles.kicker} testID="course-done-kicker">
            {t('courses.done.kicker', { ch: chapter + 1, chapters: course.chapters.length })}
          </AppText>
          <AppText variant="heading" accessibilityRole="header" style={styles.title}>
            {localized(c.title, lang)}
          </AppText>
          <AppText variant="body" color={eos.ash} style={styles.lede} testID="course-done-lede">
            {lede}
          </AppText>
        </View>

        <View style={styles.card} testID="course-done-stats">
          <View style={styles.stats}>
            <Stat value={`${now.clean}/${now.total}`} label={t('courses.done.solved')} />
            <Stat value={now.avgSec != null ? clock(now.avgSec) : '—'} label={t('courses.done.avg')} />
            {target != null ? <Stat value={clock(target)} label={t('courses.done.target', { n: cycle + 1 })} gold testID="course-done-target" /> : null}
          </View>
          <Bars stats={now} missed={missed} tones={tones} />
          <View style={styles.barsFoot}>
            <AppText variant="caption" color={eos.dust} style={styles.small}>
              {t('library.done.time_per')}
            </AppText>
            <AppText variant="caption" color={eos.dust} style={styles.small} testID="course-done-misses">
              {now.missed > 0 ? plural(tn, 'library.done.misses', now.missed) : t('library.done.no_misses')}
            </AppText>
          </View>
        </View>

        <View style={styles.progress} testID="course-done-progress">
          <AppText variant="caption" color={eos.ash} style={styles.flex}>
            {t('courses.done.course_progress')}
          </AppText>
          <ProgressBar value={lessons.length ? doneLessons / lessons.length : 0} height={5} colors={tones.bar} trackColor={eos.well} style={styles.progressBar} />
          <AppText variant="captionStrong" style={styles.tabular}>
            {`${doneLessons}/${lessons.length}`}
          </AppText>
        </View>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]}>
        <PlateButton testID={cta.id} label={cta.label} size="lg" block onPress={cta.run} />
        <Tap testID="course-done-back" accessibilityRole="button" accessibilityLabel={t('courses.done.back')} onPress={toCourse} style={styles.backBtn}>
          <AppText variant="body" color={eos.ash} style={styles.backText}>
            {t('courses.done.back')}
          </AppText>
        </Tap>
      </View>
    </View>
  );
}

function Stat({ value, label, gold = false, testID }: { value: string; label: string; gold?: boolean; testID?: string }) {
  return (
    <View style={styles.stat} testID={testID}>
      <AppText variant="value" color={gold ? tone.gold : eos.bone} style={styles.statValue} numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="label" style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </AppText>
    </View>
  );
}

/** One bar per puzzle, height by time; a missed one in the light course ink. */
function Bars({ stats, missed, tones }: { stats: ChapterCycleStats; missed: readonly boolean[]; tones: CourseTones }) {
  const t = useT();
  const max = Math.max(1, ...stats.times.map((x) => x ?? 0));
  return (
    <View
      style={styles.bars}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('courses.done.chart_a11y', { list: stats.times.map((x) => (x == null ? '–' : Math.round(x))).join(', ') })}
    >
      {stats.times.map((x, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: x == null ? 2 : Math.max(4, Math.round((x / max) * BAR_MAX)) },
            { backgroundColor: missed[i] ? tones.ink : tones.tint(0.8) },
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
  tabular: { fontVariant: ['tabular-nums'] },
  scroll: { paddingHorizontal: layout.gutter },
  hero: { alignItems: 'center', paddingHorizontal: space[1] },
  glow: { position: 'absolute', top: -40, alignSelf: 'center', width: 340, height: 340 },
  kicker: { marginTop: 22, textAlign: 'center' },
  title: { marginTop: space[1.5], textAlign: 'center', fontSize: 28, lineHeight: 34 },
  lede: { marginTop: space[2], maxWidth: 320, textAlign: 'center', lineHeight: 21 },
  card: { marginTop: 22, padding: space[4], borderRadius: radii.xl, backgroundColor: eos.slate, borderWidth: 1, borderColor: alpha(eos.bone, 0.05) },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, lineHeight: 28 },
  statLabel: { fontSize: 10 },
  bars: { marginTop: space[4], height: BAR_MAX, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barsFoot: { marginTop: space[1.5], flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  small: { fontSize: 11 },
  progress: { marginTop: space[3], paddingHorizontal: space[3.5], paddingVertical: space[3], borderRadius: radii.xl, backgroundColor: eos.slate, flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  progressBar: { width: 150 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space[4], gap: space[1], backgroundColor: eos.ink },
  backBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 13 },
});

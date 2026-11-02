import { localized, type CourseExamRecord } from '@tac/core/library';
import { alpha, eos, graphite, layout, radii, space, tone } from '@tac/core/tokens';
import { router } from 'expo-router';
import { Star } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCourseContent, useCourseProgress, useCourseSummary } from '@/features/library/model';
import { useExams } from '@/features/library/store';
import { ThemeIcon } from '@/features/review/ThemeIcon';
import { AppText, PlateButton, ProgressBar, Tap, useLang } from '@/ui';
import { useT } from '@/ui/lang';
import { Medal } from './Medal';
import { courseHref, fitPlate, lastTry, themeTitle, type CourseLike } from './model';
import { useSettleStyle } from './motion';
import { courseTones } from './tones';

// /course/result?course&at (canvas LearnStates "Exam — not passed", drawn
// there as a card only; APP-ONLY as a full screen in the chapter-complete
// style): the score, what was needed, the weakest themes, a row per theme,
// "Retake exam" and "Practice <weakest>" (that chapter's puzzles again,
// outside the cycle count).

/** Up to two themes to practise, weakest first (examOutcome's rule, from a stored try). */
export function weakestOf(byTheme: CourseExamRecord['byTheme'], order: readonly string[]): string[] {
  const themes = order.filter((t) => byTheme[t] && byTheme[t][0] < byTheme[t][1]);
  return themes
    .sort((a, b) => byTheme[a][0] / byTheme[a][1] - byTheme[b][0] / byTheme[b][1] || byTheme[b][1] - byTheme[a][1] || order.indexOf(a) - order.indexOf(b))
    .slice(0, 2);
}

export function ExamResultScreen({ courseId, at }: { courseId: string; at: string | null }) {
  const insets = useSafeAreaInsets();
  const summary = useCourseSummary(courseId);
  const content = useCourseContent(courseId);
  const course: CourseLike | null = summary ?? content.course;
  const progress = useCourseProgress(course);
  const exams = useExams();
  const record = (at ? exams.find((e) => e.courseId === courseId && e.takenAt === at) : null) ?? (progress ? lastTry(progress) : null);
  if (!course || !progress || !record) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="course-result">
        <ActivityIndicator color={eos.ash} />
      </View>
    );
  }
  return <Result course={course} record={record} cycle={progress.cycle} />;
}

function Result({ course, record, cycle }: { course: CourseLike; record: CourseExamRecord; cycle: number }) {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const tones = courseTones(course.color);
  const settle = useSettleStyle();
  const order = course.chapters.map((c) => c.theme);
  const weakest = weakestOf(record.byTheme, order);
  const pass = course.exam.passMark;
  const list = weakest.map((th) => t('courses.fail.theme', { title: themeTitle(course, th, lang), right: record.byTheme[th][0], asked: record.byTheme[th][1] })).join(', ');
  const practice = weakest[0] ? course.chapters.findIndex((c) => c.theme === weakest[0]) : -1;

  return (
    <View style={styles.root} testID="course-result">
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 30, paddingBottom: 190 + insets.bottom }]}>
        <View style={styles.hero}>
          <Animated.View style={settle}>
            <Medal size={96} stops={tone.medalStone} ring="seal">
              <Star size={40} color={tone.mist} strokeWidth={1.6} />
            </Medal>
          </Animated.View>
          <AppText variant="label" color={tone.rose} style={styles.kicker} testID="course-result-kicker">
            {t('courses.fail.kicker')}
          </AppText>
          <AppText variant="heading" accessibilityRole="header" style={styles.title} testID="course-result-score">
            {t('courses.fail.score', { score: record.score, total: record.total })}
          </AppText>
          <AppText variant="body" color={eos.ash} style={styles.lede} testID="course-result-weakest">
            {list ? t('courses.fail.weakest', { pass, list }) : t('courses.fail.need', { pass })}
          </AppText>
          <AppText variant="body" color={eos.dust} style={styles.lede2}>
            {t('courses.fail.lede')}
          </AppText>
        </View>

        <View style={styles.card} testID="course-result-themes">
          <AppText variant="label">{t('courses.fail.by_theme')}</AppText>
          {order
            .filter((th) => record.byTheme[th])
            .map((th) => {
              const [right, asked] = record.byTheme[th];
              const weak = weakest.includes(th);
              return (
                <View key={th} style={styles.themeRow}>
                  <View style={styles.themeTile}>
                    <ThemeIcon slug={th} size={16} color={weak ? tones.ink : eos.ash} />
                  </View>
                  <AppText variant="bodyStrong" color={weak ? eos.bone : graphite[300]} style={styles.flex} numberOfLines={2}>
                    {themeTitle(course, th, lang)}
                  </AppText>
                  <ProgressBar
                    value={asked ? right / asked : 0}
                    height={4}
                    colors={right === asked ? [tone.sageDeep, tone.sageDeep] : tones.bar}
                    trackColor={eos.well}
                    style={styles.themeBar}
                  />
                  <AppText variant="captionStrong" color={weak ? tones.ink : eos.ash} style={styles.count}>
                    {`${right}/${asked}`}
                  </AppText>
                </View>
              );
            })}
        </View>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]}>
        <PlateButton testID="course-result-retake" label={t('courses.fail.retake')} size="lg" block onPress={() => router.replace(courseHref.exam(course.id))} />
        {practice >= 0 ? (
          <PlateButton
            testID="course-result-practice"
            label={fitPlate(t('courses.fail.practice', { title: localized(course.chapters[practice].title, lang) }), t('courses.fail.practice_short', { ch: practice + 1 }))}
            variant="slate"
            size="md"
            block
            onPress={() => router.push(courseHref.replay(course.id, practice, cycle))}
          />
        ) : null}
        <Tap testID="course-result-back" accessibilityRole="button" accessibilityLabel={t('courses.done.back')} onPress={() => router.dismissTo(courseHref.page(course.id))} style={styles.backBtn}>
          <AppText variant="body" color={eos.ash} style={styles.backText}>
            {t('courses.done.back')}
          </AppText>
        </Tap>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  scroll: { paddingHorizontal: layout.gutter },
  hero: { alignItems: 'center', paddingHorizontal: space[1] },
  kicker: { marginTop: 22, textAlign: 'center' },
  title: { marginTop: space[1.5], textAlign: 'center', fontSize: 28, lineHeight: 34 },
  lede: { marginTop: space[2], maxWidth: 320, textAlign: 'center', lineHeight: 21 },
  lede2: { marginTop: space[1], maxWidth: 320, textAlign: 'center', lineHeight: 21, fontSize: 13 },
  card: { marginTop: 22, padding: space[4], borderRadius: radii.xl, backgroundColor: eos.slate, borderWidth: 1, borderColor: alpha(eos.bone, 0.05), gap: space[2.5] },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: space[2.5] },
  themeTile: { width: 28, height: 28, borderRadius: radii.md, backgroundColor: eos.rise, alignItems: 'center', justifyContent: 'center' },
  themeBar: { width: 64 },
  count: { width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space[4], gap: space[2], backgroundColor: eos.ink },
  backBtn: { height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 13 },
});

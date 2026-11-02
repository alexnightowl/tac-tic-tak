import { cycleTargetSec, localized, type CourseProgress, type CourseSummary } from '@tac/core/library';
import { alpha, cover, eos, learn, tone, white } from '@tac/core/tokens';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { DownloadView } from '@/features/library/model';
import { plural } from '@/features/offline/format';
import { AppText, Tap, useLang } from '@/ui';
import { useT, useTn, type TFn, type TnFn } from '@/ui/lang';
import { CourseEmblem } from './CourseEmblem';
import { courseColor } from './courseColor';
import { lessonTotals, useCourseDownloadView } from './data';
import { StatusIcon, TileMeta } from './parts';

// A course on the Learn grid (canvas LearnHome; states from LearnStates
// "Course card"): a stone card with the course colour along its top, the
// emblem, the title and the level range; under it the title again, the
// status line with its icon, and the thin progress bar.

const BASE_W = 173;
export const COURSE_CARD_RATIO = 200 / 173;

/** The status line under a course (LearnStates "Course card" states). */
export function courseStatus(c: CourseSummary, p: CourseProgress, dl: DownloadView, t: TFn, tn: TnFn): string {
  const { done, total } = lessonTotals(p);
  const restarted = !!p.passedExam && p.cycle > p.passedExam.cycle && p.started && done > 0;
  if (p.passedExam && !restarted) return t('learn.status.passed', { score: p.passedExam.score, total: p.passedExam.total });
  if (p.cycle > 1 && done > 0) {
    const s = cycleTargetSec(p.cycles, p.cycle);
    return s != null ? t('learn.status.cycle', { n: p.cycle, done, total, s }) : t('learn.status.cycle_free', { n: p.cycle, done, total });
  }
  if (p.started) return t('learn.status.progress', { done, total, n: p.cycle });
  if (dl === 'downloading') return t('learn.status.downloading');
  if (dl === 'downloaded') return t('learn.status.fresh');
  return t('learn.status.remote', { count: plural(tn, 'library.puzzles', c.puzzleCount) });
}

export function CourseTile({ course, progress, width, onPress }: { course: CourseSummary; progress: CourseProgress; width: number; onPress: () => void }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const dl = useCourseDownloadView(course.id);
  const title = localized(course.title, lang);
  const status = courseStatus(course, progress, dl, t, tn);
  const range = `${course.ratingMin}–${course.ratingMax}`;
  const passed = progress.emblem === 'passed' && progress.ring >= 1;
  return (
    <Tap
      testID={`learn-course-${course.id}`}
      accessibilityRole="button"
      accessibilityLabel={t('learn.course_a11y', { title, range, status })}
      onPress={onPress}
      style={[styles.tile, { width }]}
    >
      <CourseCardFace course={course} progress={progress} width={width} />
      <TileMeta title={title} status={status} icon={<StatusIcon state={dl} testID={`learn-course-${course.id}-state`} />} ratio={progress.ring} done={passed} testID={`learn-course-${course.id}`} />
    </Tap>
  );
}

/** The card itself (also the Continue card's small variant: 92 × 108). */
export function CourseCardFace({
  course,
  progress,
  width,
  height = Math.round(width * COURSE_CARD_RATIO),
}: {
  course: CourseSummary;
  progress: CourseProgress;
  width: number;
  height?: number;
}) {
  const { lang } = useLang();
  const k = width / BASE_W;
  const small = width < 120;
  const color = courseColor(course.color, eos.ember);
  const id = `cc${course.id.replace(/[^a-zA-Z0-9]/g, '')}${Math.round(width)}`;
  return (
    <View
      style={[
        styles.card,
        {
          width,
          height,
          gap: small ? 6 : 12 * k,
          boxShadow: [
            { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(white, 0.06), inset: true },
            { offsetX: 0, offsetY: 10, blurRadius: 22, spreadDistance: 0, color: cover.shadow },
          ],
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="38%" r="75%" fx="50%" fy="38%">
            <Stop offset="0%" stopColor={learn.card[0]} />
            <Stop offset="62%" stopColor={learn.card[1]} />
            <Stop offset="100%" stopColor={learn.card[2]} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
      </Svg>
      <View style={[styles.accent, { backgroundColor: color }]} />
      <View style={styles.inner} />
      <CourseEmblem color={color} piece={course.piece} state={progress.emblem} ring={progress.ring} size={small ? 46 : Math.round(86 * k)} />
      <AppText
        variant="navTitle"
        lang={lang}
        style={[styles.center, small ? styles.smallTitle : { fontSize: 19 * k, lineHeight: 23 * k }]}
        color={eos.bone}
      >
        {localized(course.title, lang)}
      </AppText>
      <AppText variant="label" color={tone.mist} style={[styles.center, { fontSize: small ? 9 : 10 * k, letterSpacing: 1.2, fontWeight: '800' }]}>
        {`${course.ratingMin}–${course.ratingMax}`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { gap: 8 },
  card: { borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  inner: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderRadius: 6, borderWidth: 1, borderColor: alpha(white, 0.05) },
  center: { textAlign: 'center' },
  smallTitle: { fontSize: 10, lineHeight: 13 },
});

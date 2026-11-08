import { chapterCycleStats, cycleTargetSec, localized, type CourseProgress, type LibraryAttemptRecord } from '@tac/core/library';
import { alpha, eos, graphite, layout, learn, radii, space, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Check, Download, Lock, Star, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HAS_OFFLINE } from '@/platform/capabilities';
import { CourseEmblem } from '@/features/learn/CourseEmblem';
import { useCourseContent, useCourseProgress, useCourses, useCourseSummary, type DownloadView } from '@/features/library/model';
import { useAttempts, useLibraryStore } from '@/features/library/store';
import { downloadCourse } from '@/features/library/sync';
import { plural } from '@/features/offline/format';
import { toast } from '@/shell/toast/store';
import { AppText, PlateButton, ProgressBar, Tap, useLang } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { clock, courseCta, courseHref, lastTry, lessonsOf, nextLesson, openChapter, passedInCycle, type CourseLike } from './model';
import { BackLink, Glow, ThemeTile, type TileLook } from './parts';
import { courseTones, type CourseTones } from './tones';

// /course/[courseId] (canvas LearnCourse, LearnCourseUA, LearnStates
// "Chapter row & exam row"): emblem header, numbers, the cycle card (a
// progress bar on the first pass, the cycles strip after), the chapters
// (all open; the next one in order is highlighted), the exam row, and the
// docked CTA. The header chip downloads the course like a book.

const DOCK_H = layout.plateHeight.lg + space[6] + space[8];

export function CourseScreen({ courseId }: { courseId: string }) {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  // A deep link can land here first: the list brings the summary.
  const { load, retry } = useCourses();
  const summary = useCourseSummary(courseId);
  const content = useCourseContent(courseId);
  const course: CourseLike | null = summary ?? content.course;
  const progress = useCourseProgress(course);
  const attempts = useAttempts();

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/learn' as Href);
  };

  if (!course || !progress) {
    const failed = load === 'error' && !content.loading;
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="course-page">
        {failed ? (
          <>
            <AppText variant="body" color={eos.ash} style={styles.centerText}>
              {t('courses.loading_failed')}
            </AppText>
            <PlateButton testID="course-retry" label={t('library.retry')} variant="slate" size="sm" onPress={retry} />
          </>
        ) : (
          <ActivityIndicator color={eos.ash} />
        )}
      </View>
    );
  }

  const tones = courseTones(course.color);
  const cta = courseCta(course, progress, t, lang);
  const hours = course.minutesPerCycle >= 90;

  return (
    <View style={styles.root} testID="course-page">
      <View style={[styles.header, { marginTop: insets.top }]}>
        <BackLink testID="course-back" label={t('courses.back')} onPress={back} />
        <View style={styles.flex} />
        <DownloadChip courseId={course.id} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: DOCK_H + insets.bottom }]}>
        <Glow color={tones.tint(0.26)} size={380} style={styles.glow} />
        <View style={styles.hero}>
          {/* A passed course restarted in a new cycle shows that cycle's ring (LearnCourseUA). */}
          <CourseEmblem
            color={course.color}
            piece={course.piece}
            state={progress.emblem === 'passed' && progress.ring < 1 ? 'progress' : progress.emblem}
            ring={progress.ring}
            size={96}
            testID="course-emblem"
          />
          <View style={styles.flex}>
            <AppText variant="label" color={tones.ink}>
              {t('courses.kicker', { min: course.ratingMin, max: course.ratingMax })}
            </AppText>
            <AppText variant="heading" accessibilityRole="header" style={styles.title} testID="course-title">
              {localized(course.title, lang)}
            </AppText>
            <AppText variant="body" color={eos.ash} style={styles.description}>
              {localized(course.description, lang)}
            </AppText>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat value={t('courses.chapters_value', { n: course.chapters.length })} label={t('courses.stat.chapters')} />
          <Stat value={String(progress.total)} label={t('courses.stat.puzzles')} />
          <Stat
            value={hours ? t('courses.hours', { n: Math.round(course.minutesPerCycle / 60) }) : t('courses.minutes', { n: course.minutesPerCycle })}
            label={t('courses.stat.cycle')}
          />
        </View>

        {progress.cycle >= 2 || progress.cycleComplete ? <CyclesStrip progress={progress} tones={tones} /> : <FirstPass progress={progress} tones={tones} />}

        <View style={styles.chaptersHead}>
          <AppText variant="label">{t('courses.chapters')}</AppText>
          <AppText variant="caption" color={eos.dust} testID="course-solved-of">
            {progress.cycle >= 2
              ? t('courses.chapters_cycle', { c: progress.cycle, done: progress.done, total: progress.total })
              : t('courses.solved_of', { done: progress.done, total: progress.total })}
          </AppText>
        </View>
        <View style={styles.chapters}>
          {course.chapters.map((c, i) => (
            <ChapterRow key={c.id} course={course} index={i} progress={progress} attempts={attempts} tones={tones} />
          ))}
          <ExamRow course={course} progress={progress} />
        </View>

        <RemoveDownload courseId={course.id} />
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]} pointerEvents="box-none">
        <LinearGradient pointerEvents="none" colors={['transparent', eos.ink]} locations={[0, 0.3]} style={StyleSheet.absoluteFill} />
        <PlateButton testID="course-cta" label={cta.label} size="lg" block onPress={cta.run} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="valueSm" numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>
        {value}
      </AppText>
      <AppText variant="label" style={styles.statLabel} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/** Cycle 1: "first pass · no target yet", the bar, solved and the running average. */
function FirstPass({ progress, tones }: { progress: CourseProgress; tones: CourseTones }) {
  const t = useT();
  const avg = progress.cycles.find((c) => c.cycle === 1)?.avgSec ?? null;
  return (
    <View style={styles.card} testID="course-cycle-card">
      <View style={styles.cardHead}>
        <AppText variant="label">{t('courses.cycle', { n: 1 })}</AppText>
        <AppText variant="caption" color={eos.ash}>
          {t('courses.cycle_first')}
        </AppText>
      </View>
      <ProgressBar value={progress.total ? progress.done / progress.total : 0} height={5} colors={tones.bar} trackColor={eos.well} style={styles.cardBar} />
      <View style={styles.cardFoot}>
        <AppText variant="caption" color={tone.mist}>
          {t('courses.solved_of', { done: progress.done, total: progress.total })}
        </AppText>
        {avg != null ? (
          <AppText variant="caption" color={tone.mist}>
            {t('courses.avg', { s: avg })}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

type CycleBox = { n: number; kind: 'done' | 'now' | 'later'; line: string };

/** Cycle ≥ 2 (LearnCourseUA): done with its average, now and next with their targets. */
function CyclesStrip({ progress, tones }: { progress: CourseProgress; tones: CourseTones }) {
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
      ? t('courses.cycle_avg', { s: stats?.avgSec ?? 0 })
      : target != null
        ? t('courses.cycle_target', { s: target })
        : n === 1
          ? t('courses.cycle_first_short')
          : '—';
    return { n, kind: done ? 'done' : now ? 'now' : 'later', line };
  });
  return (
    <View style={styles.card} testID="course-cycles">
      <View style={styles.cardHead}>
        <AppText variant="label">{t('courses.cycles')}</AppText>
        <AppText variant="caption" color={eos.ash} numberOfLines={1} style={styles.shrink}>
          {t('courses.cycles_hint')}
        </AppText>
      </View>
      <View style={styles.cycleRow}>
        {boxes.map((b) => (
          <View
            key={b.n}
            testID={`course-cycle-${b.n}`}
            style={[
              styles.cycleBox,
              b.kind === 'done' ? styles.cycleDone : b.kind === 'now' ? { backgroundColor: tones.tint(0.14), borderColor: tones.tint(0.6) } : styles.cycleLater,
            ]}
          >
            <AppText variant="captionStrong" numberOfLines={1} color={b.kind === 'done' ? tone.sage : b.kind === 'now' ? tones.chip : eos.dust} style={styles.cycleKicker}>
              {b.kind === 'done' ? t('courses.cycle_done', { n: b.n }) : b.kind === 'now' ? t('courses.cycle_now', { n: b.n }) : t('courses.cycle_next', { n: b.n })}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={1} color={b.kind === 'later' ? tone.mist : eos.bone} style={styles.cycleLine}>
              {b.line}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function ChapterRow({
  course,
  index,
  progress,
  attempts,
  tones,
}: {
  course: CourseLike;
  index: number;
  progress: CourseProgress;
  attempts: readonly LibraryAttemptRecord[];
  tones: CourseTones;
}) {
  const t = useT();
  const { lang } = useLang();
  const c = course.chapters[index];
  const p = progress.chapters[index];
  const recommended = !progress.cycleComplete && nextLesson(course, progress) === index;
  const title = localized(c.title, lang);
  const look: TileLook = p.complete ? 'done' : recommended ? 'now' : 'idle';
  const avg = p.complete ? chapterCycleStats(course.id, c.puzzleIds, attempts, progress.cycle).avgSec : null;
  const right = p.complete
    ? progress.cycle >= 2
      ? t('courses.row_cycle', { c: progress.cycle, time: clock(avg ?? 0) })
      : t('courses.row_avg', { time: clock(avg ?? 0) })
    : p.done > 0
      ? `${p.done}/${p.total}`
      : String(p.total);
  const a11y = t(recommended ? 'courses.chapter_next_a11y' : 'courses.chapter_a11y', { n: index + 1, title, done: p.done, total: p.total });
  return (
    <Tap
      testID={`course-chapter-${index}`}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => openChapter(course, progress, index)}
      style={[styles.row, index > 0 && styles.seam, recommended && { backgroundColor: tones.tint(0.1) }]}
    >
      <ThemeTile theme={c.theme} look={look} tones={tones} />
      <View style={styles.flex}>
        <AppText variant="captionStrong" color={graphite[600]} style={styles.rowKicker}>
          {t('courses.chapter_n', { n: index + 1 })}
        </AppText>
        <AppText variant="bodyStrong" color={p.complete || recommended || p.done > 0 ? eos.bone : graphite[300]}>
          {title}
        </AppText>
        {!p.complete && p.done > 0 ? <ProgressBar value={p.done / p.total} height={3} colors={tones.bar} trackColor={eos.well} style={styles.rowBar} /> : null}
      </View>
      <AppText
        variant={p.complete || p.done > 0 ? 'captionStrong' : 'caption'}
        color={p.complete ? tone.sageDeep : p.done > 0 ? eos.ash : graphite[600]}
        style={styles.tabular}
        testID={`course-chapter-${index}-state`}
      >
        {right}
      </AppText>
    </Tap>
  );
}

/** Locked (hatched, lock) · open (gold, app-only: the canvas draws locked and passed) · passed (gold). */
function ExamRow({ course, progress }: { course: CourseLike; progress: CourseProgress }) {
  const t = useT();
  const tn = useTn();
  const exam = course.exam;
  const open = progress.examOpen && !passedInCycle(progress);
  const passed = !open ? progress.passedExam : null;
  const tried = lastTry(progress);

  if (!open && !passed) {
    const line = plural(tn, 'courses.exam_locked', lessonsOf(progress).length);
    return (
      <View style={[styles.examRow, styles.seam]} testID="course-exam-locked" accessible accessibilityLabel={t('courses.exam_a11y_locked', { line })}>
        <Hatch />
        <View style={[styles.examIcon, styles.examIconLocked]}>
          <Lock size={14} color={eos.dust} strokeWidth={2.2} />
        </View>
        <View style={styles.flex}>
          <AppText variant="turnTitle" color={graphite[300]}>
            {t('courses.exam')}
          </AppText>
          <AppText variant="caption" color={eos.dust} style={styles.examLine}>
            {line}
          </AppText>
        </View>
        <AppText variant="caption" color={graphite[600]}>
          {String(exam.count)}
        </AppText>
      </View>
    );
  }

  const line = passed
    ? t('courses.exam_passed', { score: passed.score, total: passed.total })
    : tried
      ? t('courses.exam_retry', { score: tried.score, total: tried.total, pass: exam.passMark })
      : t('courses.exam_open', { pass: exam.passMark, total: exam.count });
  return (
    <Tap
      testID={passed ? 'course-exam-passed' : 'course-exam-open'}
      accessibilityRole="button"
      accessibilityLabel={t('courses.exam_a11y', { line })}
      onPress={() => router.push(passed ? courseHref.certificate(course.id) : courseHref.exam(course.id))}
      style={[styles.examRow, styles.seam, styles.examGold]}
    >
      <View style={[styles.examIcon, styles.examIconGold]}>
        <Star size={15} color={tone.gold} strokeWidth={2} />
      </View>
      <View style={styles.flex}>
        <AppText variant="turnTitle" color={tone.goldInk}>
          {t('courses.exam')}
        </AppText>
        <AppText variant="caption" color={eos.ash} style={styles.examLine}>
          {line}
        </AppText>
      </View>
      <AppText variant="captionStrong" color={tone.gold} style={styles.tabular}>
        {passed ? `${passed.score}/${passed.total}` : String(exam.count)}
      </AppText>
    </Tap>
  );
}

/** The locked row's 135° hatching (repeating-linear-gradient, 8 pt bands). */
function Hatch() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.hatchClip]}>
      {Array.from({ length: 40 }, (_, i) => (
        <View key={i} style={[styles.hatch, { left: i * 16 - 60 }]} />
      ))}
    </View>
  );
}

function useCourseDownloadView(id: string): DownloadView {
  return useLibraryStore((s) => (s.courses[id] ? 'downloaded' : s.downloads[id] === 'loading' ? 'downloading' : 'remote'));
}

/** Offline copies are app-only (platform/capabilities). */
function DownloadChip({ courseId }: { courseId: string }) {
  return HAS_OFFLINE ? <DownloadChipInner courseId={courseId} /> : null;
}

function DownloadChipInner({ courseId }: { courseId: string }) {
  const t = useT();
  const state = useCourseDownloadView(courseId);
  const failed = useLibraryStore((s) => s.downloads[courseId] === 'error' || s.downloads[courseId] === 'offline');
  if (state === 'downloaded') {
    return (
      <View style={[styles.chip, styles.chipOffline]} testID="course-offline-chip">
        <Check size={13} color={tone.sageDeep} strokeWidth={2.6} />
        <AppText variant="captionStrong" color={tone.sage}>
          {t('library.offline_chip')}
        </AppText>
      </View>
    );
  }
  if (state === 'downloading') {
    return (
      <View style={[styles.chip, styles.chipIdle]} testID="course-downloading">
        <ActivityIndicator size="small" color={tone.copper} style={styles.chipSpinner} />
        <AppText variant="captionStrong" color={eos.ash}>
          {t('library.downloading')}
        </AppText>
      </View>
    );
  }
  return (
    <Tap
      testID="course-download"
      accessibilityRole="button"
      accessibilityLabel={failed ? t('library.download_failed') : t('library.download')}
      onPress={() => void downloadCourse(courseId)}
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

function RemoveDownload({ courseId }: { courseId: string }) {
  const t = useT();
  const stored = useLibraryStore((s) => s.courses[courseId]);
  if (!stored) return null;
  const kb = Math.max(1, Math.round(JSON.stringify(stored).length / 1024));
  return (
    <Tap
      testID="course-remove"
      accessibilityRole="button"
      accessibilityLabel={t('library.remove_a11y')}
      onPress={() => {
        useLibraryStore.getState().removeCourse(courseId);
        toast.show({ title: t('courses.removed') });
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
  center: { alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: layout.gutter },
  centerText: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space[1] },
  glow: { top: -60, alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  title: { marginTop: space[0.5], fontSize: 28, lineHeight: 34 },
  description: { marginTop: space[0.5], fontSize: 13, lineHeight: 18 },
  stats: { marginTop: space[4], flexDirection: 'row', gap: space[2] },
  stat: { flex: 1, padding: space[2.5], borderRadius: radii.lg, backgroundColor: eos.slate },
  statValue: { fontSize: 18, lineHeight: 24 },
  statLabel: { fontSize: 10 },
  card: { marginTop: space[3], padding: space[3.5], borderRadius: radii.xl, backgroundColor: eos.slate, borderWidth: 1, borderColor: alpha(eos.bone, 0.05) },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2] },
  cardBar: { marginTop: space[2.5] },
  cardFoot: { marginTop: space[1.5], flexDirection: 'row', justifyContent: 'space-between' },
  cycleRow: { marginTop: space[2.5], flexDirection: 'row', gap: space[2] },
  cycleBox: { flex: 1, minWidth: 0, paddingVertical: space[2], paddingHorizontal: space[2.5], borderRadius: radii.md, borderWidth: 1 },
  cycleDone: { backgroundColor: alpha(tone.sageDeep, 0.1), borderColor: alpha(tone.sageDeep, 0.35) },
  cycleLater: { backgroundColor: learn.discLo, borderColor: 'transparent' },
  cycleKicker: { fontSize: 11, textTransform: 'uppercase' },
  cycleLine: { marginTop: space[0.5], fontSize: 13 },
  chaptersHead: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  chapters: { marginTop: space[2], borderRadius: radii.xl, backgroundColor: eos.slate, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2.5], paddingHorizontal: space[3.5], minHeight: 56 },
  seam: { borderTopWidth: 1, borderTopColor: graphite[800] },
  rowKicker: { fontSize: 11, lineHeight: 14 },
  rowBar: { marginTop: space[1.5] },
  examRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3.5], minHeight: 60 },
  examGold: { backgroundColor: alpha(tone.gold, 0.07) },
  examIcon: { width: 30, height: 30, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  examIconLocked: { backgroundColor: learn.discLo, borderWidth: 1.5, borderColor: learn.ringTrack },
  examIconGold: { backgroundColor: alpha(tone.gold, 0.16) },
  examLine: { marginTop: space[0.5] },
  hatchClip: { overflow: 'hidden' },
  hatch: { position: 'absolute', top: -40, bottom: -40, width: 8, backgroundColor: alpha(eos.bone, 0.015), transform: [{ rotate: '45deg' }] },
  chip: { height: 26, paddingHorizontal: space[2.5], marginRight: space[2], borderRadius: radii.full, flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  chipOffline: { backgroundColor: alpha(tone.sageDeep, 0.14) },
  chipIdle: { backgroundColor: eos.rise },
  chipSpinner: { transform: [{ scale: 0.6 }] },
  remove: { marginTop: space[4], minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space[2], alignSelf: 'flex-start' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space[6], paddingHorizontal: layout.gutter },
});

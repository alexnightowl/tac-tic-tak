import { chapterCycleStats, cycleTargetSec, localized, type CourseProgress, type LibraryAttemptRecord } from '@tac/core/library';
import { alpha, eos, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Check, Lock, Star } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CourseEmblem } from '@/features/learn/CourseEmblem';
import { clock, courseCta, courseHref, lastTry, lessonsOf, nextLesson, openChapter, passedInCycle, type CourseLike } from '@/features/courses/model';
import { courseTones, type CourseTones } from '@/features/courses/tones';
import { useCourseContent, useCourseProgress, useCourses, useCourseSummary } from '@/features/library/model';
import { useAttempts } from '@/features/library/store';
import { plural } from '@/features/offline/format';
import { ThemeIcon } from '@/features/review/ThemeIcon';
import { PlateButton } from '@/ui';
import { useLang, useT, useTn } from '@/ui/lang';
import { Bar, Card, DText, Hover, Label, Num, Title } from '../kit';
import { DesktopPage } from '../Page';
import { useRawWindow } from '@/platform/webFrame';
import { dx } from '../tokens';
import { colWidth, CyclePills, LearnSwitch, SectionHead, usePageWidth } from './parts';

// /course/[courseId] on a desktop window (canvas DXCourse): the course hero,
// the chapters in two columns, and on the right the cycle card with the
// CTA and the exam card. The app's rules: every chapter is open, the next
// one in order is outlined, the exam opens when the cycle's lessons are done.

export function DxCourse({ courseId }: { courseId: string }) {
  const t = useT();
  const { lang } = useLang();
  const { load, retry } = useCourses();
  const summary = useCourseSummary(courseId);
  const content = useCourseContent(courseId);
  const course: CourseLike | null = summary ?? content.course;
  const progress = useCourseProgress(course);
  const attempts = useAttempts();
  const { width: winW } = useRawWindow();
  const asideW = winW < 1280 ? 300 : 340;
  const w = usePageWidth(asideW);
  const back = { label: t('courses.back'), onPress: () => (router.canGoBack() ? router.back() : router.replace('/learn' as Href)) };

  if (!course || !progress) {
    const failed = load === 'error' && !content.loading;
    return (
      <DesktopPage testID="dx-course" title={t('learn.title')} back={back} right={<LearnSwitch value="courses" />}>
        <View style={styles.center}>
          {failed ? (
            <>
              <DText size={14} color={dx.ash}>
                {t('courses.loading_failed')}
              </DText>
              <PlateButton testID="dx-course-retry" label={t('library.retry')} variant="slate" size="sm" onPress={retry} />
            </>
          ) : (
            <ActivityIndicator color={eos.ash} />
          )}
        </View>
      </DesktopPage>
    );
  }

  const tones = courseTones(course.color);
  const hours = course.minutesPerCycle >= 90;
  const lessons = lessonsOf(progress);
  const passedLessons = lessons.filter((c) => c.complete).length;
  const cols = w >= 560 ? 2 : 1;
  const tileW = colWidth(w, cols, 10);
  const narrow = w > 0 && w < 640;

  return (
    <DesktopPage
      testID="dx-course"
      title={localized(course.title, lang)}
      back={back}
      right={<LearnSwitch value="courses" />}
      asideWidth={asideW}
      aside={
        <>
          <CycleCard course={course} progress={progress} tones={tones} width={asideW} />
          <ExamCard course={course} progress={progress} />
        </>
      }
    >
      <View>
        <Card texture style={[styles.hero, narrow && styles.heroNarrow]} testID="dx-course-hero">
          <CourseEmblem
            color={course.color}
            piece={course.piece}
            state={progress.emblem === 'passed' && progress.ring < 1 ? 'progress' : progress.emblem}
            ring={progress.ring}
            size={110}
            testID="dx-course-emblem"
          />
          <View style={styles.heroText}>
            <Label color={tones.ink}>{t('courses.kicker', { min: course.ratingMin, max: course.ratingMax })}</Label>
            <Title size={34} style={styles.mt4} numberOfLines={1}>
              {localized(course.title, lang)}
            </Title>
            <DText size={14} color={dx.ash} style={styles.mt4}>
              {localized(course.description, lang)}
            </DText>
          </View>
          <View style={styles.stats}>
            <Stat value={t('courses.chapters_value', { n: course.chapters.length }).replace(/\s/g, '')} label={t('dx.learn.stat.chapters')} />
            <Stat value={String(course.puzzleCount)} label={t('dx.learn.stat.puzzles')} />
            <Stat
              value={hours ? t('courses.hours', { n: Math.round(course.minutesPerCycle / 60) }) : t('courses.minutes', { n: course.minutesPerCycle })}
              label={t('dx.learn.stat.cycle')}
            />
          </View>
        </Card>

        <View style={styles.mt20}>
          <SectionHead
            label={t('courses.chapters')}
            right={t('dx.learn.chapters_done', { done: passedLessons, total: lessons.length })}
            testID="dx-course-solved-of"
          />
        </View>
        <View style={styles.grid}>
          {w > 0 ? course.chapters.map((_, i) => <ChapterTile key={i} course={course} index={i} progress={progress} attempts={attempts} tones={tones} width={tileW} />) : null}
        </View>
      </View>
    </DesktopPage>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Num size={24}>{value}</Num>
      <DText size={12} color={dx.dust}>
        {label}
      </DText>
    </View>
  );
}

function ChapterTile({
  course,
  index,
  progress,
  attempts,
  tones,
  width,
}: {
  course: CourseLike;
  index: number;
  progress: CourseProgress;
  attempts: readonly LibraryAttemptRecord[];
  tones: CourseTones;
  width: number;
}) {
  const t = useT();
  const { lang } = useLang();
  const c = course.chapters[index];
  const p = progress.chapters[index];
  // A finished chapter shows this cycle's average time a puzzle (the phone's row).
  const avg = p.complete ? (chapterCycleStats(course.id, c.puzzleIds, attempts, progress.cycle).avgSec ?? 0) : null;
  const avgLine =
    avg == null ? null : progress.cycle >= 2 ? t('courses.row_cycle', { c: progress.cycle, time: clock(avg) }) : t('courses.row_avg', { time: clock(avg) });
  const now = !progress.cycleComplete && nextLesson(course, progress) === index;
  const lit = p.complete || now || p.done > 0;
  const title = localized(c.title, lang);
  return (
    <Hover
      testID={`dx-course-chapter-${index}`}
      accessibilityLabel={t(now ? 'courses.chapter_next_a11y' : 'courses.chapter_a11y', { n: index + 1, title, done: p.done, total: p.total })}
      onPress={() => openChapter(course, progress, index)}
      style={[styles.chapter, { width }, now && { backgroundColor: dx.pickedBg, boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: tones.color, inset: true }] }]}
      hoverStyle={styles.chapterHover}
    >
      <View style={[styles.chapterIcon, { backgroundColor: lit ? tones.tint(0.2) : dx.ghost }]}>
        <ThemeIcon slug={c.theme} size={24} color={lit ? tones.chip : dx.ash} />
      </View>
      <View style={styles.flex}>
        <DText size={11} weight={800} ls={1} upper color={dx.dust}>
          {t('courses.chapter_n', { n: index + 1 })}
        </DText>
        <DText size={14.5} weight={800} numberOfLines={1}>
          {title}
        </DText>
        <Bar value={p.complete ? 1 : p.total ? p.done / p.total : 0} height={4} colors={p.complete ? [alpha(tone.sageDeep, 0.6), alpha(tone.sageDeep, 0.6)] : tones.bar} style={styles.mt8} />
      </View>
      <View style={styles.chapterRight} testID={`dx-course-chapter-${index}-state`}>
        {p.complete ? (
          <>
            <Check size={14} color={dx.sage} strokeWidth={2.4} />
            <DText size={12} weight={800} color={dx.sage} tabular numberOfLines={1} testID={`dx-course-chapter-${index}-avg`}>
              {avgLine}
            </DText>
          </>
        ) : (
          <DText size={12} weight={800} color={dx.dust} tabular>{`${p.done}/${p.total}`}</DText>
        )}
      </View>
    </Hover>
  );
}

function CycleCard({ course, progress, tones, width }: { course: CourseLike; progress: CourseProgress; tones: CourseTones; width: number }) {
  const compact = width < 340;
  const t = useT();
  const { lang } = useLang();
  // The phone's model: "Continue · <chapter>, n of N" (the chapter number when that is too long for the plate).
  const cta = courseCta(course, progress, t, lang);
  // When the plate falls back to the chapter number, its title goes under it.
  const next = nextLesson(course, progress);
  const full =
    next != null
      ? t('courses.cta_continue', {
          title: localized(course.chapters[next].title, lang),
          n: Math.min(progress.chapters[next].total, progress.chapters[next].done + 1),
          total: progress.chapters[next].total,
        })
      : null;
  // The phone's 26-capital rule, measured for this plate (~12 px a Cinzel capital): too long → "Continue · Chapter N", then "Continue".
  const fits = (l: string) => l.length <= Math.floor((width - 80) / 12);
  const short = next != null ? t('courses.cta_continue_short', { ch: next + 1 }) : '';
  const label = cta.kind === 'continue' && full ? (fits(full) ? full : fits(short) ? short : t('learn.continue')) : cta.label;
  const target = cycleTargetSec(progress.cycles, progress.cycle);
  const note = progress.cycle <= 1 ? t('dx.learn.cycle_first_note') : target != null ? t('dx.learn.cycle_target_note', { s: target }) : t('dx.learn.cycle_free_note');
  const cycles = progress.cycle >= 2 || progress.cycleComplete;
  // The first pass: the running average a puzzle (the phone's FirstPass card).
  const avg = cycles ? null : (progress.cycles.find((c) => c.cycle === 1)?.avgSec ?? null);
  return (
    <Card style={styles.side} testID="dx-course-cycle-card">
      <Label>{t('courses.cycle', { n: progress.cycle })}</Label>
      <Num size={30} style={styles.mt6}>{`${progress.done} / ${progress.total}`}</Num>
      <Bar value={progress.total ? progress.done / progress.total : 0} colors={tones.bar} style={styles.mt10} />
      {avg != null ? (
        <View style={styles.cardFoot}>
          <DText size={12} color={dx.dust}>
            {t('courses.cycle_first')}
          </DText>
          <DText size={12} weight={700} color={dx.ash} tabular testID="dx-course-avg">
            {t('courses.avg', { s: avg })}
          </DText>
        </View>
      ) : null}
      <DText size={12.5} lh={18} color={dx.ash} style={styles.mt10}>
        {note}
      </DText>
      {cycles ? (
        <View style={styles.mt12}>
          <View style={styles.cyclesHead}>
            <Label size={10}>{t('courses.cycles')}</Label>
            <DText size={12} color={dx.dust} testID="dx-course-cycles-hint">
              {t('courses.cycles_hint')}
            </DText>
          </View>
          <CyclePills progress={progress} testID="dx-course-cycles" />
        </View>
      ) : null}
      <PlateButton testID="dx-course-cta" label={label} size={compact ? 'md' : 'lg'} block onPress={cta.run} style={styles.mt18} />
      {next != null && cta.kind === 'continue' && label !== full ? (
        <DText size={12.5} color={dx.ash} align="center" numberOfLines={2} style={styles.mt8} testID="dx-course-cta-chapter">
          {t('learn.course.chapter_line', { n: next + 1, title: localized(course.chapters[next].title, lang), done: progress.chapters[next].done, total: progress.chapters[next].total })}
        </DText>
      ) : null}
    </Card>
  );
}

/** Locked (lock, dimmed) · open (gold, opens the exam) · passed (gold, the certificate). */
function ExamCard({ course, progress }: { course: CourseLike; progress: CourseProgress }) {
  const t = useT();
  const tn = useTn();
  const exam = course.exam;
  const open = progress.examOpen && !passedInCycle(progress);
  const passed = !open ? progress.passedExam : null;
  const tried = lastTry(progress);
  const meta = t('dx.learn.exam_meta', { count: plural(tn, 'library.puzzles', exam.count), pass: exam.passMark });
  const locked = !open && !passed;
  const line = locked
    ? plural(tn, 'courses.exam_locked', lessonsOf(progress).length)
    : passed
      ? t('courses.exam_passed', { score: passed.score, total: passed.total })
      : tried
        ? t('courses.exam_retry', { score: tried.score, total: tried.total, pass: exam.passMark })
        : t('courses.exam_open', { pass: exam.passMark, total: exam.count });
  const body = (
    <>
      <View style={styles.examHead}>
        <View style={[styles.examIcon, !locked && styles.examIconGold]}>
          {locked ? <Lock size={17} color={dx.ash} strokeWidth={1.8} /> : <Star size={17} color={tone.gold} strokeWidth={2} />}
        </View>
        <View style={styles.flex}>
          <DText size={14} weight={800} color={locked ? eos.bone : tone.goldInk}>
            {t('courses.exam')}
          </DText>
          <DText size={12.5} color={dx.dust}>
            {meta}
          </DText>
        </View>
      </View>
      <DText size={12.5} lh={18} color={dx.ash} style={styles.mt12}>
        {line}
      </DText>
    </>
  );
  if (locked) {
    return (
      <Card style={[styles.side, styles.locked]} testID="dx-course-exam-locked">
        <View accessible accessibilityLabel={t('courses.exam_a11y_locked', { line })}>
          {body}
        </View>
      </Card>
    );
  }
  return (
    <Hover
      testID={passed ? 'dx-course-exam-passed' : 'dx-course-exam-open'}
      accessibilityLabel={t('courses.exam_a11y', { line })}
      onPress={() => router.push(passed ? courseHref.certificate(course.id) : courseHref.exam(course.id))}
      style={[styles.side, styles.examGold]}
      hoverStyle={styles.examGoldHover}
    >
      {body}
    </Hover>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  cyclesHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10, rowGap: 2 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 6 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt18: { marginTop: 18 },
  mt20: { marginTop: 20 },
  center: { paddingVertical: 80, alignItems: 'center', gap: 12 },
  hero: { padding: 26, flexDirection: 'row', alignItems: 'center', gap: 24 },
  heroNarrow: { flexWrap: 'wrap' },
  heroText: { flex: 1, minWidth: 220 },
  stats: { flexDirection: 'row', gap: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  chapter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  chapterHover: { backgroundColor: dx.chipHover },
  chapterIcon: { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chapterRight: { minWidth: 40, alignItems: 'flex-end', gap: 4 },
  side: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: dx.card,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  locked: { opacity: 0.85 },
  examHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  examIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: dx.ghost },
  examIconGold: { backgroundColor: alpha(tone.gold, 0.16) },
  examGold: { backgroundColor: alpha(tone.gold, 0.07) },
  examGoldHover: { backgroundColor: alpha(tone.gold, 0.11) },
});

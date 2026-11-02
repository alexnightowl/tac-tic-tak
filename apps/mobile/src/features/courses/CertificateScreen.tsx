import { localeFor } from '@tac/core/format';
import { localized, type CourseExamRecord, type CoursePiece } from '@tac/core/library';
import { course as ink, eos, layout, radii, space, tone } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { meQuery } from '@/features/auth/session';
import { useCourseContent, useCourseProgress, useCourseSummary } from '@/features/library/model';
import { useExams } from '@/features/library/store';
import { plural } from '@/features/offline/format';
import { PROFILE_URL } from '@/features/profile/ProfileScreen';
import { useAuthStore } from '@/stores/authStore';
import { AppText, PlateButton, Tap, useLang } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { Medal } from './Medal';
import { courseHref, type CourseLike } from './model';
import { SPARKS, useSettleStyle, useSparksOn, useSparkStyle } from './motion';
import { courseTones } from './tones';

// /course/certificate?course[&at] (canvas LearnCourseDone): after a
// passing exam (`at` = that try, which also plays the fanfare) or from the
// passed exam row (the best passing try). Rising sparks, the tilted
// parchment certificate with the course seal, a per-course line, Back to
// Learn, Share (system sheet: a line and the player's profile link, as the
// achievement sheet shares) and the next cycle.

const PIECES: Record<CoursePiece, number> = {
  pawn: require('../../../assets/learn/pieces/pawn.png'),
  knight: require('../../../assets/learn/pieces/knight.png'),
  queen: require('../../../assets/learn/pieces/queen.png'),
  king: require('../../../assets/learn/pieces/king.png'),
  bishop: require('../../../assets/learn/pieces/pawn.png'),
  rook: require('../../../assets/learn/pieces/pawn.png'),
};

export function CertificateScreen({ courseId, at }: { courseId: string; at: string | null }) {
  const insets = useSafeAreaInsets();
  const summary = useCourseSummary(courseId);
  const content = useCourseContent(courseId);
  const course: CourseLike | null = summary ?? content.course;
  const progress = useCourseProgress(course);
  const exams = useExams();
  const record = (at ? exams.find((e) => e.courseId === courseId && e.takenAt === at) : null) ?? progress?.passedExam ?? null;
  if (!course || !progress || !record) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="course-certificate">
        <ActivityIndicator color={eos.ash} />
      </View>
    );
  }
  return <Certificate course={course} record={record} fresh={!!at} nextCycle={progress.cycleComplete ? progress.cycle + 1 : null} />;
}

function Certificate({ course, record, fresh, nextCycle }: { course: CourseLike; record: CourseExamRecord; fresh: boolean; nextCycle: number | null }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const tones = courseTones(course.color);
  const settle = useSettleStyle(200);
  const sparks = useSparksOn();
  const me = useAuthStore((s) => s.user);
  const profile = useQuery({ ...meQuery, enabled: !!me });
  const name = profile.data?.displayName?.trim() || me?.nickname || '';
  const title = localized(course.title, lang);
  const lessonsPuzzles = course.chapters.reduce((n, c) => n + c.count, 0);
  const date = formatDate(record.takenAt, lang);
  const cycleN = nextCycle ?? record.cycle + 1;
  const headKey = `courses.cert.headline.${course.id}`;
  const lineKey = `courses.cert.line.${course.id}`;
  const headline = t(headKey) !== headKey ? t(headKey) : t('courses.cert.headline');
  const line = t(lineKey, { n: cycleN }) !== lineKey ? t(lineKey, { n: cycleN }) : t('courses.cert.line', { n: cycleN });
  const certW = Math.min(330, width - 2 * layout.gutter - 24);

  useEffect(() => {
    if (fresh) feel.emit('normGateUp');
  }, [fresh]);

  const share = () => {
    const url = me ? PROFILE_URL(me.nickname) : '';
    const message = t('courses.cert.share_message', { course: title, score: record.score, total: record.total });
    void Share.share(Platform.OS === 'ios' && url ? { url, message } : { message: url ? `${message} ${url}` : message });
  };

  return (
    <View style={styles.root} testID="course-certificate">
      {sparks
        ? SPARKS.sparks.map((s, i) => <Spark key={i} left={(s.left / 402) * width} bottom={(SPARKS.bottom / 874) * height} delay={s.delay} />)
        : null}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: 170 + insets.bottom }]}>
        <AppText variant="label" color={tone.gold} style={styles.center} testID="course-certificate-kicker">
          {t('courses.cert.kicker')}
        </AppText>

        <Animated.View style={[styles.certWrap, settle]}>
          {/* The drop shadow lives on its own layer: on the card itself iOS draws it over the overflowing seal. */}
          <View pointerEvents="none" style={[styles.certShadow, styles.tilt, { width: certW }]} />
          <View
            style={[styles.cert, styles.tilt, { width: certW }]}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('courses.cert.a11y', { course: title, name, score: record.score, total: record.total, date })}
            testID="course-certificate-card"
          >
            <LinearGradient colors={ink.certFace} start={{ x: 0.41, y: 0 }} end={{ x: 0.59, y: 1 }} style={[StyleSheet.absoluteFill, styles.face]} />
            <View pointerEvents="none" style={styles.frame} />
            <View pointerEvents="none" style={styles.frameInner} />
            <AppText variant="captionStrong" color={ink.certBrand} style={styles.brand}>
              {t('courses.cert.brand')}
            </AppText>
            <AppText variant="turnTitle" color={ink.certCaption} style={styles.certTitle}>
              {t('courses.cert.title')}
            </AppText>
            <AppText variant="display" color={ink.certTitle} style={styles.courseTitle} numberOfLines={2} adjustsFontSizeToFit>
              {title}
            </AppText>
            <AppText variant="captionStrong" color={ink.certMeta} style={styles.range}>
              {plural(tn, 'courses.cert.range', course.chapters.length, { min: course.ratingMin, max: course.ratingMax })}
            </AppText>
            <View style={styles.rule} />
            <AppText variant="body" color={ink.certBody} style={styles.awarded}>
              {t('courses.cert.awarded')}
            </AppText>
            <AppText variant="title" color={ink.certName} style={styles.name} numberOfLines={1} adjustsFontSizeToFit testID="course-certificate-name">
              {name}
            </AppText>
            <View style={styles.meta}>
              <AppText variant="captionStrong" color={ink.certCaption} style={styles.metaText}>
                {t('courses.cert.exam', { score: record.score, total: record.total })}
              </AppText>
              <AppText variant="captionStrong" color={ink.certCaption} style={styles.metaText}>
                {plural(tn, 'courses.cert.puzzles', lessonsPuzzles)}
              </AppText>
              <AppText variant="captionStrong" color={ink.certCaption} style={styles.metaText}>
                {date}
              </AppText>
            </View>
            <Medal size={80} stops={tones.seal} ring="seal" style={styles.seal}>
              <Image source={PIECES[course.piece] ?? PIECES.pawn} style={styles.sealPiece} tintColor={tone.parchment} contentFit="contain" />
            </Medal>
          </View>
        </Animated.View>

        <AppText variant="heading" accessibilityRole="header" style={styles.headline} testID="course-certificate-headline">
          {headline}
        </AppText>
        <AppText variant="body" color={eos.ash} style={styles.line}>
          {line}
        </AppText>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]}>
        <PlateButton testID="course-certificate-back" label={t('courses.cert.back')} size="lg" block onPress={() => router.dismissTo('/learn' as Href)} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <PlateButton testID="course-certificate-share" label={t('courses.cert.share')} variant="slate" size="md" block onPress={share} />
          </View>
          <Tap
            testID="course-certificate-cycle"
            accessibilityRole="button"
            accessibilityLabel={nextCycle ? t('courses.cert.cycle', { n: nextCycle }) : t('courses.done.back')}
            onPress={() => (nextCycle ? router.replace(courseHref.solve(course.id, 0, nextCycle)) : router.dismissTo(courseHref.page(course.id)))}
            style={styles.textBtn}
          >
            <AppText variant="bodyStrong" color={eos.ash} style={styles.textBtnLabel} numberOfLines={1} adjustsFontSizeToFit>
              {nextCycle ? t('courses.cert.cycle', { n: nextCycle }) : t('courses.done.back')}
            </AppText>
          </Tap>
        </View>
      </View>
    </View>
  );
}

function Spark({ left, bottom, delay }: { left: number; bottom: number; delay: number }) {
  const style = useSparkStyle(delay);
  return <Animated.View pointerEvents="none" style={[styles.spark, { left, bottom }, style]} />;
}

function formatDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  } catch {
    return iso.slice(0, 10);
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  center: { alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  scroll: { paddingHorizontal: layout.gutter, alignItems: 'center' },
  spark: {
    position: 'absolute',
    width: SPARKS.size,
    height: SPARKS.size,
    borderRadius: radii.full,
    backgroundColor: tone.spark,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 6, spreadDistance: 0, color: tone.spark }],
  },
  certWrap: { marginTop: space[4] },
  tilt: { transform: [{ rotate: '-1.5deg' }] },
  cert: {
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 30,
    borderRadius: radii.board,
    alignItems: 'center',
  },
  certShadow: {
    position: 'absolute',
    backgroundColor: ink.certFace[1],
    top: 0,
    bottom: 0,
    borderRadius: radii.board,
    boxShadow: [{ offsetX: 0, offsetY: 18, blurRadius: 40, spreadDistance: 0, color: ink.medalDrop }],
  },
  face: { borderRadius: radii.board, borderWidth: 1, borderColor: ink.certEdge },
  frame: { position: 'absolute', top: 9, left: 9, right: 9, bottom: 9, borderWidth: 1.5, borderColor: ink.certFrame, borderRadius: 3 },
  frameInner: { position: 'absolute', top: 13, left: 13, right: 13, bottom: 13, borderWidth: 1, borderColor: ink.certFrameInner, borderRadius: 2 },
  brand: { fontSize: 10, letterSpacing: 3 },
  certTitle: { marginTop: space[2.5], fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' },
  courseTitle: { marginTop: 14, fontSize: 34, lineHeight: 38, textAlign: 'center' },
  range: { marginTop: space[1], letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },
  rule: { marginTop: 14, width: 60, height: 1, backgroundColor: ink.certRule },
  awarded: { marginTop: space[3], fontSize: 13 },
  name: { fontSize: 22, lineHeight: 28 },
  meta: { marginTop: 14, alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingLeft: space[1] },
  metaText: { fontSize: 10.5, textTransform: 'uppercase' },
  seal: { position: 'absolute', right: -20, bottom: -40, transform: [{ rotate: '8deg' }] },
  sealPiece: { width: 42, height: 42 },
  headline: { marginTop: 40, fontSize: 26, lineHeight: 32, textAlign: 'center' },
  line: { marginTop: space[1.5], maxWidth: 320, textAlign: 'center', lineHeight: 21 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space[4], gap: space[2], backgroundColor: eos.ink },
  row: { flexDirection: 'row', gap: space[2.5], alignItems: 'center' },
  textBtn: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  textBtnLabel: { fontSize: 13 },
});

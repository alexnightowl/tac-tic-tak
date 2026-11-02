import { arrowGeometry, normalizePieceSet, type Orientation } from '@tac/core/board';
import { localized, type Course, type CourseArrow } from '@tac/core/library';
import { course as courseInk, eos, graphite, layout, radii, space, tone } from '@tac/core/tokens';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Board } from '@/board';
import { useCourseContent, useCourseProgress } from '@/features/library/model';
import { plural } from '@/features/offline/format';
import { useAppStore } from '@/stores/appStore';
import { AppText, PlateButton, useLang } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { courseHref } from './model';
import { BackLink, ThemeTile } from './parts';
import { courseTones } from './tones';

// /course/intro?course&chapter (canvas LearnIntro): the motif in a few
// sentences and one static diagram with arrows (the move to find in blue,
// what it then hits in dashed rose). Shown before a chapter's first pass;
// in later cycles the runner skips it and its "Intro" link reopens it as
// an overlay (ChapterIntro with `onClose`).

export function IntroScreen({ courseId, chapter }: { courseId: string; chapter: number }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { course, loading } = useCourseContent(courseId);
  const progress = useCourseProgress(course);
  if (!course || !progress || !course.chapters[chapter]) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]} testID="course-intro">
        {loading ? (
          <ActivityIndicator color={eos.ash} />
        ) : (
          <>
            <AppText variant="body" color={eos.ash} style={styles.centerText}>
              {t('courses.needs_download')}
            </AppText>
            <PlateButton testID="course-intro-back" label={t('courses.done.back')} variant="slate" size="sm" onPress={() => router.back()} />
          </>
        )}
      </View>
    );
  }
  return (
    <ChapterIntro
      course={course}
      chapter={chapter}
      onBack={() => (router.canGoBack() ? router.back() : router.replace(courseHref.page(courseId)))}
      cta={t('courses.intro_start')}
      onCta={() => router.replace(courseHref.solve(courseId, chapter, progress.cycle))}
    />
  );
}

export function ChapterIntro({
  course,
  chapter,
  onBack,
  backLabel,
  cta,
  onCta,
}: {
  course: Course;
  chapter: number;
  onBack: () => void;
  backLabel?: string;
  cta: string;
  onCta: () => void;
}) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ch = course.chapters[chapter];
  const tones = courseTones(course.color);
  const size = Math.floor(Math.min(300, width - 2 * layout.gutter) / 8) * 8;
  const caption = localized(ch.intro.caption, lang);
  const dock = space[4] + layout.plateHeight.lg + Math.max(insets.bottom, space[4]) + space[2];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="course-intro">
      <View style={styles.header}>
        <BackLink testID="course-intro-back" label={backLabel ?? localized(course.title, lang)} onPress={onBack} />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: dock }]}>
        <ThemeTile theme={ch.theme} look="now" tones={tones} size={56} glyph={32} />
        <AppText variant="label" color={tones.ink} style={styles.kicker} testID="course-intro-kicker">
          {plural(tn, 'courses.intro_kicker', ch.puzzles.length, { ch: chapter + 1, chapters: course.chapters.length })}
        </AppText>
        <AppText variant="heading" accessibilityRole="header" style={styles.title} testID="course-intro-title">
          {localized(ch.title, lang)}
        </AppText>
        <AppText variant="body" color={graphite[300]} style={styles.text}>
          {localized(ch.intro.text, lang)}
        </AppText>
        <View accessible accessibilityRole="image" accessibilityLabel={t('courses.intro_board_a11y', { caption })} testID="course-intro-board">
          <Diagram fen={ch.intro.fen} arrows={ch.intro.arrows} size={size} />
        </View>
        <AppText variant="caption" color={tone.mist} style={styles.caption}>
          {caption}
        </AppText>
      </ScrollView>
      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space[4]) + space[2] }]}>
        <PlateButton testID="course-intro-start" label={cta} size="lg" block onPress={onCta} />
      </View>
    </View>
  );
}

/** The real Board, view-only, with the intro's arrows drawn over it. */
function Diagram({ fen, arrows, size }: { fen: string; arrows: readonly CourseArrow[]; size: number }) {
  const pieceSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const mirror = useAppStore((s) => s.settings.mirrorView);
  const orientation: Orientation = fen.split(' ')[1] === 'b' ? 'black' : 'white';
  const sq = size / 8;
  return (
    <View style={[styles.board, { width: size, height: size }]} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Board key={fen} initialFen={fen} orientation={orientation} mirror={mirror} pieceSet={pieceSet} moveFeel="board" coordinates={false} style={styles.fill} />
      <Svg width={size} height={size} style={styles.arrows}>
        {arrows.map((a, i) => {
          const g = arrowGeometry(a.from, a.to, size, orientation, mirror, 'straight');
          const color = a.kind === 'move' ? courseInk.arrowMove : courseInk.arrowThreat;
          return [
            <Path
              key={`s${i}`}
              d={g.shaftPath}
              stroke={color}
              strokeWidth={sq * 0.17}
              strokeLinecap="round"
              strokeDasharray={a.kind === 'threat' ? [sq * 0.25, sq * 0.2] : undefined}
              fill="none"
            />,
            <Path key={`h${i}`} d={g.headPath} fill={color} />,
          ];
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  center: { alignItems: 'center', justifyContent: 'center', gap: space[4], paddingHorizontal: layout.gutter },
  centerText: { textAlign: 'center' },
  fill: { flex: 1 },
  // Over the Board (its root sits at zIndex 1).
  arrows: { position: 'absolute', left: 0, top: 0, zIndex: 2 },
  header: { height: layout.shellHeaderHeight, paddingHorizontal: space[2], flexDirection: 'row', alignItems: 'center' },
  scroll: { paddingHorizontal: layout.gutter, paddingTop: space[1.5], alignItems: 'center' },
  kicker: { marginTop: space[2.5], textAlign: 'center' },
  title: { marginTop: space[1.5], fontSize: 30, lineHeight: 36, textAlign: 'center' },
  text: { marginTop: space[2], maxWidth: 340, fontSize: 14.5, lineHeight: 22, textAlign: 'center' },
  board: { marginTop: 18, borderRadius: radii.board, overflow: 'hidden' },
  caption: { marginTop: space[3], textAlign: 'center', fontSize: 12.5 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: space[4], paddingHorizontal: layout.gutter, backgroundColor: eos.ink },
});

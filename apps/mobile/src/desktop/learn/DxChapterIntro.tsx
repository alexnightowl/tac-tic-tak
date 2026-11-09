import { localized } from '@tac/core/library';
import { eos, graphite } from '@tac/core/tokens';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Diagram } from '@/features/courses/IntroScreen';
import { courseHref } from '@/features/courses/model';
import { ThemeTile } from '@/features/courses/parts';
import { courseTones } from '@/features/courses/tones';
import { useCourseContent, useCourseProgress } from '@/features/library/model';
import { plural } from '@/features/offline/format';
import { useRawWindow } from '@/platform/webFrame';
import { PlateButton } from '@/ui';
import { useLang, useT, useTn } from '@/ui/lang';
import { DText, Label, Title } from '../kit';
import { DesktopPage } from '../Page';
import { dx, dxSize } from '../tokens';

// /course/intro?course&chapter on a desktop window (canvas DXChapterIntro):
// the intro diagram with its arrows on the left, the motif on the right.
// Same data and CTA as the phone intro (IntroScreen).

export function DxChapterIntro({ courseId, chapter }: { courseId: string; chapter: number }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const { course, loading } = useCourseContent(courseId);
  const progress = useCourseProgress(course);
  const { width: winW, height: winH } = useRawWindow();
  const back = {
    label: t('dx.learn.back_course'),
    onPress: () => (router.canGoBack() ? router.back() : router.replace(courseHref.page(courseId))),
  };
  const ch = course?.chapters[chapter];

  if (!course || !progress || !ch) {
    return (
      <DesktopPage testID="dx-course-intro" title={t('learn.title')} back={back} right={null}>
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={eos.ash} />
          ) : (
            <DText size={14} color={dx.ash}>
              {t('courses.needs_download')}
            </DText>
          )}
        </View>
      </DesktopPage>
    );
  }

  const tones = courseTones(course.color);
  const caption = localized(ch.intro.caption, lang);
  // The caption opens with the move ("Nc7+ attacks …"): set in bold, as drawn.
  const move = /^(?:[KQRBN]?[a-h]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)[+#]?(?=\s)/.exec(caption)?.[0] ?? null;
  const textW = winW >= 1280 ? 440 : 300;
  const gap = winW >= 1280 ? 56 : 32;
  // The board fills what the header and the side text leave, in whole squares.
  const room = Math.min(winH - dxSize.header - 80, winW - dxSize.sidebar - 2 * dxSize.padX - textW - gap);
  const size = Math.max(240, Math.floor(Math.min(600, room) / 8) * 8);

  return (
    <DesktopPage
      testID="dx-course-intro"
      title={`${localized(course.title, lang)} · ${t('courses.chapter_n', { n: chapter + 1 })}`}
      back={back}
      right={null}
      scroll={false}
      bodyStyle={styles.body}
    >
      <View style={[styles.row, { gap }]}>
        <View
          style={[styles.board, { width: size }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('courses.intro_board_a11y', { caption })}
          testID="dx-course-intro-board"
        >
          <Diagram fen={ch.intro.fen} arrows={ch.intro.arrows} size={size} coordinates />
        </View>
        <View style={{ width: textW }}>
          <View style={styles.kickerRow}>
            <ThemeTile theme={ch.theme} look="now" tones={tones} size={52} glyph={28} />
            <Label color={tones.ink} style={styles.shrink}>
              {plural(tn, 'courses.intro_kicker', ch.puzzles.length, { ch: chapter + 1, chapters: course.chapters.length })}
            </Label>
          </View>
          <Title size={40} style={styles.title}>
            {localized(ch.title, lang)}
          </Title>
          <DText size={16} lh={26} color={graphite[300]} style={styles.mt12}>
            {localized(ch.intro.text, lang)}
          </DText>
          {caption ? (
            <View style={styles.example}>
              <DText size={13.5} lh={20} color={dx.ash}>
                {move ? (
                  <DText size={13.5} lh={20} weight={800} color={eos.bone}>
                    {`${move} `}
                  </DText>
                ) : null}
                {move ? caption.slice(move.length).trimStart() : caption}
              </DText>
            </View>
          ) : null}
          <PlateButton
            testID="dx-course-intro-start"
            label={t('courses.intro_start')}
            size="lg"
            onPress={() => router.replace(courseHref.solve(courseId, chapter, progress.cycle))}
            style={styles.cta}
          />
          <DText size={12.5} color={dx.dust} style={styles.mt12}>
            {t('dx.learn.intro_note')}
          </DText>
        </View>
      </View>
    </DesktopPage>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  mt12: { marginTop: 12 },
  center: { paddingVertical: 80, alignItems: 'center' },
  body: { paddingTop: 0, paddingBottom: 0 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // The phone Diagram keeps its 18 pt top margin: pulled back up here.
  board: {
    marginTop: -18,
    borderRadius: 8,
    boxShadow: [{ offsetX: 0, offsetY: 24, blurRadius: 60, spreadDistance: 0, color: dx.popShadow }],
  },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { marginTop: 16 },
  example: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: dx.card2,
  },
  cta: { marginTop: 28, alignSelf: 'flex-start', minWidth: 280 },
});

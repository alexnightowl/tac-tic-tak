import { localized, type LibraryBookSummary } from '@tac/core/library';
import { alpha, black, cover, eos, learn, tone } from '@tac/core/tokens';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Modal, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { BookCover } from '@/features/library/BookCover';
import { roman } from '@/features/library/model';
import { plural } from '@/features/offline/format';
import { AppText, textStyle, useLang } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { OPEN_BOOK as M } from './motion';

// The open-book transition (canvas LearnOpenBook): the tapped cover is
// pressed, rises to the centre while the screen darkens and blurs, its
// cover swings open around the spine onto the endpaper and the first page
// (the current chapter), then the page zooms and fades into the book
// screen, which is pushed underneath (fade) at M.push. One SharedValue
// clock drives every layer; React renders the overlay once. iOS: its own
// window (FullWindowOverlay) above the tab bar and header; Android: a
// transparent Modal.

export type OpenBookRun = {
  book: LibraryBookSummary;
  /** The cover's frame in window coordinates. */
  rect: { x: number; y: number; w: number; h: number };
  chapterIndex: number;
};

const BASE_W = 173;

export function OpenBookOverlay({ run, onPush, onDone }: { run: OpenBookRun; onPush: () => void; onDone: () => void }) {
  const layer = <OpenBookLayer run={run} onPush={onPush} onDone={onDone} />;
  if (Platform.OS === 'ios') return <FullWindowOverlay>{layer}</FullWindowOverlay>;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}>
      {layer}
    </Modal>
  );
}

function OpenBookLayer({ run, onPush, onDone }: { run: OpenBookRun; onPush: () => void; onDone: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const { x, y, w, h } = run.rect;
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(
      withTiming(M.total, { duration: M.total, easing: Easing.linear }, () => {
        scheduleOnRN(onDone);
      }),
    );
  }, [t, onDone]);

  useAnimatedReaction(
    () => t.get() >= M.push,
    (now, prev) => {
      if (now && !prev) scheduleOnRN(onPush);
    },
  );

  // Rise: spine on the centre line; zoom: the open page fills 86 % of the width.
  const s1 = (M.riseWidth * W) / w;
  const s2 = (M.zoomWidth * W) / w;
  const left1 = W / 2;
  const top1 = M.riseTop * H;
  const left2 = (W - M.zoomWidth * W) / 2;
  const top2 = M.zoomTop * H;

  const book = useAnimatedStyle(() => {
    const now = t.get();
    const seg = (a: number, b: number) => Math.min(1, Math.max(0, (now - a) / (b - a)));
    const press = now < M.press[1] ? 1 - (1 - M.pressScale) * seg(M.press[0], M.press[1]) : M.pressScale + (1 - M.pressScale) * seg(M.press[1], M.press[2]);
    const r = M.moveEase(seg(M.rise[0], M.rise[1]));
    const z = M.moveEase(seg(M.zoom[0], M.zoom[1]));
    const scale = (1 + (s1 - 1) * r + (s2 - s1) * z) * press;
    // The press shrinks around the centre (the origin is the top-left corner).
    const nudge = 1 - press;
    const tx = (left1 - x) * r + (left2 - left1) * z + (nudge * w) / 2;
    const ty = (top1 - y) * r + (top2 - top1) * z + (nudge * h) / 2;
    return { opacity: 1 - z, transform: [{ translateX: tx }, { translateY: ty }, { scale }] };
  });
  const angle = (now: number) => {
    'worklet';
    return M.openDeg * M.coverEase(Math.min(1, Math.max(0, (now - M.open[0]) / (M.open[1] - M.open[0]))));
  };
  const front = useAnimatedStyle(() => {
    const a = angle(t.get());
    return { opacity: a > -90 ? 1 : 0, transform: [{ perspective: M.perspective }, { rotateY: `${a}deg` }] };
  });
  const back = useAnimatedStyle(() => {
    const a = angle(t.get());
    return { opacity: a > -90 ? 0 : 1, transform: [{ perspective: M.perspective }, { rotateY: `${a}deg` }] };
  });
  const dim = useAnimatedStyle(() => {
    const now = t.get();
    const seg = (a: number, b: number) => Math.min(1, Math.max(0, (now - a) / (b - a)));
    return { opacity: M.stageEase(seg(M.dim[0], M.dim[1])) * (1 - M.stageEase(seg(M.reveal[0], M.reveal[1]))) };
  });
  const glow = useAnimatedStyle(() => {
    const now = t.get();
    const seg = (a: number, b: number) => Math.min(1, Math.max(0, (now - a) / (b - a)));
    return { opacity: seg(M.glowIn[0], M.glowIn[1]) * (1 - seg(M.glowOut[0], M.glowOut[1])) };
  });
  const hole = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.max(0, (t.get() - M.reveal[0]) / (M.reveal[1] - M.reveal[0]))) }));

  const k = w / BASE_W;
  const palette = cover[run.book.cover] ?? cover.oxblood;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto" testID="learn-open-book">
      {/* The cover left the grid: its place shows the ground. */}
      <Animated.View style={[styles.hole, { left: x, top: y, width: w, height: h }, hole]} />
      <Animated.View style={[StyleSheet.absoluteFill, dim]}>
        <BlurView intensity={12} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(black, M.dimTo) }]} />
      </Animated.View>
      <Animated.View style={[styles.book, { left: x, top: y, width: w, height: h }, book]}>
        <Animated.View pointerEvents="none" style={[styles.glow, { left: -160 * k, top: -120 * k }, glow]}>
          <Svg width={500 * k} height={480 * k}>
            <Defs>
              <RadialGradient id="openGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={tone.gold} stopOpacity={0.28} />
                <Stop offset="60%" stopColor={tone.gold} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={250 * k} cy={240 * k} rx={250 * k} ry={240 * k} fill="url(#openGlow)" />
          </Svg>
        </Animated.View>
        <FirstPage book={run.book} chapterIndex={run.chapterIndex} k={k} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.hinge, back]}>
          <LinearGradient colors={[palette.face[1], palette.face[0]]} start={{ x: 0.3, y: 0.3 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.face]} />
          <View style={[StyleSheet.absoluteFill, styles.face, styles.endShade]} />
          <View style={[styles.endRule, { borderColor: alpha(tone.gold, 0.35) }]} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.hinge, front]}>
          <BookCover book={run.book} width={w} small={w < 120} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** The page under the cover: "CHAPTER", the numeral, an ornament, the chapter, its place and size. */
function FirstPage({ book, chapterIndex, k }: { book: LibraryBookSummary; chapterIndex: number; k: number }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const ch = book.chapters[chapterIndex] ?? book.chapters[0];
  const display = textStyle('title', lang);
  const meta = ch ? `${localized(ch.subtitle, lang)} · ${plural(tn, 'library.puzzles', ch.count)}` : '';
  return (
    <View style={styles.page}>
      <LinearGradient
        colors={learn.page}
        locations={[0, 0.09, 0.6, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, styles.pageRadius]}
      />
      <AppText variant="label" color={eos.ember} style={{ fontSize: 7 * k, letterSpacing: 2 * k, lineHeight: 10 * k }}>
        {t('learn.open.chapter')}
      </AppText>
      <AppText style={[display, styles.ink, { marginTop: 4 * k, fontSize: 30 * k, lineHeight: 32 * k }]}>{roman(chapterIndex + 1)}</AppText>
      <View style={[styles.ornament, { marginVertical: 8 * k, gap: 4 * k }]}>
        <View style={{ width: 16 * k, height: 1, backgroundColor: learn.pageRule }} />
        <View style={{ width: 4 * k, height: 4 * k, transform: [{ rotate: '45deg' }], backgroundColor: learn.pageRule }} />
        <View style={{ width: 16 * k, height: 1, backgroundColor: learn.pageRule }} />
      </View>
      {ch ? (
        <AppText style={[display, styles.ink, styles.center, { paddingHorizontal: 14 * k, fontSize: 13 * k, lineHeight: 15 * k }]}>
          {localized(ch.title, lang)}
        </AppText>
      ) : null}
      <AppText
        variant="captionStrong"
        color={learn.pageMeta}
        style={[styles.center, { marginTop: 8 * k, paddingHorizontal: 10 * k, fontSize: 7 * k, lineHeight: 9 * k, letterSpacing: 1 * k, textTransform: 'uppercase' }]}
      >
        {meta}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hole: { position: 'absolute', backgroundColor: eos.ink },
  book: { position: 'absolute', transformOrigin: '0% 0%' },
  glow: { position: 'absolute' },
  hinge: { transformOrigin: '0% 50%' },
  face: { borderTopLeftRadius: 3, borderBottomLeftRadius: 3, borderTopRightRadius: 6, borderBottomRightRadius: 6 },
  endShade: { boxShadow: [{ offsetX: -6, offsetY: 0, blurRadius: 10, spreadDistance: 0, color: alpha(black, 0.45), inset: true }] },
  endRule: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 1, borderRadius: 2 },
  page: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    right: 3,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [
      { offsetX: 1, offsetY: 1, blurRadius: 0, spreadDistance: 0, color: learn.pageEdge[0] },
      { offsetX: 2, offsetY: 2, blurRadius: 0, spreadDistance: 0, color: learn.pageEdge[1] },
      { offsetX: 3, offsetY: 3, blurRadius: 0, spreadDistance: 0, color: learn.pageEdge[2] },
      { offsetX: 4, offsetY: 4, blurRadius: 0, spreadDistance: 0, color: learn.pageEdge[3] },
      { offsetX: 0, offsetY: 14, blurRadius: 30, spreadDistance: 0, color: alpha(black, 0.6) },
    ],
  },
  pageRadius: { borderTopLeftRadius: 1, borderBottomLeftRadius: 1, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  ink: { color: learn.pageInk },
  center: { textAlign: 'center' },
  ornament: { flexDirection: 'row', alignItems: 'center' },
});

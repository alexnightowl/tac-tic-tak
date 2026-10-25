import { localeFor } from '@tac/core/format';
import { ratingChartLayout, RATING_STYLE_HEX, type RatingPoint } from '@tac/core/charts';
import type { TrainingStyle } from '@tac/core/rules';
import { black, eos, radii, semantic, space } from '@tac/core/tokens';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { GestureDetector, usePanGesture, useTapGesture, useExclusiveGestures } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { feel } from '@/feel';
import { AppText, textStyle } from '@/ui/AppText';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { drawIn, fade, scrubIn } from './motion';
import { StyleIcon } from './StyleIcon';

// Per-style rating line chart (web RatingHistoryChart) laid out in real
// pixels from onLayout, so the y labels live inside the Svg instead of an
// HTML overlay. Native additions: a left-to-right draw-in on mount and a
// press-and-drag crosshair (tap also picks a session) with a tick per point.

const H = 200;
const LABEL_W = 40;
const TIP_W = 168;
const LONG_PRESS_MS = 150;
/** Tooltip lane above the plot. */
const TIP_LANE = 30;
const GRID = semantic.borderSoft;

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  data: RatingPoint[];
  /** Dims the other styles (Stats style filter). */
  highlightStyle?: TrainingStyle | null;
  testID: string;
};

export function RatingHistoryChart({ data, highlightStyle = null, testID }: Props) {
  const t = useT();
  const { lang } = useLang();
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  const layout = width > 0 ? ratingChartLayout(data, { width: width - LABEL_W, height: H }) : null;

  // Draw in once the first layout with data exists.
  const hasLayout = !!layout;
  useEffect(() => {
    if (!hasLayout) return;
    progress.set(reduced ? 1 : withTiming(1, drawIn));
  }, [hasLayout, reduced, progress]);

  const clip = useAnimatedProps(() => ({
    width: progress.get() * Math.max(0, width - LABEL_W + 4),
  }));

  // Every session point, left to right, for the crosshair.
  const locale = localeFor(lang);
  const points: { x: number; y: number; color: string; label: string }[] = [];
  for (const s of layout?.series ?? []) {
    for (const p of s.points) {
      const date = new Date(p.endedAt).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      });
      points.push({
        x: p.x + LABEL_W,
        y: p.y,
        color: RATING_STYLE_HEX[s.style],
        label: `${date} · ${t(`style.${s.style}.name`)} ${p.rating}`,
      });
    }
  }
  points.sort((a, b) => a.x - b.x);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const labels = points.map((p) => p.label);
  const colors = points.map((p) => p.color);

  const sel = useSharedValue(-1);
  const shown = useSharedValue(0);
  const tick = () => feel.emit('sliderTick');

  const pick = (x: number) => {
    'worklet';
    const n = xs.length;
    if (n === 0) return;
    // Nearest by x (sorted): binary search, then compare neighbours.
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    const i = lo > 0 && Math.abs(xs[lo - 1] - x) <= Math.abs(xs[lo] - x) ? lo - 1 : lo;
    if (shown.get() === 0) shown.set(withTiming(1, scrubIn));
    if (i === sel.get()) return;
    sel.set(i);
    scheduleOnRN(tick);
  };

  const pan = usePanGesture({
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: (e) => {
      'worklet';
      pick(e.x);
    },
    onUpdate: (e) => {
      'worklet';
      pick(e.x);
    },
  });
  const tap = useTapGesture({
    onActivate: (e) => {
      'worklet';
      pick(e.x);
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const cross = useAnimatedStyle(() => {
    const i = sel.get();
    return {
      opacity: i < 0 ? 0 : shown.get(),
      transform: [{ translateX: i < 0 ? 0 : xs[i] }],
    };
  });
  const dot = useAnimatedStyle(() => {
    const i = sel.get();
    return {
      opacity: i < 0 ? 0 : shown.get(),
      backgroundColor: i < 0 ? eos.bone : colors[i],
      transform: [{ translateX: i < 0 ? 0 : xs[i] - 5 }, { translateY: i < 0 ? 0 : ys[i] - 5 }],
    };
  });
  const tip = useAnimatedStyle(() => {
    const i = sel.get();
    const x = i < 0 ? 0 : Math.min(width - TIP_W, Math.max(LABEL_W, xs[i] - TIP_W / 2));
    return { opacity: i < 0 ? 0 : shown.get(), transform: [{ translateX: x }] };
  });
  const tipText = useAnimatedProps(() => {
    const i = sel.get();
    const s = i < 0 ? '' : labels[i];
    return { text: s, defaultValue: s } as object;
  });

  if (data.length === 0) {
    return (
      <AppText variant="body" color={eos.dust} style={styles.empty} testID={`${testID}-empty`}>
        {t('stats.chart_empty')}
      </AppText>
    );
  }

  const latest = (layout?.series ?? []).map((s) => `${t(`style.${s.style}.name`)} ${s.last}`).join(', ');
  const labelFont = fontFamily(lang, 'body', 500);

  return (
    <View testID={testID}>
      {/* Overlays are siblings of the accessible plot (it hides children). */}
      <View style={styles.plotWrap}>
        <GestureDetector gesture={gesture}>
          <View
            style={styles.plot}
            onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('stats.rating_a11y', { values: latest })}
            accessibilityHint={t('stats.rating_scrub_hint')}
            testID={`${testID}-plot`}
          >
            {layout ? (
              <Svg width={width} height={H}>
                <Defs>
                  {layout.series.map((s) => (
                    <LinearGradient key={s.style} id={`rh-${s.style}`} x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={RATING_STYLE_HEX[s.style]} stopOpacity={0.28} />
                      <Stop offset="1" stopColor={RATING_STYLE_HEX[s.style]} stopOpacity={0} />
                    </LinearGradient>
                  ))}
                  <ClipPath id="rh-draw">
                    <AnimatedRect x={-2} y={0} height={H} animatedProps={clip} />
                  </ClipPath>
                </Defs>
                {layout.grid.map((g) => (
                  <G key={g.value}>
                    <Line x1={LABEL_W} x2={width - 12} y1={g.y} y2={g.y} stroke={GRID} strokeWidth={1} />
                    <SvgText
                      x={LABEL_W - 8}
                      y={g.y + 4}
                      fontSize={11}
                      fill={eos.ash}
                      textAnchor="end"
                      fontFamily={labelFont}
                    >
                      {String(g.value)}
                    </SvgText>
                  </G>
                ))}
                <G clipPath="url(#rh-draw)" x={LABEL_W}>
                  {layout.series.map((s) => (
                    <Series
                      key={s.style}
                      style={s.style}
                      linePath={s.linePath}
                      areaPath={s.areaPath}
                      dots={s.showDots ? s.points : null}
                      dimmed={highlightStyle != null && highlightStyle !== s.style}
                    />
                  ))}
                </G>
              </Svg>
            ) : null}
          </View>
        </GestureDetector>
        <Animated.View pointerEvents="none" style={[styles.cross, cross]} />
        <Animated.View pointerEvents="none" style={[styles.dot, dot]} />
        <Animated.View pointerEvents="none" style={[styles.tip, tip]}>
          <AnimatedTextInput
            editable={false}
            pointerEvents="none"
            animatedProps={tipText}
            style={[textStyle('caption', lang), styles.tipText]}
            testID={`${testID}-tooltip`}
          />
        </Animated.View>
      </View>
      <View style={styles.legend}>
        {(layout?.series ?? []).map((s) => (
          <View
            key={s.style}
            style={[styles.legendItem, highlightStyle != null && highlightStyle !== s.style && styles.legendDim]}
          >
            <View style={[styles.swatch, { backgroundColor: RATING_STYLE_HEX[s.style] }]} />
            <StyleIcon style={s.style} size={12} color={eos.ash} />
            <AppText variant="caption" color={eos.ash}>
              {t(`style.${s.style}.name`)}
            </AppText>
            <AppText variant="caption" color={eos.bone} style={styles.tabular}>
              {String(s.last)}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function Series({
  style,
  linePath,
  areaPath,
  dots,
  dimmed,
}: {
  style: TrainingStyle;
  linePath: string;
  areaPath: string;
  dots: { x: number; y: number }[] | null;
  dimmed: boolean;
}) {
  const opacity = useSharedValue(dimmed ? 0.18 : 1);
  useEffect(() => {
    opacity.set(withTiming(dimmed ? 0.18 : 1, fade));
  }, [dimmed, opacity]);
  const props = useAnimatedProps(() => ({ opacity: opacity.get() }));
  const color = RATING_STYLE_HEX[style];
  return (
    <AnimatedG animatedProps={props}>
      <Path d={areaPath} fill={`url(#rh-${style})`} />
      <Path d={linePath} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {dots?.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke={black} strokeOpacity={0.4} strokeWidth={1} />
      ))}
    </AnimatedG>
  );
}

const styles = StyleSheet.create({
  plotWrap: { height: H + TIP_LANE },
  plot: { height: H + TIP_LANE, paddingTop: TIP_LANE },
  empty: { textAlign: 'center', paddingVertical: space[6] },
  cross: {
    position: 'absolute',
    top: TIP_LANE,
    left: 0,
    width: 1,
    height: H - 14,
    backgroundColor: semantic.borderStrong,
  },
  dot: {
    position: 'absolute',
    top: TIP_LANE,
    left: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: eos.ink,
  },
  tip: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: TIP_W,
    height: 24,
    borderRadius: radii.control,
    backgroundColor: eos.rise,
    borderWidth: 1,
    borderColor: eos.seam,
    justifyContent: 'center',
  },
  tipText: {
    color: eos.bone,
    textAlign: 'center',
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
    marginTop: space[2],
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDim: { opacity: 0.5 },
  swatch: { width: 16, height: 3, borderRadius: 2 },
  tabular: { fontVariant: ['tabular-nums'] },
});

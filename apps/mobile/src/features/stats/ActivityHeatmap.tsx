import { buildGrid, HEATMAP_DAY_LABELS, monthMarkers, type HeatmapDatum, type HeatmapGrid } from '@tac/core/charts';
import { eos, mixed, radii, space } from '@tac/core/tokens';
import { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  GestureDetector,
  ScrollView,
  usePanGesture,
  useTapGesture,
  useExclusiveGestures,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { feel } from '@/feel';
import { AppText, textStyle } from '@/ui/AppText';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT, useTn } from '@/ui/lang';
import { scrubIn } from './motion';

// GitHub-style activity grid (web ActivityHeatmap) drawn as ONE Svg with
// five batched paths, one per intensity level, instead of 364 views. The
// web's hover readout never fired on touch (PARITY "fix"): here a tap picks
// a day and press-and-hold-then-drag scrubs, with a tooltip and a haptic
// tick per cell, all on the UI thread (no React state on the scrub path).

const CELL = 12;
const GAP = 3;
const PITCH = CELL + GAP;
const R = radii.sm;
/** Month-label row above the cells. */
const TOP = 16;
const DAY_COL = 26;
const TIP_W = 176;
const TIP_H = 24;
const LONG_PRESS_MS = 180;

const LEVEL_FILL = [mixed.heat0, mixed.heat1, mixed.heat2, mixed.heat3, mixed.heat4];

function roundedRect(x: number, y: number): string {
  const s = CELL - 2 * R;
  return `M${x + R},${y}h${s}a${R},${R} 0 0 1 ${R},${R}v${s}a${R},${R} 0 0 1 -${R},${R}h-${s}a${R},${R} 0 0 1 -${R},-${R}v-${s}a${R},${R} 0 0 1 ${R},-${R}z`;
}

/** One path string per level: every cell of that level as a subpath. */
function levelPaths(grid: HeatmapGrid): string[] {
  const out = ['', '', '', '', ''];
  grid.weeks.forEach((week, col) => {
    week.forEach((cell, row) => {
      if (cell) out[cell.level] += roundedRect(col * PITCH, TOP + row * PITCH);
    });
  });
  return out;
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  data: HeatmapDatum[];
  weeks?: number;
  testID: string;
};

export function ActivityHeatmap({ data, weeks = 52, testID }: Props) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const scroller = useRef<{
    scrollToEnd: (o?: { animated?: boolean }) => void;
  } | null>(null);

  const grid = buildGrid(data, weeks);
  const marks = monthMarkers(grid, lang);
  const paths = levelPaths(grid);

  // Index = col * 7 + row; '' marks a future day (no cell).
  const labels: string[] = [];
  let activeDays = 0;
  let sessions = 0;
  for (const week of grid.weeks) {
    for (const cell of week) {
      if (!cell) {
        labels.push('');
        continue;
      }
      if (cell.count > 0) {
        activeDays++;
        sessions += cell.count;
      }
      labels.push(
        cell.count === 0
          ? t('stats.heatmap_none', { date: cell.date })
          : t('stats.heatmap_day', {
              date: cell.date,
              count: cell.count,
              noun: tn('stats.session_word', cell.count),
            }),
      );
    }
  }
  const daysText = tn('stats.active_days', activeDays).split('{n}').join(String(activeDays));
  const a11y = t('stats.heatmap_a11y', {
    days: daysText,
    sessions,
    noun: tn('stats.session_word', sessions),
  });

  const contentW = weeks * PITCH - GAP;
  const contentH = TOP + 7 * PITCH - GAP;

  const sel = useSharedValue(-1);
  const shown = useSharedValue(0);
  const tick = () => feel.emit('sliderTick');

  const pick = (x: number, y: number) => {
    'worklet';
    const col = Math.min(weeks - 1, Math.max(0, Math.floor(x / PITCH)));
    const row = Math.min(6, Math.max(0, Math.floor((y - TOP) / PITCH)));
    const idx = col * 7 + row;
    if (labels[idx] === '') return;
    if (shown.get() === 0) shown.set(withTiming(1, scrubIn));
    if (idx === sel.get()) return;
    sel.set(idx);
    scheduleOnRN(tick);
  };

  const pan = usePanGesture({
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: (e) => {
      'worklet';
      pick(e.x, e.y);
    },
    onUpdate: (e) => {
      'worklet';
      pick(e.x, e.y);
    },
  });
  const tap = useTapGesture({
    onActivate: (e) => {
      'worklet';
      pick(e.x, e.y);
    },
  });
  const gesture = useExclusiveGestures(pan, tap);

  const ring = useAnimatedStyle(() => {
    const i = sel.get();
    return {
      opacity: i < 0 ? 0 : shown.get(),
      transform: [{ translateX: Math.floor(i / 7) * PITCH - 2 }, { translateY: TOP + (i % 7) * PITCH - 2 }],
    };
  });
  const tip = useAnimatedStyle(() => {
    const i = sel.get();
    const col = Math.floor(i / 7);
    const row = i % 7;
    const x = Math.min(contentW - TIP_W, Math.max(0, col * PITCH + CELL / 2 - TIP_W / 2));
    // Above the cell; below it for the top two rows (the scroller clips).
    const y = row < 2 ? TOP + (row + 1) * PITCH + 2 : TOP + row * PITCH - TIP_H - 4;
    return {
      opacity: i < 0 ? 0 : shown.get(),
      transform: [{ translateX: x }, { translateY: y }],
    };
  });
  const tipText = useAnimatedProps(() => {
    const i = sel.get();
    const s = i < 0 ? '' : labels[i];
    return { text: s, defaultValue: s } as object;
  });

  const dayLabels = HEATMAP_DAY_LABELS[lang] ?? HEATMAP_DAY_LABELS.en;
  const tinyFont = fontFamily(lang, 'body', 500);

  return (
    <View testID={testID}>
      <View style={styles.row}>
        <View style={styles.dayCol} accessible={false}>
          {dayLabels.map((l, i) => (
            <AppText key={i} variant="caption" color={eos.dust} style={styles.dayLabel} maxFontSizeMultiplier={1}>
              {l}
            </AppText>
          ))}
        </View>
        <ScrollView
          ref={scroller as never}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
          onScrollBeginDrag={() => shown.set(withTiming(0, scrubIn))}
          style={styles.scroller}
        >
          {/* Tooltip and ring are siblings of the accessible grid: an
              accessible view hides its children from VoiceOver and tests. */}
          <View style={{ width: contentW, height: contentH }}>
            <GestureDetector gesture={gesture}>
              <View
                style={StyleSheet.absoluteFill}
                accessible
                accessibilityRole="image"
                accessibilityLabel={a11y}
                accessibilityHint={t('stats.heatmap_scrub_hint')}
                testID={`${testID}-grid`}
              >
                <Svg width={contentW} height={contentH}>
                  {marks.map((m) => (
                    <SvgText key={m.col} x={m.col * PITCH} y={10} fontSize={9} fill={eos.dust} fontFamily={tinyFont}>
                      {m.label}
                    </SvgText>
                  ))}
                  {paths.map((d, level) => (d ? <Path key={level} d={d} fill={LEVEL_FILL[level]} /> : null))}
                </Svg>
              </View>
            </GestureDetector>
            <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
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
        </ScrollView>
      </View>
      <View style={styles.legendRow}>
        <AppText variant="caption" color={eos.ash} numberOfLines={1} style={styles.summary} testID={`${testID}-days`}>
          {daysText}
        </AppText>
        <View style={styles.legend} accessible={false}>
          <AppText variant="caption" color={eos.dust} style={styles.legendLess}>
            {t('stats.heatmap_less')}
          </AppText>
          {LEVEL_FILL.map((c, i) => (
            <View key={i} style={[styles.swatch, { backgroundColor: c }]} />
          ))}
          <AppText variant="caption" color={eos.dust} style={styles.legendMore}>
            {t('stats.heatmap_more')}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  dayCol: { width: DAY_COL, paddingTop: TOP, gap: GAP },
  dayLabel: { height: CELL, fontSize: 9, lineHeight: CELL },
  scroller: { flex: 1 },
  ring: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CELL + 4,
    height: CELL + 4,
    borderRadius: R + 2,
    borderWidth: 1.5,
    borderColor: eos.bone,
  },
  tip: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: TIP_W,
    height: TIP_H,
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
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    marginTop: space[2],
  },
  summary: { flexShrink: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendLess: { marginRight: 3 },
  legendMore: { marginLeft: 3 },
  swatch: { width: 10, height: 10, borderRadius: R },
});

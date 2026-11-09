import { buildGrid, type HeatmapDatum, type HeatmapGrid } from '@tac/core/charts';
import { eos } from '@tac/core/tokens';
import { StyleSheet, TextInput, View, type PointerEvent } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { textStyle } from '@/ui/AppText';
import { useLang, useT, useTn } from '@/ui/lang';
import { DText } from '../kit';
import { dx } from '../tokens';

// DXStats "Активність": GitHub-style grid, 15 px cells 4 apart, no month or
// day labels; as many weeks as the card is wide (26 at 1440). Drawn as one
// Svg with a path per level; the hover readout runs on a SharedValue.

const CELL = 15;
const GAP = 4;
const PITCH = CELL + GAP;
const R = 3;
const TIP_W = 190;
const TIP_H = 24;
const LEVELS = [dx.heat0, dx.heat1, dx.heat2, dx.heat3, dx.heat4];

function rect(x: number, y: number, s: number, r: number): string {
  const e = s - 2 * r;
  return `M${x + r},${y}h${e}a${r},${r} 0 0 1 ${r},${r}v${e}a${r},${r} 0 0 1 -${r},${r}h-${e}a${r},${r} 0 0 1 -${r},-${r}v-${e}a${r},${r} 0 0 1 ${r},-${r}z`;
}

function levelPaths(grid: HeatmapGrid): string[] {
  const out = ['', '', '', '', ''];
  grid.weeks.forEach((week, col) => {
    week.forEach((cell, row) => {
      if (cell) out[cell.level] += rect(col * PITCH, row * PITCH, CELL, R);
    });
  });
  return out;
}

/** How many week columns fit in `width`. */
export function weeksFor(width: number): number {
  return Math.max(8, Math.min(52, Math.floor((width + GAP) / PITCH)));
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function DxHeatmap({ data, weeks, testID }: { data: HeatmapDatum[]; weeks: number; testID: string }) {
  const t = useT();
  const tn = useTn();
  const { lang } = useLang();
  const grid = buildGrid(data, weeks);
  const paths = levelPaths(grid);
  const labels: string[] = [];
  let sessions = 0;
  let days = 0;
  for (const week of grid.weeks) {
    for (const cell of week) {
      if (!cell) {
        labels.push('');
        continue;
      }
      if (cell.count > 0) {
        days++;
        sessions += cell.count;
      }
      labels.push(
        cell.count === 0
          ? t('stats.heatmap_none', { date: cell.date })
          : t('stats.heatmap_day', { date: cell.date, count: cell.count, noun: tn('stats.session_word', cell.count) }),
      );
    }
  }
  const w = weeks * PITCH - GAP;
  const h = 7 * PITCH - GAP;

  const sel = useSharedValue(-1);
  const onMove = (e: PointerEvent) => {
    const { offsetX, offsetY } = e.nativeEvent;
    const col = Math.floor(offsetX / PITCH);
    const row = Math.floor(offsetY / PITCH);
    const i = col >= 0 && col < weeks && row >= 0 && row < 7 ? col * 7 + row : -1;
    sel.set(i >= 0 && labels[i] ? i : -1);
  };
  const ring = useAnimatedStyle(() => {
    const i = sel.get();
    return {
      opacity: i < 0 ? 0 : 1,
      transform: [{ translateX: Math.floor(i / 7) * PITCH - 2 }, { translateY: (i % 7) * PITCH - 2 }],
    };
  });
  const tip = useAnimatedStyle(() => {
    const i = sel.get();
    const col = Math.floor(i / 7);
    const row = i % 7;
    const x = Math.min(w - TIP_W, Math.max(0, col * PITCH + CELL / 2 - TIP_W / 2));
    const y = row < 2 ? (row + 1) * PITCH + 2 : row * PITCH - TIP_H - 4;
    return { opacity: i < 0 ? 0 : 1, transform: [{ translateX: x }, { translateY: y }] };
  });
  const tipText = useAnimatedProps(() => {
    const i = sel.get();
    const s = i < 0 ? '' : labels[i];
    return { text: s, defaultValue: s } as object;
  });

  const daysText = tn('stats.active_days', days).split('{n}').join(String(days));
  return (
    <View testID={testID}>
      <View style={{ width: w, height: h }}>
        <Svg width={w} height={h}>
          {paths.map((d, level) => (d ? <Path key={level} d={d} fill={LEVELS[level]} /> : null))}
        </Svg>
        <View
          style={StyleSheet.absoluteFill}
          onPointerMove={onMove}
          onPointerLeave={() => sel.set(-1)}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('stats.heatmap_a11y', { days: daysText, sessions, noun: tn('stats.session_word', sessions) })}
          testID={`${testID}-grid`}
        />
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
      <View style={[styles.legend, { width: w }]}>
        <DText size={11.5} color={dx.dust} style={styles.flex} numberOfLines={1}>
          {daysText}
        </DText>
        <DText size={11.5} color={dx.dust}>
          {t('stats.heatmap_less')}
        </DText>
        {LEVELS.map((c) => (
          <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
        ))}
        <DText size={11.5} color={dx.dust}>
          {t('stats.heatmap_more')}
        </DText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
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
    borderRadius: 8,
    backgroundColor: eos.rise,
    borderWidth: 1,
    borderColor: eos.seam,
    justifyContent: 'center',
  },
  tipText: { color: eos.bone, textAlign: 'center', padding: 0, fontVariant: ['tabular-nums'] },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  swatch: { width: 11, height: 11, borderRadius: 2 },
});

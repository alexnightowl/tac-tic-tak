import { radarGeometry, type RadarDatum } from '@tac/core/charts';
import { board, eos, semantic } from '@tac/core/tokens';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText, TSpan } from 'react-native-svg';

import { fontFamily } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { morph } from './motion';

// Themes radar (web RadarChart), geometry from @tac/core/charts. Native
// addition: when the style filter changes and the spoke count stays the
// same, the polygon morphs vertex by vertex instead of jumping.

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
/** Web size 340 → r 126: the largest radius on a tablet. */
const MAX_R = 126;
const MIN_R = 56;
const LABEL_SIZE = 10.5;
/** Manrope 500 average advance at 10.5 pt (Cyrillic runs a little wider). */
const CHAR_W = 6.2;
const WRAP_CHARS = 12;
const LINE_H = 12;

/** Greedy wrap to ~12 chars a line (a longer single word keeps its line).
 *  The web splits into two lines at most, which made uk labels too wide
 *  for a phone; three short lines let the radar itself stay large. */
function wrap(label: string): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of label.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + w.length > WRAP_CHARS) {
      out.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) out.push(line);
  return out;
}

type Props = { data: RadarDatum[]; min: number; max: number; testID: string };

export function RadarChart({ data, min, max, testID }: Props) {
  const t = useT();
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  // The radius is what's left of the width once the widest side label fits
  // (labels sit at 1.14 r, anchored outward); the web instead padded a fixed
  // viewBox, which on a phone left the polygon a third of the card.
  const wrapped = data.map((d) => wrap(d.label));
  const sideChars = Math.max(0, ...wrapped.flatMap((ls, i) => (isSideSpoke(i, data.length) ? ls.map((l) => l.length) : [])));
  const labelW = sideChars * CHAR_W + 6;
  const r = Math.max(MIN_R, Math.min(MAX_R, (width / 2 - labelW) / 1.14));
  const size = 2 * (r + 44);
  const geo = width > 0 ? radarGeometry(data, { min, max, size }) : null;
  const labels = geo
    ? geo.axisLabels.map((l, i) => {
        const lines = wrapped[i] ?? l.lines;
        // Spoke tip (radarGeometry centres its own 1–2 line block on it).
        const py = l.firstY + ((l.lines.length - 1) * geo.lineHeight) / 2;
        const n = lines.length;
        const first =
          l.anchor !== 'middle'
            ? py - ((n - 1) * LINE_H) / 2 + 4
            : py < geo.cy
              ? py - 3 - (n - 1) * LINE_H // top: the block ends above the tip (clears the ring values)
              : py + 10; // bottom: starts below it
        return { x: l.x, anchor: l.anchor, lines, first };
      })
    : [];
  // Vertical extent: rings plus the label blocks above and below.
  const top = Math.min(0, ...labels.map((l) => l.first - 10));
  const bottom = Math.max(size, ...labels.map((l) => l.first + (l.lines.length - 1) * LINE_H + 4));
  const viewH = bottom - top;

  const target = geo ? geo.poly.flatMap((p) => [p.x, p.y]) : [];
  const from = useSharedValue<number[]>(target);
  const to = useSharedValue<number[]>(target);
  const progress = useSharedValue(1);
  const shown = useRef<number[]>(target);

  const key = target.map((v) => v.toFixed(1)).join(',');
  useEffect(() => {
    const next = key ? key.split(',').map(Number) : [];
    const prev = shown.current;
    shown.current = next;
    // Morph only between polygons with the same spokes (and size).
    if (!reduced && prev.length === next.length && prev.length > 0) {
      from.set(prev);
      to.set(next);
      progress.set(0);
      progress.set(withTiming(1, morph));
    } else {
      from.set(next);
      to.set(next);
      progress.set(1);
    }
  }, [key, reduced, from, to, progress]);

  const polyProps = useAnimatedProps(() => {
    const a = from.get();
    const b = to.get();
    const k = progress.get();
    if (b.length === 0) return { d: '' };
    let d = '';
    for (let i = 0; i < b.length; i += 2) {
      const x = (a[i] ?? b[i]) + (b[i] - (a[i] ?? b[i])) * k;
      const y = (a[i + 1] ?? b[i + 1]) + (b[i + 1] - (a[i + 1] ?? b[i + 1])) * k;
      d += `${i === 0 ? 'M' : 'L'}${x},${y} `;
    }
    return { d: `${d}Z` };
  });

  const font = fontFamily(lang, 'body', 500);
  const a11y = t('stats.radar_a11y', { values: data.map((d) => `${d.label} ${d.value}`).join(', ') });

  return (
    <View
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={{ alignItems: 'center' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11y}
      testID={testID}
    >
      {geo ? (
        <Svg width={width} height={viewH} viewBox={`${geo.cx - width / 2} ${top} ${width} ${viewH}`}>
          {geo.ringPaths.map((d, i) => (
            <Path key={i} d={d} fill="none" stroke={board.frameRing} strokeWidth={1} />
          ))}
          {geo.spokes.map((s, i) => (
            <Line key={i} {...s} stroke={semantic.borderSoft} strokeWidth={1} />
          ))}
          {geo.ringLabels.map((r, i) => (
            <SvgText key={i} x={r.x} y={r.y} fontSize={10} fill={eos.dust} fontFamily={font}>
              {String(r.value)}
            </SvgText>
          ))}
          <AnimatedPath
            animatedProps={polyProps}
            fill={semantic.accentSoft}
            stroke={semantic.accent}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {geo.poly.map((_, i) => (
            <Vertex key={i} i={i} from={from} to={to} progress={progress} />
          ))}
          <G>
            {labels.map((l, i) => (
              <SvgText key={i} fontSize={LABEL_SIZE} fill={eos.ash} textAnchor={l.anchor} fontFamily={font}>
                {l.lines.map((line, j) => (
                  <TSpan key={j} x={l.x} y={l.first + j * LINE_H}>
                    {line}
                  </TSpan>
                ))}
              </SvgText>
            ))}
          </G>
        </Svg>
      ) : (
        <View style={{ height: 2 * (MAX_R + 44) }} />
      )}
    </View>
  );
}

/** Spokes that point left or right (labels anchored outward), not the
 *  ones at 12 or 6 o'clock (centred). Mirrors radarGeometry's anchor rule. */
function isSideSpoke(i: number, n: number): boolean {
  return Math.abs(Math.cos(-Math.PI / 2 + (i / n) * Math.PI * 2)) > 0.03;
}

/** A vertex dot riding the same morph as the polygon. */
function Vertex({
  i,
  from,
  to,
  progress,
}: {
  i: number;
  from: SharedValue<number[]>;
  to: SharedValue<number[]>;
  progress: SharedValue<number>;
}) {
  const props = useAnimatedProps(() => {
    const a = from.get();
    const b = to.get();
    const k = progress.get();
    const bx = b[i * 2] ?? 0;
    const by = b[i * 2 + 1] ?? 0;
    const ax = a[i * 2] ?? bx;
    const ay = a[i * 2 + 1] ?? by;
    return { cx: ax + (bx - ax) * k, cy: ay + (by - ay) * k };
  });
  return <AnimatedCircle animatedProps={props} r={3.2} fill={semantic.accent} />;
}

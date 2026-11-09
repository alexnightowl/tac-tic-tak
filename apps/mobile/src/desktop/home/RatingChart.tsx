import { ratingChartLayout, type RatingPoint } from '@tac/core/charts';
import { eos, tone } from '@tac/core/tokens';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { dx } from '../tokens';

const H = 160;

/**
 * DXHome's rating line: one style's points (the Stats chart's data and
 * core layout), a dashed four-line grid, the area fade and the last point
 * ringed. Sized from its own width.
 */
export function RatingLine({ points, testID, accessibilityLabel }: { points: RatingPoint[]; testID: string; accessibilityLabel: string }) {
  const [w, setW] = useState(0);
  const layout = w > 0 ? ratingChartLayout(points, { width: w, height: H, padL: 0, padR: 6, padT: 10, padB: 6, curve: 'linear' }) : null;
  const series = layout?.series[0];
  const last = series?.points[series.points.length - 1];
  return (
    <View style={{ height: H }} onLayout={(e) => setW(e.nativeEvent.layout.width)} testID={testID} accessible accessibilityLabel={accessibilityLabel}>
      {w > 0 ? (
        <Svg width={w} height={H} style={{ overflow: 'visible' }}>
          <Defs>
            <LinearGradient id="dx-home-rating" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor={dx.barTo} stopOpacity={0.35} />
              <Stop offset="1" stopColor={dx.barTo} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0, H / 3, (2 * H) / 3, H].map((y) => (
            <Line key={y} x1={0} x2={w} y1={y} y2={y} stroke={dx.ghost} strokeDasharray="3 5" />
          ))}
          {series ? (
            <>
              <Path d={series.areaPath} fill="url(#dx-home-rating)" />
              <Path d={series.linePath} fill="none" stroke={tone.rose} strokeWidth={2.5} strokeLinejoin="round" />
              {last ? <Circle cx={last.x} cy={last.y} r={5} fill={tone.rose} stroke={eos.ink} strokeWidth={3} /> : null}
            </>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

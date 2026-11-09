import { alpha, eos, graphite, tone } from '@tac/core/tokens';
import { Clock, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { DText, Hover, Label } from '../kit';
import { dx } from '../tokens';

// Panel pieces the board screens share (DXSession, DXStormRun,
// DXReviewDrill, DXChapterSolve): the turn card, small stat tiles, the
// session dots, the chapter dashes, the clock and the square icon button.

/** The 16 px side-to-move square: bone for white, iron for black. */
export function SideSquare({ side }: { side: 'w' | 'b' }) {
  return <View style={[styles.side, { backgroundColor: side === 'w' ? eos.bone : tone.iron }]} />;
}

/** .card2 turn card: side square, 16 px title, 13 px line, optional right pill. */
export function TurnCard({
  side,
  title,
  sub,
  pill,
  titleColor,
  testID = 'dx-turn-card',
  style,
  children,
}: {
  side: 'w' | 'b';
  title: string;
  sub?: string | null;
  pill?: string | null;
  titleColor?: ColorValue;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.card2, styles.turn, style]} testID={testID}>
      <SideSquare side={side} />
      <View style={styles.flex}>
        <DText size={16} weight={800} color={titleColor} numberOfLines={1} testID="turn-title">
          {title}
        </DText>
        {sub ? (
          <DText size={13} color={dx.ash} numberOfLines={1} testID="turn-subtitle">
            {sub}
          </DText>
        ) : null}
      </View>
      {pill ? <PillTag label={pill} /> : null}
      {children}
    </View>
  );
}

/** The grey pill on a turn card ("Задача 12 · 1634"). */
export function PillTag({ label, testID }: { label: string; testID?: string }) {
  return (
    <View style={styles.pill} testID={testID}>
      <DText size={11.5} weight={800} color={graphite[300]} tabular numberOfLines={1}>
        {label}
      </DText>
    </View>
  );
}

/** A .card2 block (padding 14/16). */
export function Card2({ children, style, testID }: { children?: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View style={[styles.card2, styles.card2Pad, style]} testID={testID}>
      {children}
    </View>
  );
}

/** The small runner tile: 9.5 px label, 22 px number. */
export function SmallTile({ label, value, color, testID }: { label: string; value: string; color?: ColorValue; testID?: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label} ${value}`}>
      <Label size={9.5}>{label}</Label>
      <DText size={22} weight={800} ls={-0.3} color={color} tabular style={styles.mt4} testID={testID}>
        {value}
      </DText>
    </View>
  );
}

export type Mark = 'ok' | 'bad' | 'now' | 'rest';

/** 18 px puzzle squares: sage solved, ember missed, outlined current. */
export function Dots({ marks, label, testID }: { marks: readonly Mark[]; label: string; testID: string }) {
  return (
    <View style={styles.dots} accessible accessibilityRole="image" accessibilityLabel={label} testID={testID}>
      {marks.map((m, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            m === 'ok' ? styles.dotOk : m === 'bad' ? styles.dotBad : m === 'now' ? styles.dotNow : styles.dotRest,
          ]}
        />
      ))}
    </View>
  );
}

export type Dash = 'right' | 'wrong' | 'now' | 'rest';

/** 5 px chapter dashes (DXChapterSolve): one per puzzle. */
export function Dashes({ looks, label, testID }: { looks: readonly Dash[]; label: string; testID: string }) {
  return (
    <View style={styles.dashes} accessible accessibilityRole="progressbar" accessibilityLabel={label} testID={testID}>
      {looks.map((l, i) => (
        <View
          key={i}
          style={[
            styles.dash,
            { backgroundColor: l === 'right' ? dx.dotOk : l === 'wrong' ? alpha(tone.rose, 0.7) : l === 'now' ? eos.bone : dx.ghost },
          ]}
        />
      ))}
    </View>
  );
}

/** Clock glyph + m:ss (the panel's top row). */
export function ClockText({ text, size = 30, color = dx.bone, testID }: { text: string; size?: number; color?: ColorValue; testID?: string }) {
  return (
    <View style={styles.clock}>
      <Clock size={size >= 24 ? 18 : 14} color={color as string} strokeWidth={2} />
      <DText size={size} weight={800} tabular color={color} testID={testID}>
        {text}
      </DText>
    </View>
  );
}

/** A 46 px square ghost button with one glyph (flip, prev, next). */
export function SquareButton({
  icon: Icon,
  onPress,
  testID,
  accessibilityLabel,
  disabled,
  size = 46,
}: {
  icon: LucideIcon;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <Hover
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      style={[styles.square, { width: size, height: size }]}
      hoverStyle={styles.squareHover}
    >
      <Icon size={18} color={dx.bone} strokeWidth={1.8} />
    </Hover>
  );
}

/** Flexible spacer that pushes the panel's footer down. */
export function Spacer() {
  return <View style={styles.flex} />;
}

export const panelStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grid3: { flexDirection: 'row', gap: 10 },
});

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt4: { marginTop: 4 },
  side: { width: 16, height: 16, borderRadius: 4, flexShrink: 0 },
  card2: {
    backgroundColor: dx.card2,
    borderRadius: 12,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  card2Pad: { paddingVertical: 14, paddingHorizontal: 16 },
  turn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 18 },
  pill: { height: 24, paddingHorizontal: 9, borderRadius: 999, backgroundColor: dx.ghost, justifyContent: 'center' },
  tile: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: dx.card,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 18, height: 18, borderRadius: 5 },
  dotOk: { backgroundColor: dx.dotOk },
  dotBad: { backgroundColor: eos.ember },
  dotNow: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 2, color: eos.bone, inset: true }] },
  dotRest: { backgroundColor: dx.card2 },
  dashes: { flexDirection: 'row', gap: 3 },
  dash: { flex: 1, height: 5, borderRadius: 3 },
  clock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  square: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: dx.ghost,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.06), inset: true }],
  },
  squareHover: { backgroundColor: dx.ghostHover },
});

import { control, eos, layout, radii, shadows, surface, tone } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { AppText } from './AppText';

const SLATE = require('../../assets/textures/slate.webp');

type SurfaceProps = ViewProps & { children?: ReactNode; style?: StyleProp<ViewStyle> };

/**
 * `.card`: flat slate, 1 px bone/4 % border, inset top highlight + soft
 * drop (`0 12px 28px -14px`). Padding 16 by default (the design uses 12 for
 * compact tiles); radius 12 (16 for list cards, see CardRow).
 */
export function Card({
  style,
  children,
  padding = layout.cardPadding,
  radius = radii.cardComponent,
  ...rest
}: SurfaceProps & { padding?: number; radius?: number }) {
  return (
    <View style={[styles.card, { padding, borderRadius: radius }, style]} {...rest}>
      {children}
    </View>
  );
}

/**
 * `.tx-slate` hero card: the seamless slate texture tiled (RN Image
 * `resizeMode="repeat"` — expo-image does not tile) under a vertical veil
 * (0.74 → 0.86), inset 1 px bone/6 % ring, `0 14px 30px` drop. Radius 12,
 * padding 20.
 */
export function HeroCard({ style, children, ...rest }: SurfaceProps) {
  return (
    <View style={[styles.heroOuter, style]} {...rest}>
      <View style={styles.heroClip} pointerEvents="none">
        <Image source={SLATE} resizeMode="repeat" style={styles.fill} />
        <LinearGradient colors={[surface.heroVeilTop, surface.heroVeilBottom]} style={styles.fill} />
        <View style={styles.heroRing} />
      </View>
      {children}
    </View>
  );
}

export type WellTone = 'carved' | 'soft';

/**
 * `.well`: carved inset. `carved` (default) = `inset 0 2px 4px` (inputs,
 * segmented tracks on the page); `soft` = `inset 0 2px 3px` + a 1 px
 * bone/3 % inner ring, the variant used inside a grouped list.
 */
export function Well({ style, children, tone: wellTone = 'carved', ...rest }: SurfaceProps & { tone?: WellTone }) {
  return (
    <View style={[styles.well, wellTone === 'soft' && styles.wellSoft, style]} {...rest}>
      {children}
    </View>
  );
}

/**
 * `.float`: chrome that floats over a board or hero (runner counters,
 * TurnCard, viewer pills): shade at 92 %, 1 px bone/5 % border (`subtle`:
 * 4 %). Radius 16 by default; pass `radius={radii.full}` for pills.
 */
export function Float({
  style,
  children,
  radius = radii['2xl'],
  subtle = false,
  ...rest
}: SurfaceProps & { radius?: number; subtle?: boolean }) {
  return (
    <View
      style={[styles.float, { borderRadius: radius }, subtle && { borderColor: surface.floatBorderSubtle }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

export type NoteTone = 'neutral' | 'ember' | 'emberSoft' | 'gold';

const NOTE: Record<NoteTone, { border: string; bg: string; title: string }> = {
  neutral: { border: surface.floatBorder, bg: surface.noteNeutral, title: eos.bone },
  ember: { border: control.dangerBorder, bg: control.dangerFill, title: eos.bone },
  emberSoft: { border: control.dangerBorderSoft, bg: control.dangerFill, title: tone.rose },
  gold: { border: control.goldBorder, bg: control.goldTint20, title: tone.gold },
};

/**
 * `.note` callout (Summary, Home resume card): radius 16, 1 px border,
 * padding 16, title 14/20 bold + body 12/16 ash. With `icon` the note lays
 * out in a row (icon, then the text column), gap 12. `glow` adds the gold
 * halo of the unlock note.
 */
export function Note({
  tone: noteTone = 'neutral',
  title,
  body,
  icon,
  glow = false,
  children,
  style,
  testID,
}: {
  tone?: NoteTone;
  title?: string;
  body?: string;
  icon?: ReactNode;
  glow?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = NOTE[noteTone];
  const text =
    title || body ? (
      <View style={styles.noteText}>
        {title ? (
          <AppText variant="bodyStrong" color={c.title}>
            {title}
          </AppText>
        ) : null}
        {body ? <AppText variant="caption">{body}</AppText> : null}
      </View>
    ) : null;
  return (
    <View
      testID={testID}
      style={[
        styles.note,
        { borderColor: c.border, backgroundColor: c.bg },
        icon ? styles.noteRow : null,
        glow && styles.noteGlow,
        style,
      ]}
    >
      {icon}
      {icon ? <View style={styles.flex}>{text}</View> : text}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill },
  flex: { flex: 1, minWidth: 0 },
  card: {
    backgroundColor: surface.card,
    borderWidth: 1,
    borderColor: surface.cardBorder,
    boxShadow: [...shadows.card],
  },
  heroOuter: {
    borderRadius: radii.cardComponent,
    padding: layout.heroCardPadding,
    backgroundColor: eos.slate,
    boxShadow: [shadows.heroCard[1]],
  },
  heroClip: { ...StyleSheet.absoluteFill, borderRadius: radii.cardComponent, overflow: 'hidden' },
  heroRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.cardComponent,
    borderWidth: shadows.heroCard[0].spreadDistance,
    borderColor: shadows.heroCard[0].color,
  },
  well: {
    backgroundColor: eos.well,
    borderRadius: radii.control,
    boxShadow: [...shadows.well],
  },
  wellSoft: { boxShadow: [...shadows.wellSoft] },
  float: {
    backgroundColor: surface.float,
    borderWidth: 1,
    borderColor: surface.floatBorder,
  },
  note: {
    borderRadius: radii['2xl'],
    borderWidth: 1,
    padding: layout.cardPadding,
    gap: 4,
  },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noteText: { gap: 4 },
  noteGlow: { boxShadow: [...shadows.noteGlow] },
});

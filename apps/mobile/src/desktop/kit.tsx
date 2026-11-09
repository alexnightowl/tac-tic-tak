import type { Language } from '@tac/core/i18n';
import { alpha, eos, radii, type FontWeight } from '@tac/core/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { fontFamily } from '@/ui/fonts';
import { useLang } from '@/ui/lang';
import { dx } from './tokens';

// Desktop building blocks (canvas "Desktop — redesign" stylesheet: .card,
// .tile, .lbl, .seg, .chip, .pill, .kbd, .btn-g, .btn-t, .bar, .inp). Web
// only in practice: the route files reach them through src/desktop/*/index.web.

const SLATE = require('../../assets/textures/slate.webp');

// ── Text ────────────────────────────────────────────────────────────────

export type DTextProps = TextProps & {
  /** px; the artboards' sizes 1:1. */
  size?: number;
  weight?: FontWeight;
  /** Cinzel (en) / the uk display face: titles, plate labels. */
  serif?: boolean;
  color?: ColorValue;
  /** Line height in px. */
  lh?: number;
  /** Letter spacing in px. */
  ls?: number;
  upper?: boolean;
  /** Tabular figures (numbers that tick). */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
  /** Override the UI language's face (the Latin wordmark, a typed name). */
  lang?: Language;
};

/** One text run at an artboard size: Manrope by default, `serif` for Cinzel. */
export function DText({ size = 14, weight = 400, serif, color = dx.bone, lh, ls, upper, tabular, align, lang: langOverride, style, ...rest }: DTextProps) {
  const ctx = useLang();
  const lang = langOverride ?? ctx.lang;
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fontFamily(lang, serif ? 'display' : 'body', weight),
          fontSize: size,
          color,
          ...(lh ? { lineHeight: lh } : null),
          ...(ls != null ? { letterSpacing: ls } : null),
          ...(upper ? { textTransform: 'uppercase' as const } : null),
          ...(tabular ? { fontVariant: ['tabular-nums' as const] } : null),
          ...(align ? { textAlign: align } : null),
        },
        style,
      ]}
    />
  );
}

/** .lbl: 11 px 700 uppercase, 1.3 px tracking, ash (or ember-rose as an eyebrow). */
export function Label({ children, color = dx.ash, size = 11, style }: { children: ReactNode; color?: ColorValue; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <DText size={size} weight={700} ls={1.3} upper color={color} style={style}>
      {children}
    </DText>
  );
}

/** Page or card title in the display face. */
export function Title({ children, size = 24, style, numberOfLines }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <DText serif weight={700} size={size} style={style} numberOfLines={numberOfLines}>
      {children}
    </DText>
  );
}

/** .num: 26 px 800 tabular. */
export function Num({ children, size = 26, color, style }: { children: ReactNode; size?: number; color?: ColorValue; style?: StyleProp<TextStyle> }) {
  return (
    <DText size={size} weight={800} ls={-0.3} tabular color={color} style={style}>
      {children}
    </DText>
  );
}

// ── Surfaces ────────────────────────────────────────────────────────────

/**
 * .card (#252328, r 14, 1 px inner edge); `texture` lays the stone texture
 * under an 82–90 % card wash (.card.tx, the hero panels).
 */
export function Card({ children, texture, style, testID }: { children?: ReactNode; texture?: boolean; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {texture ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={SLATE} style={styles.stone} resizeMode="repeat" />
          <LinearGradient colors={[alpha(dx.card, 0.82), alpha(dx.card, 0.9)]} style={StyleSheet.absoluteFill} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** .tile: a stat tile (padding 16/18, r 12). `picked` = ember outline + warm ground. */
export function Tile({ children, picked, style, testID }: { children?: ReactNode; picked?: boolean; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View style={[styles.tile, picked && styles.tilePicked, style]} testID={testID}>{children}</View>;
}

/** Stat tile: label row, big number, caption (DXHome rating tiles, DXStats). */
export function StatTile({
  label,
  value,
  caption,
  icon: Icon,
  delta,
  deltaColor,
  picked,
  testID,
  style,
}: {
  label: string;
  value: string;
  caption?: string;
  icon?: LucideIcon;
  delta?: string;
  deltaColor?: ColorValue;
  picked?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tile picked={picked} testID={testID} style={style}>
      <View style={styles.row8}>
        {Icon ? <Icon size={14} color={dx.ash} strokeWidth={1.8} /> : null}
        <Label size={10.5}>{label}</Label>
        <View style={styles.flex} />
        {delta ? (
          <DText size={12} weight={800} color={deltaColor ?? dx.sage}>
            {delta}
          </DText>
        ) : null}
      </View>
      <Num style={styles.mt8}>{value}</Num>
      {caption ? (
        <DText size={12} color={dx.dust} style={styles.mt2}>
          {caption}
        </DText>
      ) : null}
    </Tile>
  );
}

/** Hairline between rows inside a card. */
export function RowRule() {
  return <View style={styles.rule} />;
}

/** .bar: 6 px track with the ember gradient fill (0..1). */
export function Bar({
  value,
  height = 6,
  colors,
  mark,
  style,
}: {
  value: number;
  height?: number;
  colors?: readonly [string, string];
  /** A tick at this fraction (the level on a protected-level bar). */
  mark?: number | null;
  style?: StyleProp<ViewStyle>;
}) {
  const w = `${Math.max(0, Math.min(1, value)) * 100}%` as const;
  return (
    <View style={[styles.bar, { height }, style]}>
      <LinearGradient colors={colors ?? [dx.barFrom, dx.barTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.barFill, { width: w }]} />
      {mark != null ? <View style={[styles.barMark, { left: `${mark * 100}%` }]} /> : null}
    </View>
  );
}

// ── Controls ────────────────────────────────────────────────────────────

type PressProps = {
  onPress?: () => void;
  testID: string;
  accessibilityLabel: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A pressable surface with the desktop hover: a faint bone wash over the
 * whole thing (react-native-web reports `hovered`).
 */
export function Hover({
  children,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityRole = 'button',
  selected,
  disabled,
  style,
  hoverStyle,
}: PressProps & {
  children: ReactNode;
  accessibilityRole?: 'button' | 'link' | 'tab' | 'radio' | 'checkbox' | 'switch';
  selected?: boolean;
  hoverStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled, checked: accessibilityRole === 'radio' || accessibilityRole === 'checkbox' ? selected : undefined }}
      disabled={disabled}
      onPress={onPress}
      style={(s) => {
        const st = s as typeof s & { hovered?: boolean };
        return [style, st.hovered && !disabled && (hoverStyle ?? styles.hover), st.pressed && styles.pressed, disabled && styles.disabled];
      }}
    >
      {children}
    </Pressable>
  );
}

/** .btn-g: 40 px ghost button, optional leading icon. `square` = icon only. */
export function GhostButton({
  label,
  icon: Icon,
  square,
  height = 40,
  danger,
  children,
  ...p
}: PressProps & { label?: string; icon?: LucideIcon; square?: boolean; height?: number; danger?: boolean; children?: ReactNode }) {
  const color = danger ? dx.rose : dx.bone;
  return (
    <Hover {...p} style={[styles.ghost, { height }, square && { width: height, paddingHorizontal: 0 }, p.style]} hoverStyle={styles.ghostHover}>
      {Icon ? <Icon size={16} color={color} strokeWidth={1.8} /> : null}
      {label ? (
        <DText size={13.5} weight={700} color={color} numberOfLines={1}>
          {label}
        </DText>
      ) : null}
      {children}
    </Hover>
  );
}

/** .btn-t: borderless text button (ash). */
export function TextButton({ label, icon: Icon, color = dx.ash, size = 13.5, underline, ...p }: PressProps & { label: string; icon?: LucideIcon; color?: ColorValue; size?: number; underline?: boolean }) {
  return (
    <Hover {...p} style={[styles.textBtn, p.style]} hoverStyle={styles.textBtnHover}>
      {Icon ? <Icon size={15} color={color as string} strokeWidth={1.8} /> : null}
      <DText size={size} weight={700} color={color} style={underline ? styles.underline : undefined}>
        {label}
      </DText>
    </Hover>
  );
}

export type SegOption<T extends string> = { value: T; label: string; icon?: LucideIcon };

/** .seg: the segmented control (track #1a181c, ember thumb). */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  testID,
  accessibilityLabel,
  small,
  style,
}: {
  options: readonly SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  testID: string;
  accessibilityLabel: string;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const h = small ? 28 : 36;
  return (
    <View style={[styles.seg, small && styles.segSm, style]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} testID={testID}>
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <Hover
            key={o.value}
            testID={`${testID}-${o.value}`}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            selected={on}
            onPress={() => (on ? undefined : onChange(o.value))}
            style={[styles.segItem, { height: h }, on && styles.segOn]}
            hoverStyle={on ? styles.none : styles.segHover}
          >
            {Icon ? <Icon size={14} color={on ? eos.bone : dx.ash} strokeWidth={1.8} /> : null}
            <DText size={small ? 12 : 13.5} weight={700} color={on ? dx.segOnText : dx.ash} numberOfLines={1}>
              {o.label}
            </DText>
          </Hover>
        );
      })}
    </View>
  );
}

/** .chip: 30 px pill (filter rows); `on` = bone fill. */
export function Chip({ label, on, icon: Icon, ...p }: PressProps & { label: string; on?: boolean; icon?: LucideIcon }) {
  return (
    <Hover {...p} accessibilityRole="tab" selected={on} style={[styles.chip, on && styles.chipOn, p.style]} hoverStyle={on ? styles.none : styles.chipHover}>
      {Icon ? <Icon size={13} color={on ? eos.ink : dx.ash} strokeWidth={1.8} /> : null}
      <DText size={12.5} weight={700} color={on ? eos.ink : dx.ash} numberOfLines={1}>
        {label}
      </DText>
    </Hover>
  );
}

/** .pill: 24 px status pill (e.g. +18 today in sage, 7 waiting in rose). */
export function Pill({ label, tone = 'sage', style }: { label: string; tone?: 'sage' | 'rose' | 'ash' | 'gold'; style?: StyleProp<ViewStyle> }) {
  const c = tone === 'sage' ? eos.sage : tone === 'rose' ? dx.rose : tone === 'gold' ? dx.gold : dx.ash;
  return (
    <View style={[styles.pill, { backgroundColor: alpha(tone === 'sage' ? dx.sage : tone === 'ash' ? eos.ash : dx.rose, 0.16) }, style]}>
      <DText size={11.5} weight={800} color={c} numberOfLines={1}>
        {label}
      </DText>
    </View>
  );
}

/** .kbd: a key cap (Space, Esc, ⌘K, 1). */
export function Kbd({ children }: { children: string }) {
  return (
    <View style={styles.kbd}>
      <DText size={10.5} weight={800} color={dx.ash}>
        {children}
      </DText>
    </View>
  );
}

/** "Space почати · 1 2 3 режим": key caps with their captions. */
export function KeyHints({ items, style }: { items: readonly { keys: readonly string[]; label: string }[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.hints, style]}>
      {items.map((it) => (
        <View key={it.label} style={styles.row6}>
          {it.keys.map((k) => (
            <Kbd key={k}>{k}</Kbd>
          ))}
          <DText size={12} color={dx.dust}>
            {it.label}
          </DText>
        </View>
      ))}
    </View>
  );
}

/** A 34 px rounded icon square (.btn-g ground, rose glyph): list leading icons. */
export function IconSquare({ icon: Icon, size = 34, color = dx.rose, children }: { icon?: LucideIcon; size?: number; color?: string; children?: ReactNode }) {
  return (
    <View style={[styles.iconSq, { width: size, height: size, borderRadius: size * 0.26 }]}>
      {Icon ? <Icon size={size * 0.47} color={color} strokeWidth={1.8} /> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  none: {},
  mt2: { marginTop: 2 },
  mt8: { marginTop: 8 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: {
    backgroundColor: dx.card,
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  stone: { width: '100%', height: '100%' },
  tile: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: dx.card,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.cardEdge, inset: true }],
  },
  tilePicked: {
    backgroundColor: dx.pickedBg,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: dx.ember, inset: true }],
  },
  rule: { height: 1, backgroundColor: dx.rowRule },
  bar: { borderRadius: radii.full, backgroundColor: dx.track, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radii.full },
  barMark: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: eos.bone },
  hover: { backgroundColor: alpha(eos.bone, 0.035) },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: dx.ghost,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.06), inset: true }],
  },
  ghostHover: { backgroundColor: dx.ghostHover },
  textBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 10, borderRadius: 8 },
  textBtnHover: { backgroundColor: alpha(eos.bone, 0.05) },
  underline: { textDecorationLine: 'underline' },
  seg: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 12,
    backgroundColor: dx.track,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.trackEdge, inset: true }],
  },
  segSm: { padding: 3 },
  segItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9, paddingHorizontal: 10 },
  segOn: {
    backgroundColor: dx.ember,
    boxShadow: [
      { offsetX: 0, offsetY: 1, blurRadius: 0, spreadDistance: 0, color: dx.segOnLip, inset: true },
      { offsetX: 0, offsetY: 2, blurRadius: 8, spreadDistance: 0, color: dx.shadow },
    ],
  },
  segHover: { backgroundColor: alpha(eos.bone, 0.04) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  chipOn: { backgroundColor: eos.bone },
  chipHover: { backgroundColor: dx.chipHover },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: radii.full, alignSelf: 'flex-start' },
  kbd: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dx.track,
    boxShadow: [
      { offsetX: 0, offsetY: -1, blurRadius: 0, spreadDistance: 0, color: dx.kbdLip, inset: true },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.kbdEdge },
    ],
  },
  hints: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 12 },
  iconSq: { alignItems: 'center', justifyContent: 'center', backgroundColor: dx.ghost },
});

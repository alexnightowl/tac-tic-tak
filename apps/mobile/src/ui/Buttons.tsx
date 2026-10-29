import { control, eos, layout, radii, shadows, space, surface, tone } from '@tac/core/tokens';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import type { FeelEvent } from '@/feel';
import { AppText, type TextVariantName } from './AppText';
import { colorsTiming } from './motion';
import { useUiT } from './strings';
import { Tap } from './Tap';

// Small controls of the design v2 artboards that are not plates: `.mini`
// row actions, the danger outline button, `.chip` filters, round header /
// overlay buttons (`.back`, `.float`, `.glass`, `.link`, `.play`), `.pill`
// overlay buttons, the ember caps link and the count badge.

/** Vertical hit slop that brings a control of height h up to 44 pt. */
function slop(h: number, x = 0) {
  const v = Math.max(0, Math.ceil((44 - h) / 2));
  return { top: v, bottom: v, left: x, right: x };
}

/** Press dim: the control fades to 0.7 while held (UI thread). */
function usePressDim() {
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: 1 - pressed.get() * 0.3 }));
  return { pressed, style };
}

// --- MiniButton --------------------------------------------------------------

export type MiniVariant = 'ember' | 'ghost' | 'danger';

/**
 * `.mini` row action: 32 pt, radius 8, padding 0/10, gap 4, 11 pt caps
 * label. `ember` = ember fill / onEmber ink; `ghost` = 1 px seam border on
 * bone/5 %; `danger` = the Home "Discard" (36 pt, ember/70 border, danger
 * ink). `iconOnly` squares it to 36 wide. Hit area padded to 44.
 */
export function MiniButton({
  label,
  icon: Icon,
  variant = 'ghost',
  onPress,
  busy = false,
  disabled = false,
  iconOnly = false,
  block = false,
  testID,
  accessibilityLabel,
  pressFeel,
  style,
}: {
  label: string;
  icon?: LucideIcon;
  variant?: MiniVariant;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  iconOnly?: boolean;
  /** Stretch (flex: 1) inside a row. */
  block?: boolean;
  testID: string;
  accessibilityLabel?: string;
  pressFeel?: FeelEvent;
  style?: StyleProp<ViewStyle>;
}) {
  const dim = usePressDim();
  const color = variant === 'ember' ? tone.onEmber : variant === 'danger' ? tone.danger : eos.bone;
  const h = variant === 'danger' ? layout.miniDangerHeight : layout.miniHeight;
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy, disabled }}
      disabled={disabled || busy}
      onPress={onPress}
      pressed={dim.pressed}
      pressedTiming={colorsTiming}
      pressFeel={pressFeel}
      hitSlop={slop(h, 4)}
      style={[block && styles.flex, style]}
    >
      <Animated.View
        style={[
          styles.mini,
          { height: h },
          variant === 'ember' ? styles.miniEmber : variant === 'danger' ? styles.miniDanger : styles.miniGhost,
          iconOnly && styles.miniIcon,
          block && styles.center,
          (disabled || busy) && styles.off,
          dim.style,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={color} />
        ) : Icon ? (
          <Icon size={14} color={color} strokeWidth={variant === 'ember' ? 2.4 : 2.2} />
        ) : null}
        {iconOnly ? null : (
          <AppText variant="label" color={color} numberOfLines={1}>
            {label}
          </AppText>
        )}
      </Animated.View>
    </Tap>
  );
}

// --- DangerButton -------------------------------------------------------------

/**
 * Destructive outline button of the sheets: 44 pt, radius 12, 1 px
 * ember/70 border, Cinzel 14 caps in danger red; `filled` adds the ember/10
 * fill (Reset). `busy` dims to 0.6 and swaps the label for "…".
 */
export function DangerButton({
  label,
  onPress,
  filled = false,
  busy = false,
  disabled = false,
  testID,
  accessibilityLabel,
  pressFeel,
  style,
}: {
  label: string;
  onPress: () => void;
  filled?: boolean;
  busy?: boolean;
  disabled?: boolean;
  testID: string;
  accessibilityLabel?: string;
  pressFeel?: FeelEvent;
  style?: StyleProp<ViewStyle>;
}) {
  const dim = usePressDim();
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy, disabled }}
      disabled={disabled || busy}
      onPress={onPress}
      pressed={dim.pressed}
      pressedTiming={colorsTiming}
      pressFeel={pressFeel}
      style={style}
    >
      <Animated.View
        style={[styles.danger, filled && styles.dangerFilled, (busy || disabled) && styles.busy, dim.style]}
      >
        <AppText variant="plateLabel" color={tone.danger} numberOfLines={1}>
          {busy ? '…' : label}
        </AppText>
      </Animated.View>
    </Tap>
  );
}

// --- Chip ----------------------------------------------------------------------

/**
 * `.chip` filter: 32 pt pill, padding 0/12, 12.5 pt bold; idle = slate with
 * a bone/5 % inset ring, ash ink; `selected` = bone fill, ink text.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  testID,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID: string;
  accessibilityLabel?: string;
}) {
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={slop(layout.chipHeight)}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <AppText variant="chip" color={selected ? control.chipOnText : control.chipText} numberOfLines={1}>
        {label}
      </AppText>
    </Tap>
  );
}

// --- IconButton ---------------------------------------------------------------

export type IconButtonVariant = 'back' | 'float' | 'glass' | 'plain' | 'tile';

/**
 * Round (or square) icon-only button.
 *  - `back`  = `.back`: bone/6 % fill + 1 px bone/8 % inset ring (settings headers);
 *  - `float` = `.float`: shade/92 % + 1 px bone/5 % border (over boards; 44 or 48);
 *  - `glass` = `.glass`: graphite/90 % + 1 px bone/8 % + `0 4px 12px` drop (over heroes);
 *  - `plain` = `.link` / `.eye`: transparent;
 *  - `tile`  = `.play`: 36 pt square, radius 6, rise fill (sound preview).
 * The icon is the caller's node (size it 20–22 pt, bone).
 */
export function IconButton({
  variant = 'float',
  size,
  icon,
  onPress,
  disabled = false,
  testID,
  accessibilityLabel,
  pressFeel,
  style,
}: {
  variant?: IconButtonVariant;
  /** Defaults: 36 for `tile`, else 44. */
  size?: number;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  testID: string;
  accessibilityLabel: string;
  pressFeel?: FeelEvent;
  style?: StyleProp<ViewStyle>;
}) {
  const dim = usePressDim();
  const s = size ?? (variant === 'tile' ? 36 : layout.headerButton);
  const shape = {
    width: s,
    height: s,
    borderRadius: variant === 'tile' ? radii.control : radii.full,
  };
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      pressed={dim.pressed}
      pressedTiming={colorsTiming}
      pressFeel={pressFeel}
      hitSlop={slop(s, Math.max(0, Math.ceil((44 - s) / 2)))}
      style={style}
    >
      <Animated.View style={[styles.iconBtn, shape, ICON_BTN[variant], disabled && styles.off, dim.style]}>
        {icon}
      </Animated.View>
    </Tap>
  );
}

// --- PillButton ---------------------------------------------------------------

/**
 * `.float.pill` overlay button (viewer / drill / runner): 44 pt pill
 * (`height={40}` for the runner's `.glass`), padding 0/16 (0/12 at 40),
 * gap 8 (6 at 40), a 16 pt icon (18 at 40) and an 11 pt caps label in bone.
 * `status` renders the non-pressable sage "Solved!" pill.
 */
export function PillButton({
  label,
  icon,
  onPress,
  height = 44,
  status = false,
  minWidth,
  disabled = false,
  labelVariant = 'label',
  children,
  testID,
  accessibilityLabel,
  pressFeel,
  style,
  contentStyle,
}: {
  label?: string;
  icon?: ReactNode;
  onPress?: () => void;
  height?: 40 | 44;
  status?: boolean;
  minWidth?: number;
  disabled?: boolean;
  /** Label style: `label` (11 pt caps, default) or e.g. `caption` (viewer's "1212 · Lichess"). */
  labelVariant?: TextVariantName;
  /** Extra trailing content (hint dots). */
  children?: ReactNode;
  testID: string;
  accessibilityLabel?: string;
  pressFeel?: FeelEvent;
  /** Outer (layout) style. */
  style?: StyleProp<ViewStyle>;
  /** The pill itself (e.g. the viewer's Lichess link: padding 0/14, gap 4). */
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const dim = usePressDim();
  const small = height === 40;
  const body = (
    <Animated.View
      style={[
        styles.pill,
        {
          height,
          paddingHorizontal: small ? space[3] : space[4],
          gap: small ? space[1.5] : space[2],
          minWidth,
        },
        status ? styles.pillStatus : styles.pillFloat,
        minWidth ? styles.center : null,
        disabled && styles.off,
        contentStyle,
        dim.style,
      ]}
    >
      {icon}
      {label ? (
        <AppText variant={labelVariant} color={status ? tone.sage : eos.bone} numberOfLines={1} style={styles.tabular}>
          {label}
        </AppText>
      ) : null}
      {children}
    </Animated.View>
  );
  if (status || !onPress) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityRole={status ? 'text' : undefined}
        accessibilityLabel={accessibilityLabel ?? label}
        style={style}
      >
        {body}
      </View>
    );
  }
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? ''}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      pressed={dim.pressed}
      pressedTiming={colorsTiming}
      pressFeel={pressFeel}
      hitSlop={slop(height)}
      style={style}
    >
      {body}
    </Tap>
  );
}

// --- TextLink -------------------------------------------------------------------

/**
 * Ember caps link with a trailing chevron (Home "All sessions"): 11 pt 700
 * caps, gap 2, 32 pt tall (hit area 44).
 */
export function TextLink({
  label,
  onPress,
  chevron = true,
  color = eos.ember,
  testID,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  chevron?: boolean;
  color?: string;
  testID: string;
  accessibilityLabel?: string;
}) {
  const dim = usePressDim();
  return (
    <Tap
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      pressed={dim.pressed}
      pressedTiming={colorsTiming}
      hitSlop={slop(32, 4)}
    >
      <Animated.View style={[styles.link, dim.style]}>
        <AppText variant="label" color={color}>
          {label}
        </AppText>
        {chevron ? <ChevronRight size={14} strokeWidth={2} color={color} /> : null}
      </Animated.View>
    </Tap>
  );
}

// --- CountBadge -------------------------------------------------------------------

/**
 * Ember count bubble (header avatar, friend requests): 18 pt min, 2 px ink
 * ring, 10 pt bold onEmber digits; > 9 shows "9+". Position it yourself
 * (the header puts it at top -4 / right -6).
 */
export function CountBadge({
  count,
  style,
  testID,
}: {
  count: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  if (count <= 0) return null;
  return (
    <View style={[styles.badge, style]} pointerEvents="none" testID={testID}>
      <AppText variant="tabLabel" color={tone.onEmber} style={styles.badgeText} maxFontSizeMultiplier={1}>
        {count > 9 ? '9+' : String(count)}
      </AppText>
    </View>
  );
}

/** Spinner sized for a button label (used by callers composing their own buttons). */
export function ButtonSpinner({ color = eos.bone }: { color?: string }) {
  const t = useUiT();
  return <ActivityIndicator size="small" color={color} accessibilityLabel={t('ui.loading')} />;
}

const ICON_BTN = StyleSheet.create({
  back: { backgroundColor: surface.backFill, boxShadow: [...shadows.backRing] },
  float: { backgroundColor: surface.float, borderWidth: 1, borderColor: surface.floatBorder },
  glass: {
    backgroundColor: surface.glass,
    borderWidth: 1,
    borderColor: surface.glassBorder,
    boxShadow: [...shadows.glass],
  },
  plain: {},
  tile: { backgroundColor: control.tile },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: 'center' },
  off: { opacity: 0.6 },
  busy: { opacity: 0.6 },
  mini: {
    paddingHorizontal: space[2.5],
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  miniEmber: { backgroundColor: eos.ember },
  miniGhost: { borderWidth: 1, borderColor: control.miniGhostBorder, backgroundColor: control.miniGhostBg },
  miniDanger: { borderWidth: 1, borderColor: control.dangerBorder, justifyContent: 'center' },
  miniIcon: { width: 36, paddingHorizontal: 0, justifyContent: 'center' },
  danger: {
    height: layout.outlineHeight,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: control.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[3],
  },
  dangerFilled: { backgroundColor: control.dangerFill },
  chip: {
    height: layout.chipHeight,
    paddingHorizontal: space[3],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOff: {
    backgroundColor: control.chipBg,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: control.chipRing, inset: true }],
  },
  chipOn: { backgroundColor: control.chipOnBg },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: radii.full },
  tabular: { fontVariant: ['tabular-nums'] },
  pillFloat: { backgroundColor: surface.float, borderWidth: 1, borderColor: surface.floatBorder },
  pillStatus: { backgroundColor: control.sageTint16 },
  link: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: space[0.5] },
  badge: {
    minWidth: layout.countBadge,
    height: layout.countBadge,
    paddingHorizontal: space[1],
    borderRadius: radii.full,
    backgroundColor: eos.ember,
    borderWidth: 2,
    borderColor: eos.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { lineHeight: 12 },
});

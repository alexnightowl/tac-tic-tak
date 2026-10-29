import { control, eos, layout, radii, space, surface, tone } from '@tac/core/tokens';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { AppText, type TextVariantName } from './AppText';
import { colorsTiming } from './motion';
import { SectionLabel } from './SectionLabel';
import { Tap } from './Tap';
import { Toggle } from './Toggle';

// Grouped lists of the design v2 settings / about / account artboards:
// `.grp` (slate group, radius 12), `.seam` (1 px ink rule inset 16),
// `.row` (52 pt row: icon · label + hint · value · chevron), `.blk`
// (label + hint above a full-width control) and the `.sect` section label.

/** `.seam`: 1 px ink rule, inset 16 from the left. */
export function Seam({ inset = layout.seamInset }: { inset?: number }) {
  return <View style={[styles.seam, { marginLeft: inset }]} />;
}

/**
 * `.grp`: slate group, radius 12, 1 px bone/4 % border, clipped. Children
 * are separated by a Seam unless `seams={false}` (null children are skipped).
 */
export function GroupedList({
  children,
  seams = true,
  style,
  testID,
}: {
  children: ReactNode;
  seams?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.group, style]} testID={testID}>
      {seams
        ? items.map((child, i) => (
            <Fragment key={child.key ?? i}>
              {i > 0 ? <Seam /> : null}
              {child}
            </Fragment>
          ))
        : items}
    </View>
  );
}

/**
 * A titled group: `.sect` label (11 pt caps, ash, 4 pt side inset), the
 * group, and an optional footer hint (12/16 ash). Gap 8.
 */
export function ListSection({
  title,
  footer,
  children,
  testID,
  style,
}: {
  title?: string;
  footer?: string | null;
  children: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]} testID={testID}>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <GroupedList>{children}</GroupedList>
      {footer ? (
        <AppText variant="caption" style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

type RowPress =
  | { onPress?: undefined; testID?: string }
  /** Pressable rows need a testID (house rule). */
  | { onPress: () => void; testID: string };

export type RowProps = RowPress & {
  label: string;
  hint?: string | null;
  /** Right-aligned value in ash (e.g. "20:00", "0.1.0"). */
  value?: string | null;
  /** 20 pt line icon in ash (rose-red when `danger`), stroke 1.8. */
  icon?: LucideIcon;
  /** Custom leading node (avatar, IconTile); replaces `icon`. */
  leading?: ReactNode;
  /** Custom trailing node (Toggle, MiniButton); shown before the chevron. */
  trailing?: ReactNode;
  /** Defaults to true for a pressable, non-danger row. */
  chevron?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Padding override (the profile row uses 16 all round). */
  padding?: number;
  /** Label style (the profile row uses `title`). */
  labelVariant?: TextVariantName;
  /** Lines of hint before ellipsis (default: unlimited). */
  hintLines?: number;
  accessibilityLabel?: string;
};

/**
 * `.row`: min 52 pt, padding 12/16, gap 12. Pressable rows fade a bone/5 %
 * overlay while held (UI thread). The whole row is one a11y element.
 */
export function Row({
  label,
  hint,
  value,
  icon: Icon,
  leading,
  trailing,
  onPress,
  chevron,
  danger = false,
  disabled = false,
  padding,
  labelVariant = 'bodyLg',
  hintLines,
  testID,
  accessibilityLabel,
}: RowProps) {
  const pressed = useSharedValue(0);
  const overlay = useAnimatedStyle(() => ({ opacity: pressed.get() }));
  const showChevron = chevron ?? (!!onPress && !danger);
  const pad = padding != null ? { padding } : null;
  const body = (
    <>
      {onPress ? <Animated.View pointerEvents="none" style={[styles.pressed, overlay]} /> : null}
      {leading ?? (Icon ? <Icon size={20} strokeWidth={1.8} color={danger ? tone.danger : eos.ash} /> : null)}
      <View style={styles.text}>
        <AppText variant={labelVariant} color={danger ? tone.danger : undefined}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" numberOfLines={hintLines}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="bodyLg" color={eos.ash} numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {trailing}
      {showChevron ? <ChevronRight size={18} strokeWidth={2} color={eos.dust} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={[styles.row, pad, disabled && styles.disabled]} testID={testID}>
        {body}
      </View>
    );
  }
  const a11y = accessibilityLabel ?? [label, value, hint].filter(Boolean).join(', ');
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      pressed={pressed}
      pressedTiming={colorsTiming}
      style={[styles.row, pad, disabled && styles.disabled]}
    >
      {body}
    </Tap>
  );
}

/** `.row` with the `.tg` switch on the right (label + hint, no chevron). */
export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  testID,
  disabled,
}: {
  label: string;
  hint?: string | null;
  value: boolean;
  onChange: (v: boolean) => void;
  testID: string;
  disabled?: boolean;
}) {
  return (
    <Row
      label={label}
      hint={hint}
      trailing={
        <Toggle value={value} onChange={onChange} testID={testID} accessibilityLabel={label} disabled={disabled} />
      }
    />
  );
}

/**
 * `.blk`: padding 14/16, column, gap 12 — a label (16/24) and hint above a
 * full-width control (Segmented, board preview, piece-set picker).
 */
export function ControlBlock({
  label,
  hint,
  children,
  testID,
  style,
}: {
  label?: string;
  hint?: string | null;
  children: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.block, style]} testID={testID}>
      {label ? (
        <View style={styles.text}>
          <AppText variant="bodyLg">{label}</AppText>
          {hint ? <AppText variant="caption">{hint}</AppText> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** About's key/value line: min 48 pt, padding 0/16, body 14/20, value ash. */
export function InfoRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.info} testID={testID}>
      <AppText variant="body" style={styles.flex}>
        {label}
      </AppText>
      <AppText variant="body" color={eos.ash} selectable>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: {
    borderRadius: radii.cardComponent,
    backgroundColor: eos.slate,
    borderWidth: 1,
    borderColor: surface.cardBorder,
    overflow: 'hidden',
  },
  seam: { height: 1, backgroundColor: eos.ink },
  section: { gap: space[2] },
  footer: { paddingHorizontal: space[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: layout.rowMinHeight,
    paddingHorizontal: layout.rowPaddingX,
    paddingVertical: layout.rowPaddingY,
  },
  pressed: { ...StyleSheet.absoluteFill, backgroundColor: control.ghostPressBg },
  disabled: { opacity: 0.5 },
  text: { flex: 1, minWidth: 0, gap: space[0.5] },
  value: { maxWidth: '45%' },
  block: { paddingHorizontal: layout.rowPaddingX, paddingVertical: layout.blockPaddingY, gap: space[3] },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: layout.rowCompactMinHeight,
    paddingHorizontal: layout.rowPaddingX,
  },
});

import { eos, space } from '@tac/core/tokens';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ColorValue, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { AppText } from './AppText';

export type SectionLabelSize = 'group' | 'section';

/**
 * Uppercase section labels, ash, as an a11y header.
 *  - `group` (default) = `.sect` / `.lbl`: 11 pt 700, 1.32 px tracking,
 *    4 pt side inset (sits above a GroupedList).
 *  - `section` = `.sec` / `.slbl`: 12 pt 700, 1.44 px tracking, no inset
 *    (Stats / Profile / Home section heads).
 */
export function SectionLabel({
  children,
  size = 'group',
  color,
  inset,
  style,
  testID,
}: {
  children: ReactNode;
  size?: SectionLabelSize;
  color?: ColorValue;
  /** Side inset; defaults to 4 for `group`, 0 for `section`. */
  inset?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const pad = inset ?? (size === 'group' ? space[1] : 0);
  return (
    <AppText
      variant={size === 'group' ? 'label' : 'sectionLabel'}
      accessibilityRole="header"
      color={color}
      style={[pad ? { paddingHorizontal: pad } : null, style]}
      testID={testID}
    >
      {children}
    </AppText>
  );
}

/** `.kick`: 12 pt 700 caps, 2 px tracking, rose (onboarding kickers). */
export function Kicker({ children, color, style }: { children: ReactNode; color?: ColorValue; style?: StyleProp<TextStyle> }) {
  return (
    <AppText variant="kicker" color={color} style={style}>
      {children}
    </AppText>
  );
}

/**
 * Tab-page title block (Review / Stats): Cinzel 22/28 h1 and an optional
 * 14/20 ash lede, gap 6, padded 16 top and bottom.
 */
export function PageTitle({
  title,
  subtitle,
  children,
  style,
  testID,
}: {
  title: string;
  subtitle?: string | null;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View style={[styles.page, style]} testID={testID}>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color={eos.ash}>
          {subtitle}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingVertical: space[4], gap: space[1.5] },
});

import { control, eos, layout, radii, shadows, space, surface } from '@tac/core/tokens';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { AppText, type TextVariantName } from './AppText';
import { colorsTiming } from './motion';
import { Tap } from './Tap';

/**
 * List card (Review themes, "Session history", Home recent sessions): slate
 * card, radius 16, padding 12, gap 12 — leading tile, a title (Cinzel 15,
 * `turnTitle`) over a 12/16 ash subtitle, then trailing content and an
 * 18 pt dust chevron. `elevated` (default) adds the `.card` shadow; Home's
 * session rows are flat.
 */
export function CardRow({
  title,
  subtitle,
  titleVariant = 'turnTitle',
  leading,
  trailing,
  children,
  onPress,
  chevron,
  elevated = true,
  testID,
  accessibilityLabel,
  style,
}: {
  title?: string;
  subtitle?: string | null;
  titleVariant?: TextVariantName;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Replaces the title/subtitle column (custom middle content). */
  children?: ReactNode;
  onPress?: () => void;
  /** Defaults to true when pressable. */
  chevron?: boolean;
  elevated?: boolean;
  testID: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const pressed = useSharedValue(0);
  const overlay = useAnimatedStyle(() => ({ opacity: pressed.get() }));
  const body = (
    <>
      {onPress ? <Animated.View pointerEvents="none" style={[styles.pressed, overlay]} /> : null}
      {leading}
      {children ?? (
        <View style={styles.text}>
          {title ? (
            <AppText variant={titleVariant} numberOfLines={1}>
              {title}
            </AppText>
          ) : null}
          {subtitle ? (
            <AppText variant="caption" numberOfLines={2} style={styles.tabular}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      )}
      {trailing}
      {(chevron ?? !!onPress) ? <ChevronRight size={18} strokeWidth={2} color={eos.dust} /> : null}
    </>
  );
  const cardStyle = [styles.card, elevated && styles.elevated, style];
  if (!onPress) {
    return (
      <View style={cardStyle} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      pressed={pressed}
      pressedTiming={colorsTiming}
      style={cardStyle}
    >
      {body}
    </Tap>
  );
}

/**
 * Empty state (Review "No puzzles in review"): padding 40/16, centred,
 * gap 12 — a 56 pt card disc with the glyph, a Cinzel 22/28 title, a 14/20
 * ash body, then optional actions.
 */
export function EmptyState({
  icon,
  title,
  body,
  children,
  testID,
  style,
}: {
  icon?: ReactNode;
  title: string;
  body?: string | null;
  children?: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.empty, style]} testID={testID}>
      {icon ? <View style={styles.disc}>{icon}</View> : null}
      <AppText variant="title" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" color={eos.ash} style={styles.center}>
          {body}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radii['2xl'],
    backgroundColor: surface.card,
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  elevated: { boxShadow: [...shadows.card] },
  // Inside the 1 pt border: radius - 1 (no overflow clip, it would cut the drop).
  pressed: { ...StyleSheet.absoluteFill, borderRadius: radii['2xl'] - 1, backgroundColor: control.ghostPressBg },
  text: { flex: 1, minWidth: 0, gap: space[0.5] },
  tabular: { fontVariant: ['tabular-nums'] },
  empty: { paddingVertical: space[10], paddingHorizontal: space[4], alignItems: 'center', gap: space[3] },
  disc: {
    width: layout.emptyDisc,
    height: layout.emptyDisc,
    borderRadius: radii.full,
    backgroundColor: surface.card,
    borderWidth: 1,
    borderColor: surface.cardBorder,
    boxShadow: [...shadows.card],
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});

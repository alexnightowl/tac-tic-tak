import { eos, layout, space } from '@tac/core/tokens';
import type { NativeStackHeaderProps } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { AppText } from './AppText';
import { IconButton } from './Buttons';
import { useT } from './lang';

export type BackVariant = 'back' | 'float' | 'glass';

/**
 * The nested-screen back button. `back` = `.back` (settings: bone/6 % fill,
 * 22 pt chevron), `float` = `.float` (history, viewer: 20 pt chevron),
 * `glass` = `.glass` (profile, friends: the wider 20 pt chevron).
 * `glyph="close"` swaps in the 20 pt × of the drill / mistakes screens.
 * testID defaults to `BackButton` (the id the iOS native back carried, so
 * Maestro flows keep working).
 */
export function BackButton({
  variant = 'back',
  glyph = 'chevron',
  onPress,
  testID = 'BackButton',
  accessibilityLabel,
}: {
  variant?: BackVariant;
  glyph?: 'chevron' | 'close';
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const t = useT();
  let icon: ReactNode;
  if (glyph === 'close') icon = <X size={20} strokeWidth={2} color={eos.bone} />;
  else if (variant === 'glass') icon = <GlassChevron />;
  else icon = <ChevronLeft size={variant === 'back' ? 22 : 20} strokeWidth={2.2} color={eos.bone} />;
  return (
    <IconButton
      variant={variant}
      icon={icon}
      onPress={onPress}
      testID={testID}
      accessibilityLabel={accessibilityLabel ?? t('shell.back')}
    />
  );
}

/** `.glass` back glyph: `M15 5l-7 7 7 7`, 20 pt, stroke 2.2. */
function GlassChevron() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={eos.bone} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

/**
 * Nested-screen header (`.back` pattern): a 54 pt row under the status bar
 * (44 with `compact`, the `.glass` screens), Cinzel 18 title centred, the
 * round back button 16 pt from the left (5 pt from the row top), an
 * optional right action mirrored on the right. Ink ground unless
 * `transparent`.
 */
export function NavHeader({
  title,
  titleNode,
  onBack,
  backVariant = 'back',
  backGlyph,
  backTestID,
  backLabel,
  right,
  compact = false,
  transparent = false,
  safeTop = true,
  testID = 'nav-header',
  style,
}: {
  title?: string;
  /** Custom centre node (e.g. a title that fades in on scroll). */
  titleNode?: ReactNode;
  /** Omit to hide the back button (root of a modal stack). */
  onBack?: () => void;
  backVariant?: BackVariant;
  backGlyph?: 'chevron' | 'close';
  backTestID?: string;
  backLabel?: string;
  right?: ReactNode;
  compact?: boolean;
  transparent?: boolean;
  /** Pad by the status-bar inset (false when the parent already does). */
  safeTop?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const h = compact ? layout.navHeaderCompactHeight : layout.navHeaderHeight;
  const top = compact ? 0 : layout.headerButtonTop;
  return (
    <View
      style={[!transparent && styles.ground, safeTop && { paddingTop: insets.top }, style]}
      testID={testID}
      pointerEvents="box-none"
    >
      <View style={[styles.row, { height: h }]} pointerEvents="box-none">
        {titleNode ??
          (title ? (
            <AppText variant="navTitle" numberOfLines={1} accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
          ) : null)}
        {onBack ? (
          <View style={[styles.left, { top }]}>
            <BackButton
              variant={backVariant}
              glyph={backGlyph}
              onPress={onBack}
              testID={backTestID}
              accessibilityLabel={backLabel}
            />
          </View>
        ) : null}
        {right ? <View style={[styles.right, { top }]}>{right}</View> : null}
      </View>
    </View>
  );
}

/**
 * A native-stack `header` that renders NavHeader from the screen's options:
 * `title` / `headerTitle` (string or render function), `headerRight`,
 * `headerTransparent`; back = `navigation.goBack()` when there is a screen
 * to go back to. The (app) stack uses `stackHeader()` as its default;
 * a screen can opt into another back style with
 * `<Stack.Screen options={{ header: stackHeader('float') }} />`.
 */
export function stackHeader(variant: BackVariant = 'back', opts: { compact?: boolean } = {}) {
  return function StackHeader({ options, navigation, back, route }: NativeStackHeaderProps) {
    const title = typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? route.name);
    const titleNode =
      typeof options.headerTitle === 'function' ? options.headerTitle({ children: title, tintColor: eos.bone }) : undefined;
    const right = options.headerRight ? options.headerRight({ tintColor: eos.bone, canGoBack: !!back }) : null;
    return (
      <NavHeader
        title={title}
        titleNode={titleNode}
        onBack={back ? () => navigation.goBack() : undefined}
        backVariant={variant}
        right={right}
        compact={opts.compact}
        transparent={!!options.headerTransparent}
      />
    );
  };
}

const SIDE = layout.gutter + layout.headerButton + space[2];

const styles = StyleSheet.create({
  ground: { backgroundColor: eos.ink },
  row: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIDE },
  title: { textAlign: 'center' },
  left: { position: 'absolute', left: layout.gutter },
  right: { position: 'absolute', right: layout.gutter },
});

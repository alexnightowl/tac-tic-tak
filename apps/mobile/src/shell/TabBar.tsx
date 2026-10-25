import { control, eos, fontSize, radii } from '@tac/core/tokens';
import { Image } from 'expo-image';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { ChartColumn, Users } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel } from '@/feel';
import { useIncomingRequestCount } from '@/features/social/badge';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { segmentedSpring } from '@/ui/motion';
import { Tap } from '@/ui/Tap';
import { SHELL_TABS, type ShellTabId } from './tabs';

const HOME = require('../../assets/icons/nav-home.webp');
const PLAY = require('../../assets/icons/nav-play.webp');
const REVIEW = require('../../assets/icons/nav-review-book.webp');

const BAR_H = 64;
/** Web: the ember rule spans the middle 44% of the tab (left/right 28%). */
const RULE = 0.44;

/**
 * The app's tab bar (PROVISIONAL Q3/Q31: custom JS bar over NativeTabs, whose
 * iOS 26 Liquid Glass ignores the ember-on-stone ground). Port of the Phase 1
 * mock (src/ui/dev/CustomTabBar.tsx), itself the web Nav.tsx mobile bar:
 * shade ground, seam top rule, 10 px bold labels, bone active / dust idle,
 * 2 px ember rule over the active tab. The rule slides and icon/label
 * colours crossfade on one SharedValue; React only swaps the page.
 */
export function ShellTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const t = useT();
  const { lang } = useLang();
  // Incoming friend requests, badged on the Social tab (web Nav badge).
  const incoming = useIncomingRequestCount();
  const index = state.index;
  const pos = useSharedValue(index);
  const tabW = useSharedValue(0);

  // Follows every index change, taps and programmatic ones (Home's Play
  // button, router.dismissTo('/play')).
  useEffect(() => {
    pos.set(reduced ? index : withSpring(index, segmentedSpring));
  }, [index, reduced, pos]);

  const rule = useAnimatedStyle(() => ({
    width: tabW.get() * RULE,
    opacity: tabW.get() > 0 ? 1 : 0,
    transform: [{ translateX: pos.get() * tabW.get() + tabW.get() * ((1 - RULE) / 2) }],
  }));

  const label = {
    fontFamily: fontFamily(lang, 'body', 700),
    fontSize: fontSize['2xs'][0],
    lineHeight: fontSize['2xs'][1],
  };

  return (
    <View
      style={[styles.bar, { paddingBottom: insets.bottom }]}
      accessibilityRole="tablist"
      accessibilityLabel={t('shell.tabs')}
      testID="tab-bar"
      onLayout={(e) => {
        tabW.set(e.nativeEvent.layout.width / state.routes.length);
      }}
    >
      <Animated.View pointerEvents="none" style={[styles.rule, rule]} />
      {state.routes.map((route, i) => {
        const tab = SHELL_TABS.find((x) => x.name === route.name);
        if (!tab) return null;
        const focused = i === index;
        const text = t(tab.labelKey);
        const badge = tab.id === 'social' && incoming > 0 ? incoming : 0;
        return (
          <Tap
            key={route.key}
            testID={`tab-${tab.id}`}
            accessibilityRole="tab"
            accessibilityLabel={badge ? `${text}, ${badge}` : text}
            accessibilityState={{ selected: focused }}
            style={styles.tab}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              // Re-tapping the active tab only emits (screens scroll to top on it).
              if (focused || event.defaultPrevented) return;
              feel.emit('tabChange');
              navigateToTab(route.key);
            }}
          >
            <View>
              <TabIcon id={tab.id} pos={pos} i={i} />
              {badge ? (
                <View style={styles.badge} pointerEvents="none" testID="tab-social-badge">
                  <Text style={[styles.badgeText, label]} maxFontSizeMultiplier={1}>
                    {badge > 9 ? '9+' : String(badge)}
                  </Text>
                </View>
              ) : null}
            </View>
            <TabLabel pos={pos} i={i} style={label} text={text} testID={`tab-label-${tab.id}`} />
          </Tap>
        );
      })}
    </View>
  );
}

function TabIcon({ id, pos, i }: { id: ShellTabId; pos: SharedValue<number>; i: number }) {
  const on = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.abs(pos.get() - i)) }));
  const off = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(pos.get() - i)) }));
  // Home keeps its painted colours and just dims when idle (web: opacity .5).
  const home = useAnimatedStyle(() => ({
    opacity: interpolate(Math.min(1, Math.abs(pos.get() - i)), [0, 1], [1, 0.5]),
  }));
  if (id === 'home') {
    return (
      <Animated.View style={[styles.icon, home]}>
        <Image source={HOME} style={styles.i24} />
      </Animated.View>
    );
  }
  const draw = (color: string, strong: boolean): ReactNode => {
    switch (id) {
      case 'play':
        return <Image source={PLAY} style={styles.i24} tintColor={color} />;
      case 'review':
        return <Image source={REVIEW} style={styles.book} tintColor={color} />;
      case 'stats':
        return <ChartColumn size={21} color={color} strokeWidth={strong ? 2 : 1.8} />;
      default:
        return <Users size={21} color={color} strokeWidth={strong ? 2 : 1.8} />;
    }
  };
  // Two tinted copies crossfaded: SVG/tint colours can't animate on the UI thread.
  return (
    <View style={styles.icon}>
      <Animated.View style={[styles.layer, off]}>{draw(eos.dust, false)}</Animated.View>
      <Animated.View style={[styles.layer, on]}>{draw(eos.bone, true)}</Animated.View>
    </View>
  );
}

function TabLabel({
  pos,
  i,
  style,
  text,
  testID,
}: {
  pos: SharedValue<number>;
  i: number;
  style: object;
  text: string;
  testID: string;
}) {
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(Math.min(1, Math.abs(pos.get() - i)), [0, 1], [eos.bone, eos.dust]),
  }));
  return (
    <Animated.Text style={[style, color]} numberOfLines={1} maxFontSizeMultiplier={1.2} testID={testID}>
      {text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: eos.shade,
    boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 0, spreadDistance: 0, color: eos.seam, inset: true }],
  },
  rule: { position: 'absolute', top: 0, left: 0, height: 2, borderRadius: 1, backgroundColor: eos.ember },
  tab: { flex: 1, height: BAR_H, alignItems: 'center', justifyContent: 'center', gap: 4 },
  icon: { width: 28, height: 24, alignItems: 'center', justifyContent: 'center' },
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  i24: { width: 24, height: 24 },
  book: { width: 28, height: 24 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radii.full,
    backgroundColor: eos.ember,
    borderWidth: 2,
    borderColor: eos.shade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: control.segmentedActiveText, fontSize: 10, lineHeight: 12 },
});

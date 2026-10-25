import { eos, fontSize } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { ChartColumn, Users } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { fontFamily } from '../fonts';
import { useLang } from '../lang';
import { segmentedSpring } from '../motion';
import { useUiT } from '../strings';
import { Tap } from '../Tap';
import { MOCK_TABS, type MockTabName } from './MockTabPage';

const HOME = require('../../../assets/icons/nav-home.webp');
const PLAY = require('../../../assets/icons/nav-play.webp');
const REVIEW = require('../../../assets/icons/nav-review-book.webp');

const BAR_H = 64;
/** Web: the ember rule spans the middle 44% of the tab (left/right 28%). */
const RULE = 0.44;

/**
 * Custom JS tab bar in the web's ember-on-stone style (Nav.tsx mobile bar:
 * shade ground, seam top rule, 10 px bold labels, bone active / dust idle,
 * 2 px ember rule over the active tab). The rule slides and icon/label
 * colours crossfade on one SharedValue; React only swaps the page.
 */
export function CustomTabBar({ active, onChange }: { active: MockTabName; onChange: (t: MockTabName) => void }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const ui = useUiT();
  const { lang } = useLang();
  const index = MOCK_TABS.findIndex((t) => t.name === active);
  const pos = useSharedValue(index);
  const tabW = useSharedValue(0);

  const rule = useAnimatedStyle(() => ({
    width: tabW.value * RULE,
    opacity: tabW.value > 0 ? 1 : 0,
    transform: [{ translateX: pos.value * tabW.value + tabW.value * ((1 - RULE) / 2) }],
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
      onLayout={(e) => {
        tabW.set(e.nativeEvent.layout.width / MOCK_TABS.length);
      }}
    >
      <Animated.View pointerEvents="none" style={[styles.rule, rule]} />
      {MOCK_TABS.map((tab, i) => (
        <Tap
          key={tab.name}
          testID={`tc-tab-${tab.name}`}
          accessibilityRole="tab"
          accessibilityLabel={ui(tab.key)}
          accessibilityState={{ selected: i === index }}
          style={styles.tab}
          onPress={() => {
            if (i === index) return;
            pos.set(reduced ? i : withSpring(i, segmentedSpring));
            feel.emit('tabChange');
            onChange(tab.name);
          }}
        >
          <TabIcon name={tab.name} pos={pos} i={i} />
          <TabLabel pos={pos} i={i} style={label} text={ui(tab.key)} />
        </Tap>
      ))}
    </View>
  );
}

/** 1 when tab i is fully active, 0 one tab away. */
function useActiveness(pos: SharedValue<number>, i: number) {
  return useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.abs(pos.value - i)) }));
}

function TabIcon({ name, pos, i }: { name: MockTabName; pos: SharedValue<number>; i: number }) {
  const on = useActiveness(pos, i);
  const off = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(pos.value - i)) }));
  // Home keeps its painted colours and just dims when idle (web: opacity .5).
  const home = useAnimatedStyle(() => ({
    opacity: interpolate(Math.min(1, Math.abs(pos.value - i)), [0, 1], [1, 0.5]),
  }));
  if (name === 'index') {
    return (
      <Animated.View style={[styles.icon, home]}>
        <Image source={HOME} style={styles.i24} />
      </Animated.View>
    );
  }
  const draw = (color: string, strong: boolean): ReactNode => {
    switch (name) {
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

function TabLabel({ pos, i, style, text }: { pos: SharedValue<number>; i: number; style: object; text: string }) {
  const color = useAnimatedStyle(() => ({
    color: interpolateColor(Math.min(1, Math.abs(pos.value - i)), [0, 1], [eos.bone, eos.dust]),
  }));
  return (
    <Animated.Text style={[style, color]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
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
});

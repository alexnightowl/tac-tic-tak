import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { ShellTabId } from './tabs';

const HOME = require('../../assets/icons/nav-home.webp');
const PLAY = require('../../assets/icons/nav-play.webp');
/** The Learn tab's open book (canvas LearnHome nav). */
const LEARN = 'M2.5 5.5c3-1.3 6.2-1.3 9.5.8 3.3-2.1 6.5-2.1 9.5-.8v13c-3-1.3-6.2-1.3-9.5.8-3.3-2.1-6.5-2.1-9.5-.8zM12 6.3v13';

/**
 * One tab's icon in one colour (tab bar and the web rail): Home is painted
 * art (no tint), the rest are line glyphs, 1.8 → 2 pt when `strong`.
 */
export function TabGlyph({ id, color, strong }: { id: ShellTabId; color: string; strong: boolean }) {
  switch (id) {
    case 'home':
      return <Image source={HOME} style={styles.i24} />;
    case 'play':
      return <Image source={PLAY} style={styles.i24} tintColor={color} />;
    case 'learn':
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strong ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <Path d={LEARN} />
        </Svg>
      );
    case 'rivals':
      // The League tab: a trophy (lucide "trophy" outline).
      return (
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strong ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16" />
          <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </Svg>
      );
    default:
      return (
        <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strong ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </Svg>
      );
  }
}

const styles = StyleSheet.create({ i24: { width: 24, height: 24 } });

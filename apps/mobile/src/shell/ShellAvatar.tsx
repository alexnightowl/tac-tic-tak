import { eos, shadows, surface } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { assetUrl } from '@/platform/config';
import { fontFamily } from '@/ui/fonts';

const SLATE = require('../../assets/textures/slate.webp');
const CYRILLIC = /[Ѐ-ӿ]/;
/** `.av` background: the slate texture at 220 px, centred. */
const SLATE_SIZE = 220;
/** `.av` box-shadow: the two inset layers ride on an overlay above the content, the two outer ones on the disc. */
const INSET = shadows.avatar.filter((s) => s.inset);
const OUTER = shadows.avatar.filter((s) => !s.inset);
/** surface.avatarHighlight = rgba(255,255,254,0.12), split for svg (which ignores rgba alpha). */
const HIGHLIGHT = { color: 'rgb(255,255,254)', opacity: 0.12 };

/** Web getInitials (components/Avatar.tsx). */
export function initialsOf(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/[^A-Za-zА-Яа-яЁёІіЇїЄєҐґ0-9]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

/**
 * The `.av` disc (design v2): uploaded photo (or a local preview while it
 * uploads), else the slate texture (220 px, centred) under the graphite
 * veil (rgba 74,72,80 → 23,21,25 at 35 %) and a
 * `radial-gradient(circle at 35% 28%, bone/12 %, transparent 60%)` sheen,
 * with Cinzel initials (36 % of the disc). Shadows: inset 0 1 0 bone/16,
 * inset 0 -2 4 black/55, a 1 px black/65 ring and a 0 3 8 black/45 drop.
 */
export function ShellAvatar({
  nickname,
  avatarUrl,
  size,
  localUri,
}: {
  nickname: string;
  avatarUrl?: string | null;
  size: number;
  /** A local file shown instead of `avatarUrl` (optimistic upload preview). */
  localUri?: string | null;
}) {
  const id = useId().replace(/:/g, '');
  const uri = localUri || assetUrl(avatarUrl);
  const initials = initialsOf(nickname);
  // Cinzel has no Cyrillic: pick the uk display face by the glyphs, not the UI language.
  const face = fontFamily(CYRILLIC.test(initials) ? 'uk' : 'en', 'display', 700);
  const disc = { width: size, height: size, borderRadius: size / 2 };
  // circle at 35% 28%, sized to the farthest corner (CSS default).
  const cx = size * 0.35;
  const cy = size * 0.28;
  const r = Math.hypot(size - cx, size - cy);
  const slateOffset = (size - SLATE_SIZE) / 2;
  return (
    <View style={[disc, styles.outer]}>
      <View style={[disc, styles.clip]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" testID="avatar-image" />
        ) : (
          <>
            <Image
              source={SLATE}
              style={{ position: 'absolute', left: slateOffset, top: slateOffset, width: SLATE_SIZE, height: SLATE_SIZE }}
              contentFit="cover"
            />
            <LinearGradient colors={[surface.avatarVeilTop, surface.avatarVeilBottom]} style={StyleSheet.absoluteFill} />
            <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <RadialGradient id={`av${id}`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r}>
                  <Stop offset={0} stopColor={HIGHLIGHT.color} stopOpacity={HIGHLIGHT.opacity} />
                  <Stop offset={0.6} stopColor={HIGHLIGHT.color} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#av${id})`} />
            </Svg>
            <Text style={[styles.initials, { fontFamily: face, fontSize: Math.round(size * 0.36) }]} maxFontSizeMultiplier={1}>
              {initials}
            </Text>
          </>
        )}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.inset, { borderRadius: size / 2 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { boxShadow: OUTER },
  clip: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  inset: { boxShadow: INSET },
  initials: { color: eos.bone },
});

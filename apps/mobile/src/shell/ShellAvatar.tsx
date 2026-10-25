import { eos, shadows, surface, textShadows } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as RNImage, StyleSheet, Text, View } from 'react-native';

import { assetUrl } from '@/platform/config';
import { fontFamily } from '@/ui/fonts';

const SLATE = require('../../assets/textures/slate.webp');
const CYRILLIC = /[Ѐ-ӿ]/;

/** Web getInitials (components/Avatar.tsx). */
export function initialsOf(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/[^A-Za-zА-Яа-яЁёІіЇїЄєҐґ0-9]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

/**
 * The header's avatar disc: uploaded photo, else the `.eos-avatar` slate
 * disc with engraved serif initials. A shell-local stand-in until the
 * social stream ships the shared Avatar (crown, verified badge); swap the
 * import then.
 */
export function ShellAvatar({ nickname, avatarUrl, size }: { nickname: string; avatarUrl?: string | null; size: number }) {
  const uri = assetUrl(avatarUrl);
  const initials = initialsOf(nickname);
  // Cinzel has no Cyrillic: pick the uk display face by the glyphs, not the UI language.
  const face = fontFamily(CYRILLIC.test(initials) ? 'uk' : 'en', 'display', 700);
  const disc = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[disc, styles.shadow]}>
      <View style={[disc, styles.clip]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" testID="avatar-image" />
        ) : (
          <>
            <RNImage source={SLATE} resizeMode="repeat" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={[surface.avatarVeilTop, surface.avatarVeilBottom]} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={[surface.avatarHighlight, 'transparent']}
              start={{ x: 0.3, y: 0.2 }}
              end={{ x: 0.75, y: 0.8 }}
              style={StyleSheet.absoluteFill}
            />
            <Text
              style={[styles.initials, { fontFamily: face, fontSize: Math.round(size * 0.36) }]}
              maxFontSizeMultiplier={1}
            >
              {initials}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { boxShadow: shadows.avatar },
  clip: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initials: {
    color: eos.bone,
    // Engraved look: web text-shadow 0 1px 1px black/.8 (nearest baked layer).
    textShadowColor: textShadows.plateEmber[0].color,
    textShadowOffset: { width: 0, height: textShadows.plateEmber[0].offsetY },
    textShadowRadius: textShadows.plateEmber[0].radius,
  },
});

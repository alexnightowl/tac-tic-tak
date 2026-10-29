import { control, eos, layout, textShadows } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import type { FeelEvent } from '@/feel';
import { AppText, type TextVariantName } from './AppText';
import { platePressTiming } from './motion';
import { PLATE_IMAGES, type PlateSize, type PlateVariant } from './plateImages';
import plates from '../../assets/plates/plates.json';
import { useUiT } from './strings';
import { Tap } from './Tap';

export type { PlateSize, PlateVariant };

const LABEL: Record<PlateSize, TextVariantName> = { sm: 'plateLabelSm', md: 'plateLabel', lg: 'plateLabelLg' };
/** Web: `px-1.5` inside the border box; callers usually add more. */
const INNER_PAD = 6;
const EXTRA_PAD: Record<PlateSize, number> = { sm: 10, md: 14, lg: 18 };

type PlateProps = {
  variant: PlateVariant;
  size: PlateSize;
  /** Silhouette tint: the plate's own alpha shape in one colour, for overlays. */
  tint?: string;
};

/**
 * The stone plate as 3 slices (tools/README.md "Plates"): fixed caps and a
 * centre band laid out like CSS `border-image-repeat: round` — n copies of
 * the mid tile, each stretched to midW / n. Stretching one thin column would
 * smear the texture, so the mid image is the whole band.
 */
function PlateBackground({ variant, size, tint }: PlateProps) {
  const img = PLATE_IMAGES[variant][size];
  const cap = plates.sizes[size].capWidth;
  const tileW = plates.sizes[size].midTileWidth[variant];
  const [tiles, setTiles] = useState(1);
  // Layout only (mount / width change), never on the press path.
  const onLayout = (e: LayoutChangeEvent) => {
    const n = Math.max(1, Math.round(e.nativeEvent.layout.width / tileW));
    if (n !== tiles) setTiles(n);
  };
  return (
    <View style={styles.plateRow} pointerEvents="none">
      <Image source={img.left} style={{ width: cap, height: '100%' }} contentFit="fill" tintColor={tint} />
      <View style={styles.mid} onLayout={onLayout}>
        {Array.from({ length: tiles }, (_, i) => (
          <Image key={i} source={img.mid} style={styles.midTile} contentFit="fill" tintColor={tint} />
        ))}
      </View>
      <Image source={img.right} style={{ width: cap, height: '100%' }} contentFit="fill" tintColor={tint} />
    </View>
  );
}

export type PlateButtonProps = {
  label: string;
  testID: string;
  onPress?: () => void;
  variant?: PlateVariant;
  size?: PlateSize;
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the parent's width. */
  block?: boolean;
  /** Leading glyph (gap 8), e.g. a 16–18 pt icon in the label colour. */
  icon?: ReactNode;
  /**
   * Feel event on pressIn. None by default: FEEL_TABLE has no generic
   * button-press event yet (reported); pass one where a screen has a fitting
   * event (e.g. 'pause').
   */
  pressFeel?: FeelEvent;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Kitchen-sink baselines only: start in the held-down state. */
  pressedPreview?: boolean;
};

export function PlateButton({
  label,
  testID,
  onPress,
  variant = 'ember',
  size = 'md',
  disabled = false,
  loading = false,
  block = false,
  icon,
  pressFeel,
  accessibilityLabel,
  style,
  pressedPreview = false,
}: PlateButtonProps) {
  const t = useUiT();
  const pressed = useSharedValue(pressedPreview ? 1 : 0);
  const inactive = disabled || loading;
  const height = layout.plateHeight[size];
  const cap = plates.sizes[size].capWidth;

  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value }] }));
  const shade = useAnimatedStyle(() => ({ opacity: pressed.value }));

  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      pressed={pressed}
      pressedTiming={platePressTiming}
      pressFeel={pressFeel}
      hitSlop={{ top: Math.max(0, (44 - height) / 2), bottom: Math.max(0, (44 - height) / 2) }}
      style={[block ? styles.block : styles.inline, style]}
    >
      <Animated.View
        style={[styles.plate, { height, paddingHorizontal: cap + INNER_PAD + EXTRA_PAD[size] }, lift]}
      >
        <PlateBackground variant={variant} size={size} />
        {/* CSS brightness(0.8 / 0.86) stand-in: the plate's silhouette in the
            press colour, faded in on the UI thread. A plain rect would also
            darken the transparent rounded corners. */}
        <Animated.View pointerEvents="none" style={[styles.fill, shade]}>
          <PlateBackground
            variant={variant}
            size={size}
            tint={variant === 'ember' ? control.platePressEmber : control.platePressSlate}
          />
        </Animated.View>
        {disabled && (
          // grayscale(0.6) brightness(0.7): a slate veil on ember lands within a
          // few RGB steps of the filtered colour; slate plates only darken.
          <View pointerEvents="none" style={[styles.fill, variant === 'ember' ? styles.disabledEmber : styles.disabledSlate]}>
            <PlateBackground variant={variant} size={size} tint={variant === 'ember' ? eos.slate : eos.ink} />
          </View>
        )}
        {icon && !loading ? <View style={disabled ? styles.dimIcon : null}>{icon}</View> : null}
        <AppText
          variant={LABEL[size]}
          numberOfLines={1}
          color={variant === 'ember' ? control.plateTextEmber : control.plateTextSlate}
          style={[
            variant === 'ember' ? styles.shadowEmber : styles.shadowSlate,
            (loading || disabled) && { opacity: loading ? 0 : 0.7 },
          ]}
        >
          {label}
        </AppText>
        {loading && (
          <ActivityIndicator
            style={styles.spinner}
            size="small"
            color={variant === 'ember' ? control.plateTextEmber : control.plateTextSlate}
            accessibilityLabel={t('ui.loading')}
          />
        )}
      </Animated.View>
    </Tap>
  );
}

const emberShadow = textShadows.plateEmber[0];
const slateShadow = textShadows.plateSlate[0];

const styles = StyleSheet.create({
  inline: { alignSelf: 'flex-start' },
  block: { alignSelf: 'stretch' },
  plate: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  dimIcon: { opacity: 0.7 },
  plateRow: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  mid: { flex: 1, flexDirection: 'row' },
  midTile: { flex: 1, height: '100%' },
  fill: { ...StyleSheet.absoluteFill },
  // Solved against grayscale(.6) brightness(.7) on the plates' mean colour:
  // ember (119,58,57) → (63,46,46), slate (72,71,69) → (50,50,49).
  disabledEmber: { opacity: 0.7 },
  disabledSlate: { opacity: 0.5 },
  spinner: { position: 'absolute' },
  shadowEmber: {
    textShadowOffset: { width: emberShadow.offsetX, height: emberShadow.offsetY },
    textShadowRadius: emberShadow.radius,
    textShadowColor: emberShadow.color,
  },
  shadowSlate: {
    textShadowOffset: { width: slateShadow.offsetX, height: slateShadow.offsetY },
    textShadowRadius: slateShadow.radius,
    textShadowColor: slateShadow.color,
  },
});

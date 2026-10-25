import { promotionPlacement, PROMOTION_PIECE_PADDING, type AppPieceSet, type Orientation, type PromotionPiece, type Square } from '@tac/core/board';
import { board as BOARD, radii, shadows } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PIECE_IMAGES, type PieceCode } from './assets';
import { pieceName, type BoardLabels } from './a11y';

type Props = {
  to: Square;
  color: 'w' | 'b';
  size: number;
  orientation: Orientation;
  mirror: boolean;
  set: AppPieceSet;
  labels: BoardLabels;
  onPick: (piece: PromotionPiece) => void;
  onCancel: () => void;
};

/**
 * Web PromotionPicker: a one-square column on the target file, queen
 * nearest the target. It sits outside the board's gesture detector, so the
 * backdrop needs no 250 ms "ready" guard: the triggering touch has ended.
 */
export function PromotionPicker({ to, color, size, orientation, mirror, set, labels, onPick, onCancel }: Props) {
  const place = promotionPlacement(to, size, orientation, mirror);
  const s = size / 8;
  const pad = s * PROMOTION_PIECE_PADDING;
  return (
    <View style={[StyleSheet.absoluteFill, styles.root]}>
      <Pressable
        testID="promo-cancel"
        accessibilityRole="button"
        accessibilityLabel={labels.cancel}
        onPress={onCancel}
        style={[StyleSheet.absoluteFill, styles.backdrop]}
      />
      <Animated.View
        entering={FadeIn.duration(120)}
        style={[styles.column, { left: place.left, top: place.top, width: place.width, height: place.height }]}
      >
        {place.order.map((p) => {
          const code = `${color}${p.toUpperCase()}` as PieceCode;
          return (
            <Pressable
              key={p}
              testID={`promo-${p}`}
              accessibilityRole="button"
              accessibilityLabel={pieceName(labels, code)}
              onPress={() => onPick(p)}
              style={({ pressed }) => [{ width: s, height: s, padding: pad }, pressed && styles.pressed]}
            >
              <Image source={PIECE_IMAGES[set][code]} style={styles.img} contentFit="contain" transition={null} />
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 60 },
  backdrop: { backgroundColor: BOARD.promotionBackdrop },
  column: {
    position: 'absolute',
    backgroundColor: BOARD.promotionPicker,
    borderRadius: radii.lg,
    boxShadow: [...shadows.floatCard],
  },
  pressed: { backgroundColor: BOARD.promotionPress },
  img: { flex: 1 },
});

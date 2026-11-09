import { normalizePieceSet } from '@tac/core/board';
import { alpha, white } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BOARD_IMAGE, PIECE_IMAGES } from '@/board/assets';
import { placementFromFen } from '@/board/position';
import { useAppStore } from '@/stores/appStore';
import { dx } from '../tokens';

/**
 * A static board picture (DXHomeEmpty hero, DXStormResult mistakes): the
 * baked board texture with the pieces of a FEN on top, from the side to
 * move. No interaction, no animation.
 */
export const MiniBoard = memo(function MiniBoard({
  fen,
  size,
  flip,
  shadow,
  style,
}: {
  fen: string;
  size: number;
  /** Black at the bottom; defaults to the side to move. */
  flip?: boolean;
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const set = normalizePieceSet(useAppStore((s) => s.settings.pieceSet));
  const placement = placementFromFen(fen);
  const black = flip ?? fen.split(' ')[1] === 'b';
  const sq = size / 8;
  return (
    <View style={[{ width: size, height: size }, styles.board, shadow && styles.shadow, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={BOARD_IMAGE} style={StyleSheet.absoluteFill} contentFit="cover" transition={null} />
      {placement.map((code, i) => {
        if (!code) return null;
        const file = i % 8;
        const rank = Math.floor(i / 8);
        const x = black ? 7 - file : file;
        const y = black ? rank : 7 - rank;
        return (
          <Image
            key={i}
            source={PIECE_IMAGES[set][code]}
            style={{ position: 'absolute', left: x * sq, top: y * sq, width: sq, height: sq }}
            contentFit="contain"
            transition={null}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  board: { overflow: 'hidden' },
  shadow: {
    borderRadius: 8,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(white, 0.06) },
      { offsetX: 0, offsetY: 24, blurRadius: 60, spreadDistance: 0, color: dx.popShadow },
    ],
  },
});

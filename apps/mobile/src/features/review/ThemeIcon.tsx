import { THEME_GLYPH_SCALE, resolveThemeIconKey } from '@tac/core/themes';
import { eos } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { Puzzle } from 'lucide-react-native';

// Theme glyphs (web lib/theme-icons.ts): the Lichess SVGs bundled as assets
// and drawn by expo-image, tinted like the web's CSS mask. Slugs without a
// glyph fall back to lucide's Puzzle, as on the web. Shared with any screen
// that shows a theme (theme picker, stats).

const GLYPHS: Record<string, number> = {
  advancedPawn: require('../../../assets/themes/advancedPawn.svg'),
  anastasiaMate: require('../../../assets/themes/anastasiaMate.svg'),
  arabianMate: require('../../../assets/themes/arabianMate.svg'),
  attackingF2F7: require('../../../assets/themes/attackingF2F7.svg'),
  attraction: require('../../../assets/themes/attraction.svg'),
  backRankMate: require('../../../assets/themes/backRankMate.svg'),
  bishopEndgame: require('../../../assets/themes/bishopEndgame.svg'),
  bodenMate: require('../../../assets/themes/bodenMate.svg'),
  capturingDefender: require('../../../assets/themes/capturingDefender.svg'),
  castling: require('../../../assets/themes/castling.svg'),
  defensiveMove: require('../../../assets/themes/defensiveMove.svg'),
  deflection: require('../../../assets/themes/deflection.svg'),
  discoveredAttack: require('../../../assets/themes/discoveredAttack.svg'),
  doubleBishopMate: require('../../../assets/themes/doubleBishopMate.svg'),
  doubleCheck: require('../../../assets/themes/doubleCheck.svg'),
  dovetailMate: require('../../../assets/themes/dovetailMate.svg'),
  enPassant: require('../../../assets/themes/enPassant.svg'),
  exposedKing: require('../../../assets/themes/exposedKing.svg'),
  fork: require('../../../assets/themes/fork.svg'),
  hangingPiece: require('../../../assets/themes/hangingPiece.svg'),
  hookMate: require('../../../assets/themes/hookMate.svg'),
  interference: require('../../../assets/themes/interference.svg'),
  intermezzo: require('../../../assets/themes/intermezzo.svg'),
  killBoxMate: require('../../../assets/themes/killBoxMate.svg'),
  kingsideAttack: require('../../../assets/themes/kingsideAttack.svg'),
  knightEndgame: require('../../../assets/themes/knightEndgame.svg'),
  mate: require('../../../assets/themes/mate.svg'),
  pawnEndgame: require('../../../assets/themes/pawnEndgame.svg'),
  pin: require('../../../assets/themes/pin.svg'),
  promotion: require('../../../assets/themes/promotion.svg'),
  queenEndgame: require('../../../assets/themes/queenEndgame.svg'),
  queenRookEndgame: require('../../../assets/themes/queenRookEndgame.svg'),
  queensideAttack: require('../../../assets/themes/queensideAttack.svg'),
  quietMove: require('../../../assets/themes/quietMove.svg'),
  rookEndgame: require('../../../assets/themes/rookEndgame.svg'),
  sacrifice: require('../../../assets/themes/sacrifice.svg'),
  skewer: require('../../../assets/themes/skewer.svg'),
  smotheredMate: require('../../../assets/themes/smotheredMate.svg'),
  trappedPiece: require('../../../assets/themes/trappedPiece.svg'),
  underPromotion: require('../../../assets/themes/underPromotion.svg'),
  vukovicMate: require('../../../assets/themes/vukovicMate.svg'),
  xRayAttack: require('../../../assets/themes/xRayAttack.svg'),
  zugzwang: require('../../../assets/themes/zugzwang.svg'),
};

export function ThemeIcon({ slug, size = 20, color = eos.ember }: { slug: string; size?: number; color?: string }) {
  const src = GLYPHS[resolveThemeIconKey(slug)];
  if (!src) return <Puzzle size={size} color={color} />;
  // Lichess glyphs carry less padding than lucide: drawn ~20% larger.
  const px = Math.round(size * THEME_GLYPH_SCALE);
  return <Image source={src} style={{ width: px, height: px }} tintColor={color} contentFit="contain" transition={null} />;
}

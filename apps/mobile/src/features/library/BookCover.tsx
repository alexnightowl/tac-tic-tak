import { localized, type LibraryBookSummary } from '@tac/core/library';
import { alpha, cover, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { PIECE_IMAGES, type PieceCode } from '@/board/assets';
import { AppText, textStyle, useLang } from '@/ui';

// The "vintage book" cover (canvas Library page): a 160° cloth gradient, a
// spine shade on the left, two gold rules, the title in the display face,
// the authors in small caps, a white piece and the era at the foot. Every
// measure scales from the shelf size (173 × 232).

const BASE_W = 173;
export const COVER_RATIO = 232 / 173;

type Props = {
  book: Pick<LibraryBookSummary, 'title' | 'authors' | 'era' | 'cover' | 'coverPiece'>;
  width: number;
  testID?: string;
};

export function BookCover({ book, width, testID }: Props) {
  const { lang } = useLang();
  const k = width / BASE_W;
  const palette = cover[book.cover] ?? cover.oxblood;
  const ink = palette.ink;
  const piece = PIECE_IMAGES.classic[(book.coverPiece as PieceCode) in PIECE_IMAGES.classic ? (book.coverPiece as PieceCode) : 'wQ'];
  const title = textStyle('title', lang);
  return (
    <View
      testID={testID}
      style={[styles.root, { width, height: Math.round(width * COVER_RATIO) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient colors={palette.face} start={{ x: 0.33, y: 0 }} end={{ x: 0.67, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.spine} />
      <View style={[styles.rule, { borderColor: alpha(tone.gold, 0.55) }]} />
      <View style={[styles.ruleInner, { borderColor: alpha(tone.gold, 0.25) }]} />
      <View style={[styles.head, { top: Math.round(30 * k) }]}>
        <AppText
          style={[title, { color: ink, fontSize: Math.round(21 * k), lineHeight: Math.round(21 * k * 1.12), letterSpacing: 0.3, textAlign: 'center' }]}
          numberOfLines={3}
          adjustsFontSizeToFit
        >
          {localized(book.title, lang)}
        </AppText>
        <View style={[styles.mark, { marginVertical: Math.max(4, Math.round(7 * k)) }]} />
        <AppText
          variant="captionStrong"
          numberOfLines={2}
          style={{ color: ink, opacity: 0.8, fontSize: Math.max(8, Math.round(11 * k)), lineHeight: Math.max(10, Math.round(14 * k)), letterSpacing: 0.8, textAlign: 'center', textTransform: 'uppercase' }}
        >
          {localized(book.authors, lang)}
        </AppText>
      </View>
      <Image
        source={piece}
        contentFit="contain"
        style={[
          styles.piece,
          { width: Math.round(62 * k), height: Math.round(62 * k), bottom: Math.round(39 * k), marginLeft: -Math.round(31 * k) },
        ]}
      />
      <AppText
        variant="captionStrong"
        style={[styles.era, { color: ink, bottom: Math.round(14 * k), fontSize: Math.max(7, Math.round(10 * k)), lineHeight: Math.max(9, Math.round(13 * k)) }]}
      >
        {localized(book.era, lang)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    overflow: 'hidden',
    boxShadow: [{ offsetX: 0, offsetY: 10, blurRadius: 22, spreadDistance: 0, color: cover.shadow }],
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderLeftWidth: 4,
    borderLeftColor: cover.spine,
    backgroundColor: cover.spineLight,
  },
  rule: { position: 'absolute', left: 11, top: 7, right: 7, bottom: 7, borderWidth: 1, borderRadius: 2 },
  ruleInner: { position: 'absolute', left: 14, top: 10, right: 10, bottom: 10, borderWidth: 1, borderRadius: 1 },
  head: { position: 'absolute', left: 16, right: 12, alignItems: 'center' },
  mark: { width: 22, height: 1, backgroundColor: alpha(tone.gold, 0.7) },
  piece: { position: 'absolute', left: '50%', opacity: 0.85 },
  era: { position: 'absolute', left: 0, right: 0, textAlign: 'center', letterSpacing: 1.5, opacity: 0.65, fontWeight: '800' },
});

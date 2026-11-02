// Author portraits on the title-page covers (owner's list, canvas
// LearnBooks). Keyed by book id; a book with no portrait yet draws its
// coverPiece silhouette in the oval instead (PROVISIONAL, DECISIONS D28:
// steinitz, hypermodern, rubinstein).

const P = {
  greco: require('../../../assets/learn/portraits/greco.jpg'),
  morphy: require('../../../assets/learn/portraits/morphy.jpg'),
  anderssen: require('../../../assets/learn/portraits/anderssen.jpg'),
  pillsbury: require('../../../assets/learn/portraits/pillsbury.jpg'),
  marshall: require('../../../assets/learn/portraits/marshall.jpg'),
  alekhine: require('../../../assets/learn/portraits/alekhine.jpg'),
  capablanca: require('../../../assets/learn/portraits/capablanca.jpg'),
  lasker: require('../../../assets/learn/portraits/lasker.jpg'),
} as const;

export const BOOK_PORTRAITS: Readonly<Record<string, readonly number[]>> = {
  greco: [P.greco],
  romantic: [P.morphy, P.anderssen],
  attack: [P.pillsbury, P.marshall],
  alekhine: [P.alekhine],
  capablanca: [P.capablanca],
  lasker: [P.lasker],
};

export function bookPortraits(id: string): readonly number[] {
  return BOOK_PORTRAITS[id] ?? [];
}

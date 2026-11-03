// Author portraits on the title-page covers (owner's list, canvas
// LearnBooks; Steinitz, Chigorin, Réti, Nimzowitsch and Rubinstein sent by
// the owner on 2026-11-03). Keyed by book id; a book with no portrait draws
// its coverPiece silhouette in the oval instead.

const P = {
  greco: require('../../../assets/learn/portraits/greco.jpg'),
  morphy: require('../../../assets/learn/portraits/morphy.jpg'),
  anderssen: require('../../../assets/learn/portraits/anderssen.jpg'),
  pillsbury: require('../../../assets/learn/portraits/pillsbury.jpg'),
  marshall: require('../../../assets/learn/portraits/marshall.jpg'),
  alekhine: require('../../../assets/learn/portraits/alekhine.jpg'),
  capablanca: require('../../../assets/learn/portraits/capablanca.jpg'),
  lasker: require('../../../assets/learn/portraits/lasker.jpg'),
  steinitz: require('../../../assets/learn/portraits/steinitz.jpg'),
  chigorin: require('../../../assets/learn/portraits/chigorin.jpg'),
  reti: require('../../../assets/learn/portraits/reti.jpg'),
  nimzowitsch: require('../../../assets/learn/portraits/nimzowitsch.jpg'),
  rubinstein: require('../../../assets/learn/portraits/rubinstein.jpg'),
} as const;

export const BOOK_PORTRAITS: Readonly<Record<string, readonly number[]>> = {
  greco: [P.greco],
  romantic: [P.morphy, P.anderssen],
  attack: [P.pillsbury, P.marshall],
  alekhine: [P.alekhine],
  capablanca: [P.capablanca],
  lasker: [P.lasker],
  steinitz: [P.steinitz, P.chigorin],
  hypermodern: [P.reti, P.nimzowitsch],
  rubinstein: [P.rubinstein],
};

export function bookPortraits(id: string): readonly number[] {
  return BOOK_PORTRAITS[id] ?? [];
}

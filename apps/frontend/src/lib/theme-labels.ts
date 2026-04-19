/**
 * Human labels for Lichess puzzle theme slugs.
 * Covers the full canonical list used across the dataset.
 */
const LABELS: Record<string, string> = {
  advancedPawn: 'Advanced pawn',
  advantage: 'Advantage',
  anastasiaMate: 'Anastasia’s mate',
  arabianMate: 'Arabian mate',
  attackingF2F7: 'Attacking f2/f7',
  attraction: 'Attraction',
  backRankMate: 'Back-rank mate',
  bishopEndgame: 'Bishop endgame',
  bodenMate: 'Boden’s mate',
  castling: 'Castling',
  capturingDefender: 'Capturing the defender',
  crushing: 'Crushing',
  defensiveMove: 'Defensive move',
  deflection: 'Deflection',
  discoveredAttack: 'Discovered attack',
  doubleBishopMate: 'Double bishop mate',
  doubleCheck: 'Double check',
  dovetailMate: 'Dovetail mate',
  equality: 'Equality',
  endgame: 'Endgame',
  enPassant: 'En passant',
  exposedKing: 'Exposed king',
  fork: 'Fork',
  hangingPiece: 'Hanging piece',
  hookMate: 'Hook mate',
  interference: 'Interference',
  intermezzo: 'Intermezzo (in-between)',
  killBoxMate: 'Kill-box mate',
  kingsideAttack: 'Kingside attack',
  knightEndgame: 'Knight endgame',
  long: 'Long puzzle',
  master: 'Master game',
  masterVsMaster: 'Master vs master',
  mate: 'Checkmate',
  mateIn1: 'Mate in 1',
  mateIn2: 'Mate in 2',
  mateIn3: 'Mate in 3',
  mateIn4: 'Mate in 4',
  mateIn5: 'Mate in 5 or more',
  middlegame: 'Middlegame',
  oneMove: 'One-move puzzle',
  opening: 'Opening',
  pawnEndgame: 'Pawn endgame',
  pin: 'Pin',
  promotion: 'Promotion',
  queenEndgame: 'Queen endgame',
  queenRookEndgame: 'Queen & rook endgame',
  queensideAttack: 'Queenside attack',
  quietMove: 'Quiet move',
  rookEndgame: 'Rook endgame',
  sacrifice: 'Sacrifice',
  short: 'Short puzzle',
  skewer: 'Skewer',
  smotheredMate: 'Smothered mate',
  superGM: 'Super GM game',
  trappedPiece: 'Trapped piece',
  underPromotion: 'Underpromotion',
  veryLong: 'Very long puzzle',
  vukovicMate: 'Vukovic mate',
  xRayAttack: 'X-ray attack',
  zugzwang: 'Zugzwang',
};

export function themeLabel(slug: string) {
  if (LABELS[slug]) return LABELS[slug];
  // Fallback: camelCase → spaced + capitalised.
  const spaced = slug.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  return spaced;
}

/** All known slugs — used for the theme picker dropdown. */
export const KNOWN_THEME_SLUGS = Object.keys(LABELS);

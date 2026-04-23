/**
 * Human labels for Lichess puzzle theme slugs, in EN + UK. Also owns
 * the list of "meta" slugs that the Lichess dataset tags along with
 * real tactics — game phase, puzzle length, game source, outcome
 * category — so the analytics surfaces can hide them.
 */

const EN: Record<string, string> = {
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

const UK: Record<string, string> = {
  advancedPawn: 'Просунута пішка',
  advantage: 'Перевага',
  anastasiaMate: 'Мат Анастасії',
  arabianMate: 'Арабський мат',
  attackingF2F7: 'Атака на f2/f7',
  attraction: 'Завлікання',
  backRankMate: 'Мат по останній горизонталі',
  bishopEndgame: 'Ендшпіль зі слонами',
  bodenMate: 'Мат Бодена',
  castling: 'Рокіровка',
  capturingDefender: 'Взяття захисника',
  crushing: 'Розгром',
  defensiveMove: 'Захисний хід',
  deflection: 'Відволікання',
  discoveredAttack: 'Відкритий напад',
  doubleBishopMate: 'Мат двома слонами',
  doubleCheck: 'Подвійний шах',
  dovetailMate: 'Мат «ластівчин хвіст»',
  equality: 'Зрівняння',
  endgame: 'Ендшпіль',
  enPassant: 'Взяття на проході',
  exposedKing: 'Відкритий король',
  fork: 'Вилка',
  hangingPiece: 'Вільна фігура',
  hookMate: 'Мат гаком',
  interference: 'Перекриття',
  intermezzo: 'Проміжний хід',
  killBoxMate: 'Мат «коробкою»',
  kingsideAttack: 'Атака на королівському фланзі',
  knightEndgame: 'Ендшпіль з конями',
  long: 'Довга задача',
  master: 'Майстерська гра',
  masterVsMaster: 'Майстер проти майстра',
  mate: 'Мат',
  mateIn1: 'Мат в 1 хід',
  mateIn2: 'Мат в 2 ходи',
  mateIn3: 'Мат в 3 ходи',
  mateIn4: 'Мат в 4 ходи',
  mateIn5: 'Мат в 5+ ходів',
  middlegame: 'Мітельшпіль',
  oneMove: 'Один хід',
  opening: 'Дебют',
  pawnEndgame: 'Пішаковий ендшпіль',
  pin: 'Звʼязка',
  promotion: 'Перетворення',
  queenEndgame: 'Ферзевий ендшпіль',
  queenRookEndgame: 'Ендшпіль ферзь+тура',
  queensideAttack: 'Атака на ферзевому фланзі',
  quietMove: 'Тихий хід',
  rookEndgame: 'Турний ендшпіль',
  sacrifice: 'Жертва',
  short: 'Коротка задача',
  skewer: 'Рентген',
  smotheredMate: 'Спертий мат',
  superGM: 'Партія супер-ГМ',
  trappedPiece: 'Упіймана фігура',
  underPromotion: 'Слабке перетворення',
  veryLong: 'Дуже довга задача',
  vukovicMate: 'Мат Вуковича',
  xRayAttack: 'Рентген-атака',
  zugzwang: 'Цугцванг',
};

/**
 * "Meta" themes — tagged on every Lichess puzzle but not actually
 * describing a tactic. Hide them from the analytics radar, the theme
 * weakness list, and anywhere else where a user would expect to see
 * things like "fork" / "pin" / "skewer".
 *
 * Covers: game phase (opening/middlegame/endgame), puzzle length
 * (oneMove/short/long/veryLong), source of the game (master / masterVsMaster
 * / superGM), outcome-category (advantage / crushing / equality),
 * and the redundant blanket `mate` tag which mateIn{1..5} already cover.
 */
export const META_THEME_SLUGS = new Set<string>([
  'opening', 'middlegame', 'endgame',
  'oneMove', 'short', 'long', 'veryLong',
  'master', 'masterVsMaster', 'superGM',
  'advantage', 'crushing', 'equality',
  'mate',
  'puzzle', // not an official slug but shows up as a catch-all in some imports
]);

export function isMetaTheme(slug: string): boolean {
  return META_THEME_SLUGS.has(slug);
}

export function themeLabel(slug: string, lang: 'en' | 'uk' = 'en') {
  const dict = lang === 'uk' ? UK : EN;
  if (dict[slug]) return dict[slug];
  if (EN[slug]) return EN[slug];
  // Fallback: camelCase → spaced + capitalised.
  const spaced = slug.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  return spaced;
}

/** Tactical theme slugs — meta slugs excluded. Used for the theme picker. */
export const KNOWN_THEME_SLUGS = Object.keys(EN).filter((s) => !META_THEME_SLUGS.has(s));

// From apps/frontend/src/lib/theme-labels.ts (labels, meta slugs) and
// lib/theme-icons.ts (glyph lookup, returned as a key instead of a component).

/**
 * Human labels for Lichess puzzle theme slugs, in EN, UK, RU and ES. Also owns
 * the list of "meta" slugs that the Lichess dataset tags along with
 * real tactics — game phase, puzzle length, game source, outcome
 * category — so the analytics surfaces can hide them.
 */

const EN: Record<string, string> = {
  advancedPawn: "Advanced pawn",
  advantage: "Advantage",
  anastasiaMate: "Anastasia’s mate",
  arabianMate: "Arabian mate",
  attackingF2F7: "Attacking f2/f7",
  attraction: "Attraction",
  backRankMate: "Back-rank mate",
  bishopEndgame: "Bishop endgame",
  bodenMate: "Boden’s mate",
  castling: "Castling",
  capturingDefender: "Capturing the defender",
  crushing: "Crushing",
  defensiveMove: "Defensive move",
  deflection: "Deflection",
  discoveredAttack: "Discovered attack",
  doubleBishopMate: "Double bishop mate",
  doubleCheck: "Double check",
  dovetailMate: "Dovetail mate",
  equality: "Equality",
  endgame: "Endgame",
  enPassant: "En passant",
  exposedKing: "Exposed king",
  fork: "Fork",
  hangingPiece: "Hanging piece",
  hookMate: "Hook mate",
  interference: "Interference",
  intermezzo: "Intermezzo (in-between)",
  killBoxMate: "Kill-box mate",
  kingsideAttack: "Kingside attack",
  knightEndgame: "Knight endgame",
  long: "Long puzzle",
  master: "Master game",
  masterVsMaster: "Master vs master",
  mate: "Checkmate",
  mateIn1: "Mate in 1",
  mateIn2: "Mate in 2",
  mateIn3: "Mate in 3",
  mateIn4: "Mate in 4",
  mateIn5: "Mate in 5 or more",
  middlegame: "Middlegame",
  oneMove: "One-move puzzle",
  opening: "Opening",
  pawnEndgame: "Pawn endgame",
  pin: "Pin",
  promotion: "Promotion",
  queenEndgame: "Queen endgame",
  queenRookEndgame: "Queen & rook endgame",
  queensideAttack: "Queenside attack",
  quietMove: "Quiet move",
  rookEndgame: "Rook endgame",
  sacrifice: "Sacrifice",
  short: "Short puzzle",
  skewer: "Skewer",
  smotheredMate: "Smothered mate",
  superGM: "Super GM game",
  trappedPiece: "Trapped piece",
  underPromotion: "Underpromotion",
  veryLong: "Very long puzzle",
  vukovicMate: "Vukovic mate",
  xRayAttack: "X-ray attack",
  zugzwang: "Zugzwang",
};

// Slugs in the Lichess dataset that the web's label map lacks (it shows the
// camelCase fallback, untranslated). Labels only: kept out of EN so the
// theme picker (KNOWN_THEME_SLUGS) still offers exactly the web's 47.
const EN_EXTRA: Record<string, string> = {
  balestraMate: "Balestra mate",
  blindSwineMate: "Blind swine mate",
  clearance: "Clearance",
  collinearMove: "Collinear move",
  cornerMate: "Corner mate",
  discoveredCheck: "Discovered check",
  epauletteMate: "Epaulette mate",
  morphysMate: "Morphy’s mate",
  operaMate: "Opera mate",
  pillsburysMate: "Pillsbury’s mate",
  swallowstailMate: "Swallow’s tail mate",
  triangleMate: "Triangle mate",
};

const UK: Record<string, string> = {
  advancedPawn: "Просунутий пішак",
  advantage: "Перевага",
  anastasiaMate: "Мат Анастасії",
  arabianMate: "Арабський мат",
  attackingF2F7: "Атака на f2/f7",
  attraction: "Завлікання",
  backRankMate: "Мат по останній горизонталі",
  bishopEndgame: "Слоновий ендшпіль",
  bodenMate: "Мат Бодена",
  castling: "Рокіровка",
  capturingDefender: "Взяття захисника",
  crushing: "Розгром",
  defensiveMove: "Захисний хід",
  deflection: "Відволікання",
  discoveredAttack: "Відкритий напад",
  doubleBishopMate: "Мат двома слонами",
  doubleCheck: "Подвійний шах",
  dovetailMate: "Мат «ластівчин хвіст»",
  equality: "Зрівняння",
  endgame: "Ендшпіль",
  enPassant: "Взяття на проході",
  exposedKing: "Відкритий король",
  fork: "Вилка",
  hangingPiece: "Вільна фігура",
  hookMate: "Мат гаком",
  interference: "Перекриття",
  intermezzo: "Проміжний хід",
  killBoxMate: "Мат «коробкою»",
  kingsideAttack: "Атака на королівському фланзі",
  knightEndgame: "Ендшпіль з конями",
  long: "Довга задача",
  master: "Майстерська гра",
  masterVsMaster: "Майстер проти майстра",
  mate: "Мат",
  mateIn1: "Мат в 1 хід",
  mateIn2: "Мат в 2 ходи",
  mateIn3: "Мат в 3 ходи",
  mateIn4: "Мат в 4 ходи",
  mateIn5: "Мат в 5+ ходів",
  middlegame: "Мітельшпіль",
  oneMove: "Один хід",
  opening: "Дебют",
  pawnEndgame: "Пішаковий ендшпіль",
  pin: "Звʼязка",
  promotion: "Перетворення",
  queenEndgame: "Ферзевий ендшпіль",
  queenRookEndgame: "Ендшпіль ферзь+тура",
  queensideAttack: "Атака на ферзевому фланзі",
  quietMove: "Тихий хід",
  rookEndgame: "Турний ендшпіль",
  sacrifice: "Жертва",
  short: "Коротка задача",
  skewer: "Рентген",
  smotheredMate: "Спертий мат",
  superGM: "Партія супер-ГМ",
  trappedPiece: "Упіймана фігура",
  underPromotion: "Слабке перетворення",
  veryLong: "Дуже довга задача",
  vukovicMate: "Мат Вуковича",
  xRayAttack: "Рентген-атака",
  zugzwang: "Цугцванг",
};

const UK_EXTRA: Record<string, string> = {
  balestraMate: "Мат Балестри",
  blindSwineMate: "Мат «сліпі свині»",
  clearance: "Звільнення",
  collinearMove: "Колінеарний хід",
  cornerMate: "Кутовий мат",
  discoveredCheck: "Відкритий шах",
  epauletteMate: "Еполетний мат",
  morphysMate: "Мат Морфі",
  operaMate: "Оперний мат",
  pillsburysMate: "Мат Пілсбері",
  swallowstailMate: "Мат «хвіст ластівки»",
  triangleMate: "Трикутний мат",
};

const RU: Record<string, string> = {
  advancedPawn: "Продвинутая пешка",
  advantage: "Преимущество",
  anastasiaMate: "Мат Анастасии",
  arabianMate: "Арабский мат",
  attackingF2F7: "Атака на f2/f7",
  attraction: "Завлечение",
  backRankMate: "Мат на последней горизонтали",
  bishopEndgame: "Слоновый эндшпиль",
  bodenMate: "Мат Бодена",
  castling: "Рокировка",
  capturingDefender: "Уничтожение защитника",
  crushing: "Разгром",
  defensiveMove: "Защитный ход",
  deflection: "Отвлечение",
  discoveredAttack: "Вскрытое нападение",
  doubleBishopMate: "Мат двумя слонами",
  doubleCheck: "Двойной шах",
  dovetailMate: "Мат «ласточкин хвост»",
  equality: "Уравнение",
  endgame: "Эндшпиль",
  enPassant: "Взятие на проходе",
  exposedKing: "Открытый король",
  fork: "Вилка",
  hangingPiece: "Висячая фигура",
  hookMate: "Мат крюком",
  interference: "Перекрытие",
  intermezzo: "Промежуточный ход",
  killBoxMate: "Мат «коробочкой»",
  kingsideAttack: "Атака на королевском фланге",
  knightEndgame: "Коневой эндшпиль",
  long: "Длинная задача",
  master: "Партия мастера",
  masterVsMaster: "Мастер против мастера",
  mate: "Мат",
  mateIn1: "Мат в 1 ход",
  mateIn2: "Мат в 2 хода",
  mateIn3: "Мат в 3 хода",
  mateIn4: "Мат в 4 хода",
  mateIn5: "Мат в 5+ ходов",
  middlegame: "Миттельшпиль",
  oneMove: "Один ход",
  opening: "Дебют",
  pawnEndgame: "Пешечный эндшпиль",
  pin: "Связка",
  promotion: "Превращение",
  queenEndgame: "Ферзевый эндшпиль",
  queenRookEndgame: "Эндшпиль ферзь+ладья",
  queensideAttack: "Атака на ферзевом фланге",
  quietMove: "Тихий ход",
  rookEndgame: "Ладейный эндшпиль",
  sacrifice: "Жертва",
  short: "Короткая задача",
  skewer: "Сквозной удар",
  smotheredMate: "Спертый мат",
  superGM: "Партия супер-ГМ",
  trappedPiece: "Пойманная фигура",
  underPromotion: "Слабое превращение",
  veryLong: "Очень длинная задача",
  vukovicMate: "Мат Вуковича",
  xRayAttack: "Рентген",
  zugzwang: "Цугцванг",
};

const RU_EXTRA: Record<string, string> = {
  balestraMate: "Мат Балестры",
  blindSwineMate: "Мат «слепые свиньи»",
  clearance: "Освобождение",
  collinearMove: "Коллинеарный ход",
  cornerMate: "Угловой мат",
  discoveredCheck: "Вскрытый шах",
  epauletteMate: "Эполетный мат",
  morphysMate: "Мат Морфи",
  operaMate: "Оперный мат",
  pillsburysMate: "Мат Пиллсбери",
  swallowstailMate: "Мат «хвост ласточки»",
  triangleMate: "Треугольный мат",
};

const ES: Record<string, string> = {
  advancedPawn: "Peón avanzado",
  advantage: "Ventaja",
  anastasiaMate: "Mate de Anastasia",
  arabianMate: "Mate árabe",
  attackingF2F7: "Ataque a f2/f7",
  attraction: "Atracción",
  backRankMate: "Mate del pasillo",
  bishopEndgame: "Final de alfiles",
  bodenMate: "Mate de Boden",
  castling: "Enroque",
  capturingDefender: "Eliminación del defensor",
  crushing: "Aplastante",
  defensiveMove: "Jugada defensiva",
  deflection: "Desviación",
  discoveredAttack: "Ataque a la descubierta",
  doubleBishopMate: "Mate con dos alfiles",
  doubleCheck: "Jaque doble",
  dovetailMate: "Mate de la cola de paloma",
  equality: "Igualdad",
  endgame: "Final",
  enPassant: "Captura al paso",
  exposedKing: "Rey expuesto",
  fork: "Ataque doble",
  hangingPiece: "Pieza colgada",
  hookMate: "Mate del gancho",
  interference: "Interferencia",
  intermezzo: "Jugada intermedia",
  killBoxMate: "Mate de la caja",
  kingsideAttack: "Ataque en el flanco de rey",
  knightEndgame: "Final de caballos",
  long: "Problema largo",
  master: "Partida de maestro",
  masterVsMaster: "Maestro contra maestro",
  mate: "Jaque mate",
  mateIn1: "Mate en 1",
  mateIn2: "Mate en 2",
  mateIn3: "Mate en 3",
  mateIn4: "Mate en 4",
  mateIn5: "Mate en 5 o más",
  middlegame: "Medio juego",
  oneMove: "Problema de una jugada",
  opening: "Apertura",
  pawnEndgame: "Final de peones",
  pin: "Clavada",
  promotion: "Coronación",
  queenEndgame: "Final de damas",
  queenRookEndgame: "Final de dama y torre",
  queensideAttack: "Ataque en el flanco de dama",
  quietMove: "Jugada tranquila",
  rookEndgame: "Final de torres",
  sacrifice: "Sacrificio",
  short: "Problema corto",
  skewer: "Enfilada",
  smotheredMate: "Mate de la coz",
  superGM: "Partida de súper GM",
  trappedPiece: "Pieza atrapada",
  underPromotion: "Subpromoción",
  veryLong: "Problema muy largo",
  vukovicMate: "Mate de Vuković",
  xRayAttack: "Rayos X",
  zugzwang: "Zugzwang",
};

const ES_EXTRA: Record<string, string> = {
  balestraMate: "Mate de la ballesta",
  blindSwineMate: "Mate de los cerdos ciegos",
  clearance: "Despeje",
  collinearMove: "Jugada colineal",
  cornerMate: "Mate en la esquina",
  discoveredCheck: "Jaque a la descubierta",
  epauletteMate: "Mate de las charreteras",
  morphysMate: "Mate de Morphy",
  operaMate: "Mate de la ópera",
  pillsburysMate: "Mate de Pillsbury",
  swallowstailMate: "Mate de la cola de golondrina",
  triangleMate: "Mate del triángulo",
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
  "opening",
  "middlegame",
  "endgame",
  "oneMove",
  "short",
  "long",
  "veryLong",
  "master",
  "masterVsMaster",
  "superGM",
  "advantage",
  "crushing",
  "equality",
  "mate",
  "puzzle", // not an official slug but shows up as a catch-all in some imports
]);

export function isMetaTheme(slug: string): boolean {
  return META_THEME_SLUGS.has(slug);
}

export type ThemeLabelLang = "en" | "uk" | "ru" | "es";

const LABELS: Record<ThemeLabelLang, Record<string, string>> = { en: EN, uk: UK, ru: RU, es: ES };
const LABELS_EXTRA: Record<ThemeLabelLang, Record<string, string>> = {
  en: EN_EXTRA,
  uk: UK_EXTRA,
  ru: RU_EXTRA,
  es: ES_EXTRA,
};

export function themeLabel(slug: string, lang: ThemeLabelLang = "en") {
  const dict = LABELS[lang] ?? EN;
  if (dict[slug]) return dict[slug];
  if (EN[slug]) return EN[slug];
  const extra = LABELS_EXTRA[lang] ?? EN_EXTRA;
  if (extra[slug]) return extra[slug];
  if (EN_EXTRA[slug]) return EN_EXTRA[slug];
  // Fallback: camelCase → spaced + capitalised.
  const spaced = slug
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());
  return spaced;
}

/** Tactical theme slugs — meta slugs excluded. Used for the theme picker. */
export const KNOWN_THEME_SLUGS = Object.keys(EN).filter(
  (s) => !META_THEME_SLUGS.has(s),
);

// ---- Theme glyphs ---------------------------------------------------------

/**
 * Slugs with a Lichess glyph (game-icons.net, CC BY 3.0 — see the web's
 * /public/design/themes/CREDITS.md). Each key is the SVG's file name.
 */
export const LICHESS_THEME_ICON_KEYS = new Set<string>(["advancedPawn", "anastasiaMate", "arabianMate", "attackingF2F7", "attraction", "backRankMate", "bishopEndgame", "bodenMate", "capturingDefender", "castling", "defensiveMove", "deflection", "discoveredAttack", "doubleBishopMate", "doubleCheck", "dovetailMate", "enPassant", "exposedKing", "fork", "hangingPiece", "hookMate", "interference", "intermezzo", "killBoxMate", "kingsideAttack", "knightEndgame", "mate", "pawnEndgame", "pin", "promotion", "queenEndgame", "queenRookEndgame", "queensideAttack", "quietMove", "rookEndgame", "sacrifice", "skewer", "smotheredMate", "trappedPiece", "underPromotion", "vukovicMate", "xRayAttack", "zugzwang"]);

/** The web falls back to lucide's Puzzle icon for slugs without a glyph. */
export const THEME_ICON_FALLBACK_KEY = "puzzle";

/** Lichess glyphs carry little padding; the web renders them ~20% larger
 *  than the equivalent lucide size to match optical weight. */
export const THEME_GLYPH_SCALE = 1.2;

/** Glyph key for a theme slug: a LICHESS_THEME_ICON_KEYS entry, or
 *  THEME_ICON_FALLBACK_KEY. mateInN shares the mate glyph. */
export function resolveThemeIconKey(slug: string): string {
  if (LICHESS_THEME_ICON_KEYS.has(slug)) return slug;
  if (slug === "mate" || slug.startsWith("mateIn")) return "mate";
  return THEME_ICON_FALLBACK_KEY;
}

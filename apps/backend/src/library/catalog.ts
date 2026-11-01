import alekhine from './content/alekhine.json';
import attack from './content/attack.json';
import capablanca from './content/capablanca.json';
import greco from './content/greco.json';
import hypermodern from './content/hypermodern.json';
import lasker from './content/lasker.json';
import romantic from './content/romantic.json';
import rubinstein from './content/rubinstein.json';
import steinitz from './content/steinitz.json';

// The Library's books (mobile). Positions come from real games before
// 1930 or public-domain books; each content file is produced and checked
// by tools/library (Stockfish-verified lines). The puzzles are also
// upserted into the Puzzle table (LibraryService) so a missed one can sit
// in the Review queue like any other puzzle.

export type Localized = { en: string; uk: string };

export type LibraryPuzzleContent = {
  id: string;
  fen: string;
  /** UCI, space-separated; the first move is the opponent's setup move. */
  moves: string;
  goal: 'mate' | 'win';
  mateIn: number | null;
  rating: number;
  themes: string[];
  deviates?: boolean;
  game: {
    white: string;
    black: string;
    event?: string;
    site?: string;
    year: number;
    date?: string;
    result?: string;
    source?: string;
  };
  note: Localized;
};

export type LibraryChapterContent = {
  id: string;
  title: Localized;
  subtitle: Localized;
  /** Final examination: the app offers no hint and no solution. */
  exam?: boolean;
  puzzles: LibraryPuzzleContent[];
};

type ContentFile = { id: string; version: number; chapters: LibraryChapterContent[] };

export type LibraryCover = 'parchment' | 'oxblood' | 'navy' | 'crimson' | 'graphite' | 'olive' | 'teal' | 'plum' | 'umber';

export type LibraryBookMeta = {
  id: string;
  title: Localized;
  /** The cover's small caps line. */
  authors: Localized;
  /** The book page's line under the title. */
  players: Localized;
  era: Localized;
  description: Localized;
  cover: LibraryCover;
  /** The piece drawn on the cover ('wN', 'wQ', …). */
  coverPiece: string;
};

export type LibraryBook = LibraryBookMeta & { version: number; chapters: LibraryChapterContent[] };

const META: LibraryBookMeta[] = [
  {
    id: 'greco',
    title: { en: 'Greco’s Traps', uk: 'Пастки Греко' },
    authors: { en: 'Gioachino Greco', uk: 'Джоакіно Греко' },
    players: { en: 'Gioachino Greco', uk: 'Джоакіно Греко' },
    era: { en: 'c. 1620', uk: 'бл. 1620' },
    description: {
      en: 'The oldest traps in chess. Greco wrote these games down in the 1620s and players still fall into them today: open lines, a king left in the centre, and a queen that arrives first.',
      uk: 'Найдавніші пастки в шахах. Греко записав ці партії в 1620-х, і в них потрапляють досі: відкриті лінії, король, що застряг у центрі, і ферзь, який встигає першим.',
    },
    cover: 'parchment',
    coverPiece: 'wN',
  },
  {
    id: 'romantic',
    title: { en: 'The Romantic Era', uk: 'Романтична епоха' },
    authors: { en: 'Morphy · Anderssen', uk: 'Морфі · Андерсен' },
    players: { en: 'Morphy · Anderssen · Kolisch', uk: 'Морфі · Андерсен · Коліш' },
    era: { en: '1851–1870', uk: '1851–1870' },
    description: {
      en: 'The age of gambits and queen sacrifices: combinations from the games that taught the world to attack, from the Immortal Game to Morphy at the Paris Opera.',
      uk: 'Епоха гамбітів і жертв ферзя: комбінації з партій, які навчили світ атакувати, від Безсмертної партії до Морфі в Паризькій опері.',
    },
    cover: 'oxblood',
    coverPiece: 'wQ',
  },
  {
    id: 'attack',
    title: { en: 'Masters of Attack', uk: 'Майстри атаки' },
    authors: { en: 'Pillsbury · Marshall', uk: 'Пільсбері · Маршалл' },
    players: { en: 'Pillsbury · Marshall · Janowski', uk: 'Пільсбері · Маршалл · Яновський' },
    era: { en: '1895–1914', uk: '1895–1914' },
    description: {
      en: 'From Hastings 1895 to St Petersburg 1914: the American storm of Pillsbury and Marshall, sacrifices against the castled king and attacks that end in mate.',
      uk: 'Від Гастінгса 1895 до Петербурга 1914: американська буря Пільсбері та Маршалла, жертви проти рокірованого короля й атаки, що закінчуються матом.',
    },
    cover: 'navy',
    coverPiece: 'bR',
  },
  {
    id: 'alekhine',
    title: { en: 'Alekhine’s Fire', uk: 'Вогонь Алехіна' },
    authors: { en: 'A. Alekhine', uk: 'О. Алехін' },
    players: { en: 'Alexander Alekhine', uk: 'Олександр Алехін' },
    era: { en: '1908–1929', uk: '1908–1929' },
    description: {
      en: 'Alekhine before and around the world title: deep combinations, queen raids and attacks out of nowhere, from his first tournaments to the late 1920s.',
      uk: 'Алехін до і довкола чемпіонства світу: глибокі комбінації, рейди ферзя й атаки нізвідки, від перших турнірів до кінця 1920-х.',
    },
    cover: 'crimson',
    coverPiece: 'wB',
  },
  {
    id: 'capablanca',
    title: { en: 'Fundamentals', uk: 'Основи' },
    authors: { en: 'After Capablanca', uk: 'За Капабланкою' },
    players: { en: 'José Raúl Capablanca', uk: 'Хосе Рауль Капабланка' },
    era: { en: '1921', uk: '1921' },
    description: {
      en: 'Clear, simple and deadly: tactics from Capablanca’s games, where the winning blow grows out of better pieces, an open file and a weak square.',
      uk: 'Ясно, просто й смертельно: тактика з партій Капабланки, де вирішальний удар виростає з кращих фігур, відкритої лінії та слабкого поля.',
    },
    cover: 'graphite',
    coverPiece: 'wK',
  },
  {
    id: 'lasker',
    title: { en: 'Lasker’s Endings', uk: 'Ендшпілі Ласкера' },
    authors: { en: 'After Em. Lasker', uk: 'За Ем. Ласкером' },
    players: { en: 'Emanuel Lasker', uk: 'Емануїл Ласкер' },
    era: { en: '1925', uk: '1925' },
    description: {
      en: 'Endgame blows from Emanuel Lasker’s games: the king that walks in, the pawn that runs, and the one move that turns a quiet ending.',
      uk: 'Удари в ендшпілі з партій Емануїла Ласкера: король, що йде вперед, пішак, що біжить, і один хід, який перевертає тихий ендшпіль.',
    },
    cover: 'olive',
    coverPiece: 'bK',
  },
  {
    id: 'steinitz',
    title: { en: 'The Age of Steinitz', uk: 'Епоха Стейніца' },
    authors: { en: 'Steinitz · Chigorin', uk: 'Стейніц · Чигорін' },
    players: { en: 'Steinitz · Chigorin · Zukertort · Blackburne', uk: 'Стейніц · Чигорін · Цукерторт · Блекберн' },
    era: { en: '1873–1894', uk: '1873–1894' },
    description: {
      en: 'The first world champion and his rivals: Steinitz’s new school against Chigorin’s attacks, Zukertort’s combinations and Blackburne’s traps.',
      uk: 'Перший чемпіон світу та його суперники: нова школа Стейніца проти атак Чигоріна, комбінацій Цукерторта й пасток Блекберна.',
    },
    cover: 'teal',
    coverPiece: 'bN',
  },
  {
    id: 'hypermodern',
    title: { en: 'The Hypermoderns', uk: 'Гіпермодерністи' },
    authors: { en: 'Réti · Nimzowitsch', uk: 'Реті · Німцович' },
    players: { en: 'Réti · Nimzowitsch · Tartakower · Bogoljubov', uk: 'Реті · Німцович · Тартаковер · Боголюбов' },
    era: { en: '1915–1929', uk: '1915–1929' },
    description: {
      en: 'The rebels of the 1920s ruled the centre from afar, but when the position opened they struck as hard as anyone.',
      uk: 'Бунтарі 1920-х керували центром здалеку, але коли позиція відкривалась, били не слабше за інших.',
    },
    cover: 'plum',
    coverPiece: 'bB',
  },
  {
    id: 'rubinstein',
    title: { en: 'Rubinstein’s Precision', uk: 'Точність Рубінштейна' },
    authors: { en: 'A. Rubinstein', uk: 'А. Рубінштейн' },
    players: { en: 'Akiba Rubinstein', uk: 'Акіба Рубінштейн' },
    era: { en: '1903–1929', uk: '1903–1929' },
    description: {
      en: 'Akiba Rubinstein’s games: famous for rook endings, and for combinations as clean as his technique.',
      uk: 'Партії Акіби Рубінштейна: славетні ладейні ендшпілі й комбінації, такі ж чисті, як його техніка.',
    },
    cover: 'umber',
    coverPiece: 'wR',
  },
];

const CONTENT: Record<string, ContentFile> = {
  greco: greco as ContentFile,
  romantic: romantic as ContentFile,
  attack: attack as ContentFile,
  alekhine: alekhine as ContentFile,
  capablanca: capablanca as ContentFile,
  lasker: lasker as ContentFile,
  steinitz: steinitz as ContentFile,
  hypermodern: hypermodern as ContentFile,
  rubinstein: rubinstein as ContentFile,
};

/** Books with at least one puzzle, in shelf order. */
export const LIBRARY_BOOKS: LibraryBook[] = META.map((m) => ({
  ...m,
  version: CONTENT[m.id]?.version ?? 0,
  chapters: CONTENT[m.id]?.chapters ?? [],
})).filter((b) => b.chapters.some((c) => c.puzzles.length > 0));

export const LIBRARY_BOOK_BY_ID = new Map(LIBRARY_BOOKS.map((b) => [b.id, b]));

/** puzzleId → bookId, for validating synced results. */
export const LIBRARY_PUZZLE_BOOK = new Map(
  LIBRARY_BOOKS.flatMap((b) => b.chapters.flatMap((c) => c.puzzles.map((p) => [p.id, b.id] as const))),
);

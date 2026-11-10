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

export type Localized = { en: string; uk: string; ru?: string; es?: string };

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
    title: { en: 'Greco’s Traps', uk: 'Пастки Греко', ru: 'Ловушки Греко', es: 'Las trampas de Greco' },
    authors: { en: 'Gioachino Greco', uk: 'Джоакіно Греко', ru: 'Джоакино Греко', es: 'Gioachino Greco' },
    players: { en: 'Gioachino Greco', uk: 'Джоакіно Греко', ru: 'Джоакино Греко', es: 'Gioachino Greco' },
    era: { en: 'c. 1620', uk: 'бл. 1620', ru: 'ок. 1620', es: 'h. 1620' },
    description: {
      en: 'The oldest traps in chess. Greco wrote these games down in the 1620s and players still fall into them today: open lines, a king left in the centre, and a queen that arrives first.',
      uk: 'Найдавніші пастки в шахах. Греко записав ці партії в 1620-х, і в них потрапляють досі: відкриті лінії, король, що застряг у центрі, і ферзь, який встигає першим.',
      ru: 'Древнейшие ловушки в шахматах. Греко записал эти партии в 1620-х, и в них попадаются до сих пор: открытые линии, король, застрявший в центре, и ферзь, который успевает первым.',
      es: 'Las trampas más antiguas del ajedrez. Greco anotó estas partidas en la década de 1620 y todavía hoy se cae en ellas: líneas abiertas, un rey que se queda en el centro y una dama que llega primero.',
    },
    cover: 'parchment',
    coverPiece: 'wN',
  },
  {
    id: 'romantic',
    title: { en: 'The Romantic Era', uk: 'Романтична епоха', ru: 'Романтическая эпоха', es: 'La era romántica' },
    authors: { en: 'Morphy · Anderssen', uk: 'Морфі · Андерсен', ru: 'Морфи · Андерсен', es: 'Morphy · Anderssen' },
    players: { en: 'Morphy · Anderssen · Kolisch', uk: 'Морфі · Андерсен · Коліш', ru: 'Морфи · Андерсен · Колиш', es: 'Morphy · Anderssen · Kolisch' },
    era: { en: '1851–1870', uk: '1851–1870', ru: '1851–1870', es: '1851–1870' },
    description: {
      en: 'The age of gambits and queen sacrifices: combinations from the games that taught the world to attack, from the Immortal Game to Morphy at the Paris Opera.',
      uk: 'Епоха гамбітів і жертв ферзя: комбінації з партій, які навчили світ атакувати, від Безсмертної партії до Морфі в Паризькій опері.',
      ru: 'Эпоха гамбитов и жертв ферзя: комбинации из партий, которые научили мир атаковать, от Бессмертной партии до Морфи в Парижской опере.',
      es: 'La época de los gambitos y los sacrificios de dama: combinaciones de las partidas que enseñaron al mundo a atacar, desde la Partida Inmortal hasta Morphy en la Ópera de París.',
    },
    cover: 'oxblood',
    coverPiece: 'wQ',
  },
  {
    id: 'attack',
    title: { en: 'Masters of Attack', uk: 'Майстри атаки', ru: 'Мастера атаки', es: 'Maestros del ataque' },
    authors: { en: 'Pillsbury · Marshall', uk: 'Пільсбері · Маршалл', ru: 'Пиллсбери · Маршалл', es: 'Pillsbury · Marshall' },
    players: { en: 'Pillsbury · Marshall · Janowski', uk: 'Пільсбері · Маршалл · Яновський', ru: 'Пиллсбери · Маршалл · Яновский', es: 'Pillsbury · Marshall · Janowski' },
    era: { en: '1895–1914', uk: '1895–1914', ru: '1895–1914', es: '1895–1914' },
    description: {
      en: 'From Hastings 1895 to St Petersburg 1914: the American storm of Pillsbury and Marshall, sacrifices against the castled king and attacks that end in mate.',
      uk: 'Від Гастінгса 1895 до Петербурга 1914: американська буря Пільсбері та Маршалла, жертви проти рокірованого короля й атаки, що закінчуються матом.',
      ru: 'От Гастингса 1895 до Петербурга 1914: американская буря Пиллсбери и Маршалла, жертвы против рокированного короля и атаки, которые заканчиваются матом.',
      es: 'De Hastings 1895 a San Petersburgo 1914: la tormenta americana de Pillsbury y Marshall, sacrificios contra el rey enrocado y ataques que terminan en mate.',
    },
    cover: 'navy',
    coverPiece: 'bR',
  },
  {
    id: 'alekhine',
    title: { en: 'Alekhine’s Fire', uk: 'Вогонь Алехіна', ru: 'Огонь Алехина', es: 'El fuego de Alekhine' },
    authors: { en: 'A. Alekhine', uk: 'О. Алехін', ru: 'А. Алехин', es: 'A. Alekhine' },
    players: { en: 'Alexander Alekhine', uk: 'Олександр Алехін', ru: 'Александр Алехин', es: 'Alexander Alekhine' },
    era: { en: '1908–1929', uk: '1908–1929', ru: '1908–1929', es: '1908–1929' },
    description: {
      en: 'Alekhine before and around the world title: deep combinations, queen raids and attacks out of nowhere, from his first tournaments to the late 1920s.',
      uk: 'Алехін до і довкола чемпіонства світу: глибокі комбінації, рейди ферзя й атаки нізвідки, від перших турнірів до кінця 1920-х.',
      ru: 'Алехин до и вокруг чемпионства мира: глубокие комбинации, рейды ферзя и атаки из ниоткуда, от первых турниров до конца 1920-х.',
      es: 'Alekhine antes y en torno al título mundial: combinaciones profundas, incursiones de dama y ataques salidos de la nada, desde sus primeros torneos hasta finales de los años 20.',
    },
    cover: 'crimson',
    coverPiece: 'wB',
  },
  {
    id: 'capablanca',
    title: { en: 'Fundamentals', uk: 'Основи', ru: 'Основы', es: 'Fundamentos' },
    authors: { en: 'After Capablanca', uk: 'За Капабланкою', ru: 'По Капабланке', es: 'Según Capablanca' },
    players: { en: 'José Raúl Capablanca', uk: 'Хосе Рауль Капабланка', ru: 'Хосе Рауль Капабланка', es: 'José Raúl Capablanca' },
    era: { en: '1921', uk: '1921', ru: '1921', es: '1921' },
    description: {
      en: 'Clear, simple and deadly: tactics from Capablanca’s games, where the winning blow grows out of better pieces, an open file and a weak square.',
      uk: 'Ясно, просто й смертельно: тактика з партій Капабланки, де вирішальний удар виростає з кращих фігур, відкритої лінії та слабкого поля.',
      ru: 'Ясно, просто и смертельно: тактика из партий Капабланки, где решающий удар вырастает из лучших фигур, открытой линии и слабого поля.',
      es: 'Claro, sencillo y letal: táctica de las partidas de Capablanca, donde el golpe ganador nace de mejores piezas, una columna abierta y una casilla débil.',
    },
    cover: 'graphite',
    coverPiece: 'wK',
  },
  {
    id: 'lasker',
    title: { en: 'Lasker’s Endings', uk: 'Ендшпілі Ласкера', ru: 'Эндшпили Ласкера', es: 'Los finales de Lasker' },
    authors: { en: 'After Em. Lasker', uk: 'За Ем. Ласкером', ru: 'По Эм. Ласкеру', es: 'Según Em. Lasker' },
    players: { en: 'Emanuel Lasker', uk: 'Емануїл Ласкер', ru: 'Эмануил Ласкер', es: 'Emanuel Lasker' },
    era: { en: '1925', uk: '1925', ru: '1925', es: '1925' },
    description: {
      en: 'Endgame blows from Emanuel Lasker’s games: the king that walks in, the pawn that runs, and the one move that turns a quiet ending.',
      uk: 'Удари в ендшпілі з партій Емануїла Ласкера: король, що йде вперед, пішак, що біжить, і один хід, який перевертає тихий ендшпіль.',
      ru: 'Удары в эндшпиле из партий Эмануила Ласкера: король, который идет вперед, пешка, которая бежит, и один ход, переворачивающий тихий эндшпиль.',
      es: 'Golpes en el final de las partidas de Emanuel Lasker: el rey que avanza, el peón que corre y la única jugada que da la vuelta a un final tranquilo.',
    },
    cover: 'olive',
    coverPiece: 'bK',
  },
  {
    id: 'steinitz',
    title: { en: 'The Age of Steinitz', uk: 'Епоха Стейніца', ru: 'Эпоха Стейница', es: 'La era de Steinitz' },
    authors: { en: 'Steinitz · Chigorin', uk: 'Стейніц · Чигорін', ru: 'Стейниц · Чигорин', es: 'Steinitz · Chigorin' },
    players: { en: 'Steinitz · Chigorin · Zukertort · Blackburne', uk: 'Стейніц · Чигорін · Цукерторт · Блекберн', ru: 'Стейниц · Чигорин · Цукерторт · Блэкберн', es: 'Steinitz · Chigorin · Zukertort · Blackburne' },
    era: { en: '1873–1894', uk: '1873–1894', ru: '1873–1894', es: '1873–1894' },
    description: {
      en: 'The first world champion and his rivals: Steinitz’s new school against Chigorin’s attacks, Zukertort’s combinations and Blackburne’s traps.',
      uk: 'Перший чемпіон світу та його суперники: нова школа Стейніца проти атак Чигоріна, комбінацій Цукерторта й пасток Блекберна.',
      ru: 'Первый чемпион мира и его соперники: новая школа Стейница против атак Чигорина, комбинаций Цукерторта и ловушек Блэкберна.',
      es: 'El primer campeón del mundo y sus rivales: la nueva escuela de Steinitz frente a los ataques de Chigorin, las combinaciones de Zukertort y las trampas de Blackburne.',
    },
    cover: 'teal',
    coverPiece: 'bN',
  },
  {
    id: 'hypermodern',
    title: { en: 'The Hypermoderns', uk: 'Гіпермодерністи', ru: 'Гипермодернисты', es: 'Los hipermodernos' },
    authors: { en: 'Réti · Nimzowitsch', uk: 'Реті · Німцович', ru: 'Рети · Нимцович', es: 'Réti · Nimzowitsch' },
    players: { en: 'Réti · Nimzowitsch · Tartakower · Bogoljubov', uk: 'Реті · Німцович · Тартаковер · Боголюбов', ru: 'Рети · Нимцович · Тартаковер · Боголюбов', es: 'Réti · Nimzowitsch · Tartakower · Bogoljubov' },
    era: { en: '1915–1929', uk: '1915–1929', ru: '1915–1929', es: '1915–1929' },
    description: {
      en: 'The rebels of the 1920s ruled the centre from afar, but when the position opened they struck as hard as anyone.',
      uk: 'Бунтарі 1920-х керували центром здалеку, але коли позиція відкривалась, били не слабше за інших.',
      ru: 'Бунтари 1920-х управляли центром издалека, но когда позиция раскрывалась, били не слабее других.',
      es: 'Los rebeldes de los años 20 dominaban el centro a distancia, pero cuando la posición se abría golpeaban tan fuerte como cualquiera.',
    },
    cover: 'plum',
    coverPiece: 'bB',
  },
  {
    id: 'rubinstein',
    title: { en: 'Rubinstein’s Precision', uk: 'Точність Рубінштейна', ru: 'Точность Рубинштейна', es: 'La precisión de Rubinstein' },
    authors: { en: 'A. Rubinstein', uk: 'А. Рубінштейн', ru: 'А. Рубинштейн', es: 'A. Rubinstein' },
    players: { en: 'Akiba Rubinstein', uk: 'Акіба Рубінштейн', ru: 'Акиба Рубинштейн', es: 'Akiba Rubinstein' },
    era: { en: '1903–1929', uk: '1903–1929', ru: '1903–1929', es: '1903–1929' },
    description: {
      en: 'Akiba Rubinstein’s games: famous for rook endings, and for combinations as clean as his technique.',
      uk: 'Партії Акіби Рубінштейна: славетні ладейні ендшпілі й комбінації, такі ж чисті, як його техніка.',
      ru: 'Партии Акибы Рубинштейна: знаменитые ладейные эндшпили и комбинации, такие же чистые, как его техника.',
      es: 'Las partidas de Akiba Rubinstein: famosas por sus finales de torres y por combinaciones tan limpias como su técnica.',
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

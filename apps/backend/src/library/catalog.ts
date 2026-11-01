import greco from './content/greco.json';
import romantic from './content/romantic.json';

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
  puzzles: LibraryPuzzleContent[];
};

type ContentFile = { id: string; version: number; chapters: LibraryChapterContent[] };

export type LibraryCover = 'parchment' | 'oxblood';

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
];

const CONTENT: Record<string, ContentFile> = {
  greco: greco as ContentFile,
  romantic: romantic as ContentFile,
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

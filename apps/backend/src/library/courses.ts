import type { Localized } from './catalog';
import advanced from './courses/advanced.json';
import basic from './courses/basic.json';
import endgames from './courses/endgames.json';
import intermediate from './courses/intermediate.json';

// The Learn tab's courses (mobile, docs/mobile/COURSES.md): one chapter
// per tactical theme with Lichess puzzles by their own ids, and a final
// exam of fresh puzzles. Content files are produced and checked by
// tools/courses. Unlike the books, these puzzles are real Lichess rows:
// the service only inserts the missing ones, with their real stats, and
// never rewrites a row Play already serves.

export type CoursePuzzleContent = {
  id: string;
  fen: string;
  /** UCI, space-separated; the first move is the opponent's setup move. */
  moves: string;
  rating: number;
  ratingDeviation: number;
  popularity: number;
  nbPlays: number;
  themes: string[];
  gameUrl: string | null;
  goal: 'mate' | 'win' | 'equal';
  mateIn: number | null;
  /** Exam puzzles: the chapter theme it was picked for. */
  theme?: string;
};

export type CourseArrow = { from: string; to: string; kind: 'move' | 'threat' };

export type CourseChapterContent = {
  id: string;
  theme: string;
  title: Localized;
  tip: Localized;
  intro: { text: Localized; fen: string; arrows: CourseArrow[]; caption: Localized };
  puzzles: CoursePuzzleContent[];
};

export type CourseExamContent = { id: string; passMark: number; puzzles: CoursePuzzleContent[] };

type ContentFile = { id: string; version: number; chapters: CourseChapterContent[]; exam: CourseExamContent };

export type CoursePiece = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export type CourseMeta = {
  id: string;
  title: Localized;
  description: Localized;
  /** Emblem ring, tints and seal. */
  color: string;
  piece: CoursePiece;
  /** The level the course is written for. */
  ratingMin: number;
  ratingMax: number;
  /** Offered by "At {rating} we suggest …". */
  suggest: boolean;
};

export type Course = CourseMeta & { version: number; chapters: CourseChapterContent[]; exam: CourseExamContent };

const META: CourseMeta[] = [
  {
    id: 'basic',
    title: { en: 'Basic', uk: 'Базовий', ru: 'Базовый', es: 'Básico' },
    description: {
      en: 'Hanging pieces, forks, pins and the first mates.',
      uk: 'Висячі фігури, вилки, зв’язки й перші мати.',
      ru: 'Висячие фигуры, вилки, связки и первые маты.',
      es: 'Piezas colgadas, ataques dobles, clavadas y los primeros mates.',
    },
    color: '#8e4542',
    piece: 'pawn',
    ratingMin: 400,
    ratingMax: 1400,
    suggest: true,
  },
  {
    id: 'intermediate',
    title: { en: 'Intermediate', uk: 'Середній', ru: 'Средний', es: 'Intermedio' },
    description: {
      en: 'Attraction, deflection, in-between moves and the classic mating patterns.',
      uk: 'Заманювання, відволікання, проміжні ходи й класичні матові візерунки.',
      ru: 'Завлечение, отвлечение, промежуточные ходы и классические матовые схемы.',
      es: 'Atracción, desviación, jugadas intermedias y los patrones de mate clásicos.',
    },
    color: '#c98c55',
    piece: 'knight',
    ratingMin: 1100,
    ratingMax: 1900,
    suggest: true,
  },
  {
    id: 'advanced',
    title: { en: 'Advanced', uk: 'Просунутий', ru: 'Продвинутый', es: 'Avanzado' },
    description: {
      en: 'Quiet moves, x-rays, long combinations and the only defence.',
      uk: 'Тихі ходи, рентген, довгі комбінації та єдиний захист.',
      ru: 'Тихие ходы, рентген, длинные комбинации и единственная защита.',
      es: 'Jugadas tranquilas, rayos X, combinaciones largas y la única defensa.',
    },
    color: '#cbbfae',
    piece: 'queen',
    ratingMin: 1800,
    ratingMax: 2600,
    suggest: true,
  },
  {
    id: 'endgames',
    title: { en: 'Endgames', uk: 'Ендшпіль', ru: 'Эндшпиль', es: 'Finales' },
    description: {
      en: 'Pawn, rook and minor-piece endings: promotion, zugzwang and exact technique.',
      uk: 'Пішакові, турні й легкофігурні закінчення: перетворення, цугцванг і точна техніка.',
      ru: 'Пешечные, ладейные и легкофигурные окончания: превращение, цугцванг и точная техника.',
      es: 'Finales de peones, de torres y de piezas menores: coronación, zugzwang y técnica precisa.',
    },
    color: '#94a58e',
    piece: 'king',
    ratingMin: 800,
    ratingMax: 2300,
    suggest: false,
  },
];

const CONTENT: Record<string, ContentFile> = {
  basic: basic as ContentFile,
  intermediate: intermediate as ContentFile,
  advanced: advanced as ContentFile,
  endgames: endgames as ContentFile,
};

/** Courses with content, in list order. */
export const COURSES: Course[] = META.flatMap((m) => {
  const c = CONTENT[m.id];
  if (!c || !c.chapters.some((ch) => ch.puzzles.length > 0)) return [];
  return [{ ...m, version: c.version, chapters: c.chapters, exam: c.exam }];
});

export const COURSE_BY_ID = new Map(COURSES.map((c) => [c.id, c]));

/** Every puzzle of a course, chapters then exam. */
export const coursePuzzles = (c: Course) => [...c.chapters.flatMap((ch) => ch.puzzles), ...c.exam.puzzles];

/** puzzleId → courseId, for validating synced results. */
export const COURSE_PUZZLE_COURSE = new Map(COURSES.flatMap((c) => coursePuzzles(c).map((p) => [p.id, c.id] as const)));

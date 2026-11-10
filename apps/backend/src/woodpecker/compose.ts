// Pure parts of a "book" Woodpecker pool (D41): the method's two parts,
// the motif quotas and the solving order. No imports, so it can be tested
// and reasoned about on its own.

/** Book shares: Easy 222 and Intermediate 762 of the book's 984 (Advanced is left out, as the authors advise). */
export const BOOK_PARTS = [
  { part: 'easy', share: 0.22, from: -300, to: -150 },
  { part: 'intermediate', share: 0.78, from: -150, to: 50 },
] as const;
export type BookPart = (typeof BOOK_PARTS)[number]['part'];

export const POOL_SIZE = 1000;
/** Candidates drawn per pick, against the puzzles wanted (room for the quotas). */
export const OVERDRAW = 4;
/** At most this share of the pool is mate in one. */
export const MATE_IN_ONE_SHARE = 0.05;

/**
 * A puzzle's motif for the quotas: the first of these in its Lichess
 * themes (specific before general), else "other".
 */
export const MOTIFS = [
  'smotheredMate', 'backRankMate', 'doubleCheck', 'discoveredAttack', 'skewer', 'xRayAttack', 'pin', 'fork',
  'interference', 'clearance', 'capturingDefender', 'deflection', 'attraction', 'intermezzo', 'trappedPiece',
  'quietMove', 'promotion', 'hangingPiece', 'sacrifice', 'mate',
] as const;

/** Quota weights: the everyday motifs count more; the rest share "other". */
const WEIGHT: Record<string, number> = {
  fork: 3, pin: 2, discoveredAttack: 2, deflection: 2, mate: 2, skewer: 1.5, attraction: 1.5,
  capturingDefender: 1.5, hangingPiece: 1.5, backRankMate: 1.5, doubleCheck: 1, xRayAttack: 1,
  interference: 1, clearance: 1, intermezzo: 1, trappedPiece: 1, quietMove: 1, promotion: 1,
  sacrifice: 1, smotheredMate: 0.5, other: 1,
};

export type Candidate = { id: string; rating: number; moves: string; themes: string[] };
type Picked = Candidate & { motif: string };

export function motifOf(themes: readonly string[]): string {
  for (const m of MOTIFS) {
    if (m === 'promotion' ? themes.includes('promotion') || themes.includes('advancedPawn') : themes.includes(m)) return m;
  }
  return 'other';
}

/** The player's moves in a Lichess line (the first move is the opponent's). */
export const playerMoves = (moves: string) => Math.floor(moves.trim().split(/\s+/).length / 2);

/**
 * `count` puzzles from `candidates` by the motif quotas: each motif takes
 * up to its weighted share, then the rest fills one motif at a time.
 * Intermediate puzzles need two moves of the player (the book's lines are
 * calculated, not spotted); mate in one is capped across the part.
 */
export function compose(candidates: readonly Candidate[], count: number, part: BookPart): Picked[] {
  const mateInOneCap = Math.floor(count * MATE_IN_ONE_SHARE);
  const fit = candidates
    .filter((c) => part === 'easy' || playerMoves(c.moves) >= 2)
    .map((c) => ({ ...c, motif: motifOf(c.themes) }));
  const byMotif = new Map<string, Picked[]>();
  for (const c of fit) {
    const list = byMotif.get(c.motif) ?? [];
    list.push(c);
    byMotif.set(c.motif, list);
  }
  const total = Object.values(WEIGHT).reduce((s, w) => s + w, 0);
  const out: Picked[] = [];
  const used = new Set<string>();
  let mateInOne = 0;
  const take = (c: Picked) => {
    const m1 = c.themes.includes('mateIn1');
    if (used.has(c.id) || (m1 && mateInOne >= mateInOneCap)) return false;
    used.add(c.id);
    if (m1) mateInOne += 1;
    out.push(c);
    return true;
  };
  for (const [motif, w] of Object.entries(WEIGHT)) {
    const quota = Math.round((count * w) / total);
    let n = 0;
    for (const c of byMotif.get(motif) ?? []) {
      if (n >= quota || out.length >= count) break;
      if (take(c)) n += 1;
    }
  }
  // The rest round-robin across motifs, so no common motif swamps the part.
  const queues = [...byMotif.values()].map((list) => list.filter((c) => !used.has(c.id)));
  while (out.length < count && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      if (out.length >= count) break;
      while (q.length > 0 && !take(q.shift()!));
    }
  }
  return out;
}

/**
 * The solving order within a part: easier first, but never the same
 * motif twice in a row when a different one is close behind (the book
 * mixes motifs, so the theme can't give the answer away).
 */
export function order(puzzles: readonly Picked[]): Picked[] {
  const list = [...puzzles].sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id));
  for (let i = 1; i < list.length; i++) {
    if (list[i].motif !== list[i - 1].motif) continue;
    const j = list.findIndex((p, k) => k > i && k <= i + 8 && p.motif !== list[i - 1].motif);
    if (j > 0) [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

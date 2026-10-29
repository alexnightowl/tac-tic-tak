import { describe, expect, it } from 'vitest';
import {
  mergePuzzles, playedIds, summarizeSync, syncBatches, toOfflinePuzzle, topThemes, unplayed, uuidV4,
  type OfflinePuzzle, type OfflineSyncBody, type OfflineSyncResponse, type PendingResult,
} from '../src/offline';

const pz = (id: string, themes: string[] = []): OfflinePuzzle => ({ id, fen: 'f', moves: ['a2a3', 'a7a6'], rating: 1500, themes });

const pending = (over: Partial<PendingResult> & Pick<PendingResult, 'clientId' | 'solvedAt'>): PendingResult => ({
  puzzleId: over.clientId,
  correct: true,
  responseMs: 1000,
  localDay: '2026-10-30',
  source: 'pack',
  style: 'blitz',
  pack: 'level',
  ...over,
});

const res = (over: Partial<OfflineSyncResponse> = {}): OfflineSyncResponse => ({
  sessionId: 's', ratingBefore: 1600, ratingAfter: 1610, delta: 10, solved: 2, total: 3, accuracy: 0.67, timeMs: 30_000,
  mistakesToReview: 1, reviewResolved: 0, duplicates: 0, streak: { days: 4, outcome: 'continued' }, ...over,
});

describe('offline: packs', () => {
  it('normalises space-joined moves and missing themes', () => {
    expect(toOfflinePuzzle({ id: 'a', fen: 'f', moves: 'e2e4 e7e5', rating: 1 }).moves).toEqual(['e2e4', 'e7e5']);
    expect(toOfflinePuzzle({ id: 'a', fen: 'f', moves: ['e2e4'], rating: 1, themes: null }).themes).toEqual([]);
  });

  it('played = queued results of that pack; unplayed keeps order', () => {
    const q = [pending({ clientId: 'c1', puzzleId: 'b', solvedAt: '1' }), pending({ clientId: 'c2', puzzleId: 'a', solvedAt: '2', pack: 'review', source: 'review' })];
    expect([...playedIds(q, 'level')]).toEqual(['b']);
    expect(unplayed([pz('a'), pz('b'), pz('c')], playedIds(q, 'level')).map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('merge keeps what is there, dedupes, caps', () => {
    expect(mergePuzzles([pz('a'), pz('b')], [pz('b'), pz('c'), pz('d')], 3).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('top themes by frequency', () => {
    const list = [pz('1', ['fork', 'middlegame']), pz('2', ['fork', 'pin']), pz('3', ['pin', 'middlegame']), pz('4', ['fork'])];
    expect(topThemes(list, 2, new Set(['middlegame']))).toEqual(['fork', 'pin']);
  });
});

describe('offline: sync batches', () => {
  it('one batch per style, solvedAt order, extra fields stripped, chunked', () => {
    const q = [
      pending({ clientId: 'b2', solvedAt: '2026-10-30T10:00:02Z' }),
      pending({ clientId: 'r1', solvedAt: '2026-10-30T10:00:00Z', style: 'rapid' }),
      pending({ clientId: 'b1', solvedAt: '2026-10-30T10:00:01Z' }),
      pending({ clientId: 'b3', solvedAt: '2026-10-30T10:00:03Z', source: 'review', pack: 'review' }),
    ];
    const out = syncBatches(q, -240, 2);
    expect(out.map((b) => [b.style, b.attempts.map((a) => a.clientId)])).toEqual([
      ['blitz', ['b1', 'b2']],
      ['blitz', ['b3']],
      ['rapid', ['r1']],
    ]);
    expect(out[0].tzOffsetMin).toBe(-240);
    expect(Object.keys(out[0].attempts[0]).sort()).toEqual(['clientId', 'correct', 'localDay', 'puzzleId', 'responseMs', 'solvedAt', 'source']);
  });

  it('summary sums batches, rates only batches with pack attempts', () => {
    const body = (style: 'blitz' | 'rapid', source: 'pack' | 'review'): OfflineSyncBody => ({
      style, tzOffsetMin: 0, attempts: [{ clientId: 'x', puzzleId: 'p', correct: true, responseMs: 1, solvedAt: 's', localDay: 'd', source }],
    });
    const s = summarizeSync([
      { body: body('blitz', 'pack'), res: res() },
      { body: body('blitz', 'pack'), res: res({ ratingBefore: 1610, ratingAfter: 1590, solved: 1, total: 1, streak: null }) },
      { body: body('rapid', 'review'), res: res({ ratingBefore: 1400, ratingAfter: 1400, solved: 1, total: 2, duplicates: 1, streak: null }) },
    ]);
    expect(s.ratings).toEqual([{ style: 'blitz', before: 1600, after: 1590, delta: -10 }]);
    expect(s.total).toBe(6);
    expect(s.solved).toBe(4);
    expect(s.accuracy).toBeCloseTo(4 / 6);
    expect(s.duplicates).toBe(1);
    expect(s.synced).toBe(2);
    expect(s.streak).toEqual({ days: 4, outcome: 'continued' });
  });
});

describe('offline: ids', () => {
  it('uuid v4 shape', () => {
    let i = 0;
    const id = uuidV4((n) => Uint8Array.from({ length: n }, () => (i++ * 37) & 255));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

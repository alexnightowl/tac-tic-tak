import { describe, expect, it } from 'vitest';
import { levelPoints } from '../src/charts';
import { levelFor } from '../src/runner';

describe('D39 level helpers', () => {
  it('levelFor: the stored level, else initialLevel(rating, norm), else the rating grid mark', () => {
    expect(levelFor({ level: 1550, currentPuzzleRating: 1612 })).toBe(1550);
    expect(levelFor({ level: null, currentPuzzleRating: 1612, unlockedStartRating: 1500 })).toBe(1500);
    expect(levelFor({ currentPuzzleRating: 1412, unlockedStartRating: 1500 })).toBe(1400);
    expect(levelFor({ currentPuzzleRating: 1612 })).toBe(1600);
  });

  it('levelPoints: rated v2 sessions at their start; rows without mode / ruleset all count', () => {
    const rows = [
      { endedAt: '2026-11-01', style: 'blitz', startRating: 1500, peakRating: 1580 },
      { endedAt: '2026-11-02', style: 'blitz', startRating: 1700, mode: 'casual', ruleset: 'v2' },
      { endedAt: '2026-11-03', style: 'bullet', startRating: 1450, mode: 'mixed', ruleset: 'v2' },
      { endedAt: '2026-11-04', style: 'mixed', startRating: 1300 },
      { endedAt: '2026-11-05', style: 'rapid', startRating: 1200, mode: 'theme', ruleset: 'v2' },
      { endedAt: '2026-11-06', style: 'rapid', startRating: 1260, mode: 'mixed', ruleset: null },
      { endedAt: '2026-11-07', style: 'rapid', startRating: 1275, mode: 'mixed' },
    ];
    expect(levelPoints(rows)).toEqual([
      { endedAt: '2026-11-01', style: 'blitz', rating: 1500 },
      { endedAt: '2026-11-03', style: 'bullet', rating: 1450 },
      { endedAt: '2026-11-07', style: 'rapid', rating: 1275 },
    ]);
    expect(levelPoints(undefined)).toEqual([]);
  });
});

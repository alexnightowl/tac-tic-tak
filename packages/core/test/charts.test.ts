import { describe, expect, it } from 'vitest';
import {
  bucketByLocalDay, buildGrid, heatmapTooltip, levelFor, monthMarkers, niceStep, radarBounds,
  radarGeometry, ratingChartLayout, ratingScale, selectRadarThemes, smoothPath, wrapLabel,
  type RatingPoint,
} from '../src/charts';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe('heatmap', () => {
  it('levelFor buckets', () => {
    expect([0, -1, 1, 2, 3, 4, 7, 8, 100].map(levelFor)).toEqual([0, 0, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('buildGrid ends on the current week, Mon..Sun, future days null', () => {
    const now = at(2026, 10, 22); // Thursday
    const grid = buildGrid([{ date: '2026-10-22', count: 2 }, { date: '2026-10-05', count: 9 }], 52, now);
    expect(grid.weeks).toHaveLength(52);
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true);
    const last = grid.weeks[51];
    expect(last[0]?.date).toBe('2026-10-19'); // Monday
    expect(last[3]).toMatchObject({ date: '2026-10-22', count: 2, level: 2 });
    expect(last.slice(4)).toEqual([null, null, null]);
    expect(grid.weeks[0][0]?.date).toBe('2025-10-27');
    const oct5 = grid.weeks.flat().find((c) => c?.date === '2026-10-05');
    expect(oct5?.level).toBe(4);
    expect(grid.weeks.flat().filter(Boolean)).toHaveLength(51 * 7 + 4);
  });

  it('a Sunday "now" fills the whole last column', () => {
    const grid = buildGrid([], 4, at(2026, 10, 25));
    expect(grid.weeks[3].every((c) => c !== null)).toBe(true);
    expect(grid.weeks[3][6]?.date).toBe('2026-10-25');
  });

  it('month markers go on the first column whose Monday is a day 1-7', () => {
    // Columns start Aug 24; Sep 1 falls in the Aug 31 column, so Sep is
    // marked on the Sep 7 column, as on the web.
    const grid = buildGrid([], 9, at(2026, 10, 22));
    expect(monthMarkers(grid, 'en')).toEqual([
      { col: 2, label: 'Sep' },
      { col: 6, label: 'Oct' },
    ]);
    expect(monthMarkers(grid, 'uk')[1].label).toBe('Жов');
  });

  it('tooltips with en/uk plurals', () => {
    expect(heatmapTooltip('2026-10-01', 0)).toBe('2026-10-01 — no sessions');
    expect(heatmapTooltip('2026-10-01', 1)).toBe('2026-10-01 — 1 session');
    expect(heatmapTooltip('2026-10-01', 3)).toBe('2026-10-01 — 3 sessions');
    expect(heatmapTooltip('d', 0, 'uk')).toBe('d — без сесій');
    expect(heatmapTooltip('d', 21, 'uk')).toBe('d — 21 сесія');
    expect(heatmapTooltip('d', 3, 'uk')).toBe('d — 3 сесії');
    expect(heatmapTooltip('d', 12, 'uk')).toBe('d — 12 сесій');
  });

  it('buckets timeline points by local day', () => {
    const pts = [at(2026, 10, 1, 1), at(2026, 10, 1, 23), at(2026, 10, 2)].map((d) => ({ endedAt: d.toISOString() }));
    expect(bucketByLocalDay(pts)).toEqual([
      { date: '2026-10-01', count: 2 },
      { date: '2026-10-02', count: 1 },
    ]);
  });
});

describe('rating history', () => {
  it('niceStep ladder', () => {
    expect([1, 25, 26, 100, 101, 240, 251, 999, 5000].map(niceStep)).toEqual([25, 25, 50, 100, 200, 250, 500, 1000, 1000]);
  });

  it('smoothPath', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 1, y: 2 }])).toBe('M1,2');
    expect(smoothPath([{ x: 0, y: 0 }, { x: 12, y: 6 }, { x: 24, y: 0 }])).toBe(
      'M0,0 C1,0.5 10,6 12,6 C14,6 23,0.5 24,0',
    );
  });

  it('ratingScale', () => {
    expect(ratingScale([])).toEqual({ yMin: 1100, yMax: 1500, gridStops: [1100, 1200, 1300, 1400, 1500] });
    expect(ratingScale([1210, 1390])).toEqual({ yMin: 1175, yMax: 1425, gridStops: [1200, 1250, 1300, 1350, 1400] });
    expect(ratingScale([1500])).toEqual({ yMin: 1487.5, yMax: 1512.5, gridStops: [1500] });
  });

  const pts: RatingPoint[] = [
    { endedAt: '2026-10-01T10:00:00Z', style: 'blitz', rating: 1300 },
    { endedAt: '2026-10-02T10:00:00Z', style: 'rapid', rating: 1400 },
    { endedAt: '2026-10-03T10:00:00Z', style: 'blitz', rating: 1350 },
  ];

  it('lays out series in style order on an ordinal x axis', () => {
    const l = ratingChartLayout(pts, { width: 112, height: 124 })!;
    expect(l.series.map((s) => s.style)).toEqual(['rapid', 'blitz']);
    const blitz = l.series[1];
    expect(blitz.points.map((p) => p.x)).toEqual([0, 100]);
    expect(l.series[0].points[0].x).toBe(50);
    expect(blitz.last).toBe(1350);
    expect(blitz.showDots).toBe(true);
    expect(l.baseY).toBe(110);
    expect(blitz.areaPath.endsWith('L100,110 L0,110 Z')).toBe(true);
    for (const g of l.grid) expect(g.y).toBeGreaterThanOrEqual(10);
    expect(ratingChartLayout([], { width: 100, height: 100 })).toBeNull();
  });

  it('identical points get distinct x (web bug fixed)', () => {
    const dup: RatingPoint[] = [pts[0], { ...pts[0] }, pts[2]];
    const xs = ratingChartLayout(dup, { width: 112, height: 124 })!.series[0].points.map((p) => p.x);
    expect(xs).toEqual([0, 50, 100]);
  });
});

describe('radar', () => {
  it('wrapLabel splits long multi-word labels at the most balanced space', () => {
    expect(wrapLabel('Fork')).toEqual(['Fork']);
    expect(wrapLabel('Discovered attack')).toEqual(['Discovered', 'attack']);
    expect(wrapLabel('Capturing the defender')).toEqual(['Capturing', 'the defender']);
    expect(wrapLabel('Underpromotion')).toEqual(['Underpromotion']);
  });

  it('geometry', () => {
    const g = radarGeometry(
      [{ label: 'A', value: 2000 }, { label: 'B', value: 1500 }, { label: 'C', value: 1000 }, { label: 'D', value: 1500 }],
      { min: 1000, max: 2000, size: 288 },
    )!;
    expect([g.cx, g.cy, g.r, g.viewX, g.viewW]).toEqual([144, 144, 100, -40, 368]);
    expect(g.poly[0].x).toBeCloseTo(144);
    expect(g.poly[0].y).toBeCloseTo(44);   // top spoke at full scale
    expect(g.poly[1].x).toBeCloseTo(194);  // right spoke at half scale
    expect(g.poly[2].y).toBeCloseTo(144);  // bottom spoke at min collapses to centre
    expect(g.ringPaths).toHaveLength(5);
    expect(g.ringLabels.map((l) => l.value)).toEqual([1200, 1400, 1600, 1800, 2000]);
    expect(g.axisLabels.map((l) => l.anchor)).toEqual(['middle', 'start', 'middle', 'end']);
    expect(radarGeometry([])).toBeNull();
  });

  it('default scale includes 0 and spans at least 100', () => {
    const g = radarGeometry([{ label: 'A', value: 50 }])!;
    expect([g.scaleMin, g.scaleMax]).toEqual([0, 100]);
  });

  it('radar data selection and bounds', () => {
    const themes = [
      { slug: 'pin', rating: 1500, attempts: 10 },
      { slug: 'fork', rating: 1650, attempts: 30 },
      { slug: 'middlegame', rating: 1600, attempts: 99 },
      { slug: 'skewer', rating: 0, attempts: 50 },
      ...Array.from({ length: 8 }, (_, i) => ({ slug: `zz${i}`, rating: 1400, attempts: 20 - i })),
    ];
    const data = selectRadarThemes(themes, 'en');
    expect(data).toHaveLength(8);
    expect(data[0]).toEqual({ label: 'Fork', value: 1650 });
    expect(data.some((d) => d.label === 'Pin')).toBe(false); // least attempted, cut by top 8
    expect(radarBounds(data)).toEqual({ min: 1300, max: 1800 });
    expect(radarBounds([])).toEqual({ min: 1200, max: 2000 });
    expect(radarBounds([{ label: 'x', value: 620 }])).toEqual({ min: 600, max: 800 });
  });
});

// Pure parts of apps/frontend/src/components/charts/ActivityHeatmap.tsx
// and the analytics page's day bucketing.
import { formatLocalDate } from '../format';

export type HeatmapDatum = { date: string; count: number };
export type HeatmapCell = { date: string; dateObj: Date; count: number; level: number };
/** weeks[col][row]: col 0 is the oldest week, row 0 is Monday. Future
 *  days in the current week are null. */
export type HeatmapGrid = { weeks: Array<Array<HeatmapCell | null>> };

export const HEATMAP_DAY_LABELS = {
  en: ['Mon', '', 'Wed', '', 'Fri', '', ''],
  uk: ['Пн', '', 'Ср', '', 'Пт', '', ''],
};

export const HEATMAP_MONTH_LABELS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  uk: ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'],
};

// Hardcoded on the web too (not in the i18n dicts).
export const HEATMAP_LEGEND = {
  en: { less: 'Less', more: 'More' },
  uk: { less: 'Менше', more: 'Більше' },
};

/** Sessions per local calendar day, for the heatmap. Note the day is the
 *  device's TZ at render time, not the one the session was played in. */
export function bucketByLocalDay(points: Array<{ endedAt: string }>): HeatmapDatum[] {
  const counts = new Map<string, number>();
  for (const p of points) {
    const key = formatLocalDate(new Date(p.endedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}

/**
 * GitHub-style grid: 7 rows (Mon..Sun) × `weeks` columns ending at the
 * current week. Missing days count as 0.
 */
export function buildGrid(data: HeatmapDatum[], weeks: number, now: Date = new Date()): HeatmapGrid {
  const counts = new Map(data.map((d) => [d.date, d.count]));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  // Walk back to Monday-of-current-week so each column is Mon..Sun.
  const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const endMon = new Date(today);
  endMon.setDate(today.getDate() - dayOfWeek);
  // Start of grid = Monday of (weeks - 1) weeks before endMon.
  const startMon = new Date(endMon);
  startMon.setDate(endMon.getDate() - (weeks - 1) * 7);

  const cols: Array<Array<HeatmapCell | null>> = [];
  for (let w = 0; w < weeks; w++) {
    const colStart = new Date(startMon);
    colStart.setDate(startMon.getDate() + w * 7);
    const col: Array<HeatmapCell | null> = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(colStart);
      cellDate.setDate(colStart.getDate() + d);
      // Future days in the rightmost column render empty.
      if (cellDate > today) {
        col.push(null);
        continue;
      }
      const key = formatLocalDate(cellDate);
      const count = counts.get(key) ?? 0;
      col.push({ date: key, dateObj: cellDate, count, level: levelFor(count) });
    }
    cols.push(col);
  }
  return { weeks: cols };
}

/** Absolute buckets (1, 2-3, 4-7, 8+) rather than relative to the max, so
 *  a quiet week stays light even after a binge months ago. */
export function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 7) return 3;
  return 4;
}

/** Month label above the first column whose first day falls in a new
 *  month's first week. */
export function monthMarkers(grid: HeatmapGrid, language: 'en' | 'uk' = 'en'): Array<{ col: number; label: string }> {
  const monthLabels = HEATMAP_MONTH_LABELS[language] ?? HEATMAP_MONTH_LABELS.en;
  const marks: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  grid.weeks.forEach((week, col) => {
    const firstDay = week.find((d) => d != null);
    if (!firstDay) return;
    const m = firstDay.dateObj.getMonth();
    if (m !== lastMonth && firstDay.dateObj.getDate() <= 7) {
      marks.push({ col, label: monthLabels[m] });
      lastMonth = m;
    }
  });
  return marks;
}

export function heatmapTooltip(date: string, count: number, language: 'en' | 'uk' = 'en'): string {
  if (language === 'uk') {
    return count === 0
      ? `${date} — без сесій`
      : `${date} — ${count} ${pluralizeUk(count, ['сесія', 'сесії', 'сесій'])}`;
  }
  return count === 0
    ? `${date} — no sessions`
    : `${date} — ${count} session${count === 1 ? '' : 's'}`;
}

function pluralizeUk(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type Datum = { date: string; count: number };

type Props = {
  /** Pre-bucketed daily counts in 'YYYY-MM-DD' format. Days that
   *  weren't played can be omitted — the grid renders all weekdays
   *  in the window and treats missing days as 0. */
  data: Datum[];
  /** Number of weeks to render. 52 ≈ a full year. */
  weeks?: number;
  language?: 'en' | 'uk';
  className?: string;
};

const DAY_LABELS = {
  en: ['Mon', '', 'Wed', '', 'Fri', '', ''],
  uk: ['Пн', '', 'Ср', '', 'Пт', '', ''],
};

const MONTH_LABELS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  uk: ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'],
};

/**
 * GitHub-style contributions heatmap. 7 rows (Mon at top, Sun at
 * bottom — same as GitHub since Apr 2020) × N weeks. Each cell is
 * a small rounded square coloured by activity intensity at five
 * levels (0..4). Weeks run left→right ending at the current week.
 *
 * The intensity buckets are absolute (1, 2-3, 4-7, 8+) rather than
 * relative to the user's max — keeps the visual stable as the user
 * plays more (a quiet week stays light even if the player went on
 * a binge two months ago).
 */
export function ActivityHeatmap({ data, weeks = 52, language = 'en', className }: Props) {
  const grid = useMemo(() => buildGrid(data, weeks), [data, weeks]);
  const [hover, setHover] = useState<{ date: string; count: number } | null>(null);

  const dayLabels = DAY_LABELS[language] ?? DAY_LABELS.en;
  const monthLabels = MONTH_LABELS[language] ?? MONTH_LABELS.en;

  // Find which week-column each new month starts in (label rendered
  // above the first column whose first day-of-month falls inside).
  const monthMarkers = useMemo(() => {
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
  }, [grid, monthLabels]);

  return (
    <div className={cn('relative', className)}>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-1.5 min-w-fit">
          {/* Day-labels column. The first cell is a spacer so the
              labels line up with cells, not with the month-labels
              row above. */}
          <div className="flex flex-col gap-[3px] text-[9px] text-zinc-500 leading-[11px] select-none pt-[14px]">
            {dayLabels.map((label, i) => (
              <div key={i} className="h-[11px] flex items-center">{label}</div>
            ))}
          </div>
          {/* Right column: month labels on top, cell grid below. */}
          <div className="flex flex-col gap-1.5">
            <div
              className="grid gap-[3px] text-[9px] text-zinc-500 leading-none h-[11px]"
              style={{ gridTemplateColumns: `repeat(${weeks}, 11px)` }}
            >
              {Array.from({ length: weeks }).map((_, col) => {
                const mark = monthMarkers.find((m) => m.col === col);
                return (
                  <div key={col} className="whitespace-nowrap overflow-visible">
                    {mark?.label}
                  </div>
                );
              })}
            </div>
            <div
              className="grid gap-[3px]"
              style={{
                gridTemplateColumns: `repeat(${weeks}, 11px)`,
                gridTemplateRows: 'repeat(7, 11px)',
                gridAutoFlow: 'column',
              }}
            >
              {grid.weeks.flatMap((week, col) =>
                week.map((cell, row) => (
                  <div
                    key={`${col}-${row}`}
                    className={cn(
                      'h-[11px] w-[11px] rounded-sm transition-colors',
                      cell ? levelClass(cell.level) : 'bg-transparent',
                    )}
                    onMouseEnter={() => cell && setHover({ date: cell.date, count: cell.count })}
                    onMouseLeave={() => setHover(null)}
                    title={cell ? formatTooltip(cell.date, cell.count, language) : undefined}
                    aria-label={cell ? formatTooltip(cell.date, cell.count, language) : undefined}
                  />
                )),
              )}
            </div>
          </div>
        </div>
      </div>

      {/* legend + live-region readout for the latest hovered cell
          (useful on touch where native title tooltips are flaky). */}
      <div className="flex items-center justify-between gap-2 mt-2 text-[10px] text-zinc-500">
        <span className="tabular-nums text-zinc-400 truncate">
          {hover ? formatTooltip(hover.date, hover.count, language) : ''}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span>{language === 'uk' ? 'Менше' : 'Less'}</span>
          {[0, 1, 2, 3, 4].map((lvl) => (
            <div key={lvl} className={cn('h-[11px] w-[11px] rounded-sm', levelClass(lvl))} />
          ))}
          <span>{language === 'uk' ? 'Більше' : 'More'}</span>
        </div>
      </div>
    </div>
  );
}

type Cell = { date: string; dateObj: Date; count: number; level: number };

function buildGrid(data: Datum[], weeks: number) {
  const counts = new Map(data.map((d) => [d.date, d.count]));
  // End at the most-recent Sunday (so the rightmost column ends on
  // the current week, with empty cells on future weekdays).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Walk back to Monday-of-current-week so each column is Mon..Sun.
  const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const endMon = new Date(today);
  endMon.setDate(today.getDate() - dayOfWeek);
  // Start of grid = Monday of (weeks - 1) weeks before endMon.
  const startMon = new Date(endMon);
  startMon.setDate(endMon.getDate() - (weeks - 1) * 7);

  const cols: Array<Array<Cell | null>> = [];
  for (let w = 0; w < weeks; w++) {
    const colStart = new Date(startMon);
    colStart.setDate(startMon.getDate() + w * 7);
    const col: Array<Cell | null> = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(colStart);
      cellDate.setDate(colStart.getDate() + d);
      // Future days in the rightmost column render empty.
      if (cellDate > today) {
        col.push(null);
        continue;
      }
      const key = formatDate(cellDate);
      const count = counts.get(key) ?? 0;
      col.push({
        date: key,
        dateObj: cellDate,
        count,
        level: levelFor(count),
      });
    }
    cols.push(col);
  }
  return { weeks: cols };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 7) return 3;
  return 4;
}

// Five-stop scale built from var(--accent) so the heatmap echoes
// the user's accent colour (red by default) — matches the streak
// flame visually and adapts when the user picks a custom accent.
function levelClass(level: number): string {
  switch (level) {
    case 0: return 'bg-white/[0.04] border border-white/[0.04]';
    case 1: return 'bg-[color-mix(in_srgb,var(--accent)_22%,transparent)]';
    case 2: return 'bg-[color-mix(in_srgb,var(--accent)_45%,transparent)]';
    case 3: return 'bg-[color-mix(in_srgb,var(--accent)_70%,transparent)]';
    case 4: return 'bg-[var(--accent)]';
    default: return 'bg-transparent';
  }
}

function formatTooltip(date: string, count: number, language: 'en' | 'uk' = 'en'): string {
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

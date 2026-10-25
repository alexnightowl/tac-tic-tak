import { describe, expect, it } from 'vitest';
import {
  fmtDuration, fmtResponseTime, formatLocalDate, formatSessionTime, groupSessionsByDay,
  localeFor, streakState,
} from '../src/format';

// Local-time constructors keep these tests TZ-independent.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe('number formats', () => {
  it('fmtResponseTime', () => {
    expect(fmtResponseTime(0)).toBe('0.0s');
    expect(fmtResponseTime(4250)).toBe('4.3s');
    expect(fmtResponseTime(12000)).toBe('12.0s');
  });

  it('fmtDuration', () => {
    expect(fmtDuration(0)).toBe('0:00');
    expect(fmtDuration(65)).toBe('1:05');
    expect(fmtDuration(3600)).toBe('60:00');
  });

  it('formatLocalDate uses local fields', () => {
    expect(formatLocalDate(at(2026, 1, 5, 0, 1))).toBe('2026-01-05');
    expect(formatLocalDate(at(2026, 12, 31, 23, 59))).toBe('2026-12-31');
  });

  it('localeFor', () => {
    expect(localeFor('uk')).toBe('uk-UA');
    expect(localeFor('en')).toBe('en-US');
    expect(localeFor('de')).toBe('en-US');
  });
});

describe('streakState', () => {
  const now = at(2026, 3, 1, 9);
  it('resolves each state against the injected clock', () => {
    expect(streakState(0, '2026-03-01', now)).toBe('none');
    expect(streakState(3, null, now)).toBe('none');
    expect(streakState(3, '2026-03-01', now)).toBe('secured');
    expect(streakState(3, '2026-02-28', now)).toBe('at_risk');
    expect(streakState(3, '2026-02-27', now)).toBe('broken');
    expect(streakState(3, '2026-03-02', now)).toBe('broken');
  });
});

describe('groupSessionsByDay', () => {
  const now = at(2026, 10, 25, 15); // Sunday
  const row = (id: string, d: Date) => ({ id, startedAt: d.toISOString() });

  it('buckets today / yesterday / weekday / dated, keeping input order', () => {
    const rows = [
      row('a', at(2026, 10, 25, 14)),
      row('b', at(2026, 10, 25, 0, 5)),
      row('c', at(2026, 10, 24, 23)),
      row('d', at(2026, 10, 21, 10)),
      row('e', at(2026, 10, 10, 10)),
    ];
    const en = groupSessionsByDay(rows, 'en', now);
    expect(en.map(([l, rs]) => [l, rs.map((r) => r.id)])).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['Wednesday', ['d']],
      ['Saturday, October 10', ['e']],
    ]);
    const uk = groupSessionsByDay(rows, 'uk', now);
    expect(uk[0][0]).toBe('Сьогодні');
    expect(uk[1][0]).toBe('Вчора');
    // uk weekday names are lower-case from Intl; the label is capitalised.
    expect(uk[2][0]).toBe('Середа');
  });

  it('empty input', () => {
    expect(groupSessionsByDay([], 'en', now)).toEqual([]);
  });

  it('labels yesterday correctly the day after a DST change', () => {
    // The web's `today - 24h` lands at 01:00 / 23:00 after a 25h / 23h
    // day. Covers EU and US fall-back and spring-forward; a no-op in
    // zones without DST.
    for (const [y, m, d] of [[2026, 10, 25], [2026, 3, 29], [2026, 11, 1], [2026, 3, 8]]) {
      const rows = [row('y', at(y, m, d, 1))];
      expect(groupSessionsByDay(rows, 'en', at(y, m, d + 1, 23))[0][0]).toBe('Yesterday');
    }
  });

  it('session time is 24h', () => {
    expect(formatSessionTime(at(2026, 10, 25, 16, 45).toISOString(), 'en')).toBe('16:45');
    expect(formatSessionTime(at(2026, 10, 25, 9, 5).toISOString(), 'uk')).toBe('09:05');
  });
});

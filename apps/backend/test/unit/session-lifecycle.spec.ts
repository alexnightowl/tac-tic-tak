import { localDayInZone, normalizeTimeZone } from '../../src/sessions/timezone';
import { PuzzleBufferService } from '../../src/puzzles/puzzle-buffer.service';

describe('normalizeTimeZone', () => {
  it('accepts real IANA zones as sent', () => {
    expect(normalizeTimeZone('Europe/Kyiv')).toBe('Europe/Kyiv');
    expect(normalizeTimeZone(' America/Port-au-Prince ')).toBe('America/Port-au-Prince');
    expect(normalizeTimeZone('Etc/GMT+2')).toBe('Etc/GMT+2');
    expect(normalizeTimeZone('UTC')).toBe('UTC');
  });
  it('rejects junk, fixed offsets and non-strings', () => {
    for (const bad of [undefined, null, 42, '', '   ', 'Mars/Olympus', '+02:00', 'Europe/Kyiv; DROP', 'a'.repeat(65)]) {
      expect(normalizeTimeZone(bad)).toBeNull();
    }
  });
});

describe('localDayInZone', () => {
  // 2026-10-25T22:30Z is already the 26th in Kyiv (UTC+2 after the DST switch)
  // and still the 25th in New York.
  const at = new Date('2026-10-25T22:30:00Z');
  it('formats the local calendar day', () => {
    expect(localDayInZone('Europe/Kyiv', at)).toBe('2026-10-26');
    expect(localDayInZone('America/New_York', at)).toBe('2026-10-25');
    expect(localDayInZone('UTC', at)).toBe('2026-10-25');
  });
});

describe('PuzzleBufferService.sessionKeyTtlSec', () => {
  it('is the session length plus 24 h', () => {
    expect(PuzzleBufferService.sessionKeyTtlSec(60)).toBe(60 + 86400);
    expect(PuzzleBufferService.sessionKeyTtlSec(3600)).toBe(3600 + 86400);
  });
});

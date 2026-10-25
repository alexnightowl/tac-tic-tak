import { parseArgs } from '../../src/scripts/seed-test-sessions';

describe('seed-test-sessions argv', () => {
  it('nickname only → 20 sessions, random style', () => {
    expect(parseArgs(['alice'])).toEqual({ nickname: 'alice', count: 20, style: 'any' });
  });
  it('nickname + count + --style', () => {
    expect(parseArgs(['alice', '5', '--style', 'bullet'])).toEqual({ nickname: 'alice', count: 5, style: 'bullet' });
    expect(parseArgs(['--style=rapid', 'bob', '3'])).toEqual({ nickname: 'bob', count: 3, style: 'rapid' });
  });
  it('rejects bad input via usage() → process.exit(1)', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => parseArgs([])).toThrow('exit 1');
      expect(() => parseArgs(['alice', 'zero'])).toThrow('exit 1');
      expect(() => parseArgs(['alice', '--style', 'classical'])).toThrow('exit 1');
      expect(() => parseArgs(['alice', '--count', '3'])).toThrow('exit 1');
    } finally {
      exit.mockRestore();
      err.mockRestore();
    }
  });
});

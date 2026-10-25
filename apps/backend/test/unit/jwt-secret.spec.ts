import { requireJwtSecret } from '../../src/auth/jwt-secret';

describe('requireJwtSecret (B2 fail-fast)', () => {
  it.each([{}, { JWT_SECRET: '' }, { JWT_SECRET: '  \n' }])('throws for %p', (env) => {
    expect(() => requireJwtSecret(env)).toThrow(/JWT_SECRET is not set/);
  });
  it('returns the value verbatim (no trim: existing prod tokens stay valid)', () => {
    expect(requireJwtSecret({ JWT_SECRET: ' s3cret ' })).toBe(' s3cret ');
  });
  it('no source file falls back to the old dev-secret literal', () => {
    // Guard against the fallback creeping back in.
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const src = path.join(__dirname, '../../src');
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
      );
    const offenders = walk(src)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('jwt-secret.ts'))
      .filter((f) => fs.readFileSync(f, 'utf8').includes("'dev-secret'"));
    expect(offenders).toEqual([]);
  });
});

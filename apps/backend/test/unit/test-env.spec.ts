import { assertSafeTestTargets } from '../test-env';

// The e2e harness TRUNCATEs every table and FLUSHDBs Redis; these guards
// are what keeps it off the owner's dev DB and prod.
describe('e2e target guards', () => {
  const okRedis = 'redis://localhost:6380/1';
  it('accepts the local taktic_test DB and a non-zero Redis index', () => {
    expect(() => assertSafeTestTargets('postgresql://taktic:taktic@localhost:5433/taktic_test?schema=public', okRedis)).not.toThrow();
  });
  it('refuses the dev DB, remote hosts and Redis index 0', () => {
    expect(() => assertSafeTestTargets('postgresql://taktic:taktic@localhost:5433/taktic', okRedis)).toThrow(/_test/);
    expect(() => assertSafeTestTargets('postgresql://u:p@tactictak.online:5432/taktic_test', okRedis)).toThrow(/non-local/);
    expect(() => assertSafeTestTargets('postgresql://taktic:taktic@localhost:5433/taktic_test', 'redis://localhost:6380')).toThrow(/index/);
    expect(() => assertSafeTestTargets('postgresql://taktic:taktic@localhost:5433/taktic_test', 'redis://localhost:6380/0')).toThrow(/index/);
    expect(() => assertSafeTestTargets('postgresql://taktic:taktic@localhost:5433/taktic_test', 'redis://10.0.0.5:6379/1')).toThrow(/non-local/);
  });
});

import { sweeperEnabled } from '../../src/sessions/session-sweeper.service';

describe('sweeperEnabled', () => {
  it('is off unless SESSION_SWEEPER_ENABLED is true/1', () => {
    expect(sweeperEnabled({})).toBe(false);
    expect(sweeperEnabled({ SESSION_SWEEPER_ENABLED: '' })).toBe(false);
    expect(sweeperEnabled({ SESSION_SWEEPER_ENABLED: 'false' })).toBe(false);
    expect(sweeperEnabled({ SESSION_SWEEPER_ENABLED: 'yes' })).toBe(false);
    expect(sweeperEnabled({ SESSION_SWEEPER_ENABLED: 'true' })).toBe(true);
    expect(sweeperEnabled({ SESSION_SWEEPER_ENABLED: ' TRUE ' })).toBe(true);
    expect(sweeperEnabled({ SESSION_SWEEPER_ENABLED: '1' })).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { LOG_LEVEL_VARIABLE, logLevelFrom } from '../src/terminal.js';

describe('logLevelFrom', () => {
  it('reads the level $EVE_FABRIC_LOG names, in any case', () => {
    expect(LOG_LEVEL_VARIABLE).toBe('EVE_FABRIC_LOG');
    expect(logLevelFrom({ EVE_FABRIC_LOG: 'debug' })).toBe('debug');
    expect(logLevelFrom({ EVE_FABRIC_LOG: ' Silent ' })).toBe('silent');
  });

  it('is info when the variable is unset or names no level', () => {
    expect(logLevelFrom({})).toBe('info');
    expect(logLevelFrom({ EVE_FABRIC_LOG: 'loud' })).toBe('info');
  });
});

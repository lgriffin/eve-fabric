import { describe, expect, it } from 'vitest';
import { envLogger, LOG_LEVEL_VARIABLE } from '../src/terminal.js';

function lines(env: Record<string, string>): string[] {
  const written: string[] = [];
  const log = envLogger((line) => written.push(line), env);
  log.debug('d');
  log.info('i');
  log.warn('w');
  return written;
}

describe('envLogger', () => {
  it('says as much as $EVE_FABRIC_LOG names, in any case', () => {
    expect(LOG_LEVEL_VARIABLE).toBe('EVE_FABRIC_LOG');
    expect(lines({ EVE_FABRIC_LOG: 'debug' })).toEqual(['debug: d', 'info: i', 'warn: w']);
    expect(lines({ EVE_FABRIC_LOG: ' WARN ' })).toEqual(['warn: w']);
    expect(lines({ EVE_FABRIC_LOG: 'silent' })).toEqual([]);
  });

  it('is info when the variable is unset', () => {
    expect(lines({})).toEqual(['info: i', 'warn: w']);
  });

  it('says when the variable names no level, then uses info', () => {
    expect(lines({ EVE_FABRIC_LOG: 'loud' })).toEqual([
      'warn: EVE_FABRIC_LOG names no level; using info value=loud',
      'info: i',
      'warn: w',
    ]);
  });
});

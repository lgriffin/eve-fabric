import { describe, it, expect } from 'vitest';
import {
  createLogger,
  formatLogEntry,
  isLogLevel,
  memoryLogger,
  silentLogger,
} from '../src/ports/logger.js';

function captured(level?: Parameters<typeof createLogger>[0]['level']) {
  const lines: string[] = [];
  const log = createLogger({ level, write: (line) => lines.push(line) });
  return { lines, log };
}

describe('Logger port', () => {
  it('writes info and above by default, one line each', () => {
    const { lines, log } = captured();
    log.debug('hidden');
    log.info('opened');
    log.warn('slow');
    log.error('failed');
    expect(lines).toEqual(['info: opened', 'warn: slow', 'error: failed']);
  });

  it('drops entries below the level it is given', () => {
    const { lines, log } = captured('warn');
    log.info('quiet');
    log.warn('said');
    expect(lines).toEqual(['warn: said']);
  });

  it('writes debug when asked, and nothing when silent', () => {
    const verbose = captured('debug');
    verbose.log.debug('everything');
    expect(verbose.lines).toEqual(['debug: everything']);
    const quiet = captured('silent');
    quiet.log.error('nothing');
    expect(quiet.lines).toEqual([]);
  });

  it('formats fields after the message, quoting spaced strings and naming errors', () => {
    expect(
      formatLogEntry({
        level: 'warn',
        message: 'kept weave skipped',
        fields: {
          weave: 'jumps@1.0.0',
          reason: 'no longer adds',
          count: 2,
          error: new TypeError('bad'),
          absent: undefined,
        },
      }),
    ).toBe(
      'warn: kept weave skipped weave=jumps@1.0.0 reason="no longer adds" count=2 error=TypeError: bad',
    );
  });

  it('takes its own format', () => {
    const lines: string[] = [];
    const log = createLogger({ write: (l) => lines.push(l), format: (e) => JSON.stringify(e) });
    log.info('hi', { n: 1 });
    expect(lines).toEqual(['{"level":"info","message":"hi","fields":{"n":1}}']);
  });

  it('memoryLogger keeps every entry at every level', () => {
    const log = memoryLogger();
    log.debug('a');
    log.error('b', { id: 7 });
    expect(log.entries).toEqual([
      { level: 'debug', message: 'a' },
      { level: 'error', message: 'b', fields: { id: 7 } },
    ]);
  });

  it('silentLogger says nothing and does not throw', () => {
    expect(() => silentLogger.error('ignored')).not.toThrow();
  });

  it('isLogLevel accepts the levels and silent, nothing else', () => {
    expect(['debug', 'info', 'warn', 'error', 'silent'].every((l) => isLogLevel(l))).toBe(true);
    expect(isLogLevel('verbose')).toBe(false);
    expect(isLogLevel(undefined)).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  createLogger,
  formatLogEntry,
  readLogLevel,
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

  it('formats fields after the message, quoting spaced strings', () => {
    expect(
      formatLogEntry({
        level: 'warn',
        message: 'kept weave skipped',
        fields: { weave: 'jumps@1.0.0', reason: 'no longer adds', count: 2, absent: undefined },
      }),
    ).toBe('warn: kept weave skipped weave=jumps@1.0.0 reason="no longer adds" count=2');
  });

  it("keeps an error field's stack and its causes", () => {
    const error = new Error('outer', { cause: new TypeError('inner') });
    const line = formatLogEntry({ level: 'error', message: 'stopped', fields: { error } });
    expect(line).toMatch(/^error: stopped error=Error: outer\n\s+at /);
    expect(line).toContain('caused by: TypeError: inner');
    const bare = new Error('no stack');
    bare.stack = undefined;
    expect(formatLogEntry({ level: 'error', message: 'x', fields: { bare } })).toBe(
      'error: x bare=Error: no stack',
    );
  });

  it('never throws over a field it cannot serialise', () => {
    const cycle: Record<string, unknown> = {};
    cycle['self'] = cycle;
    expect(formatLogEntry({ level: 'info', message: 'odd', fields: { n: 10n, cycle } })).toBe(
      'info: odd n=10 cycle=[object Object]',
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

  it('readLogLevel parses an outside value, in any case', () => {
    expect(['debug', 'info', 'warn', 'error', 'silent'].map((l) => readLogLevel(l).level)).toEqual([
      'debug',
      'info',
      'warn',
      'error',
      'silent',
    ]);
    expect(readLogLevel(' Warn ')).toEqual({ level: 'warn' });
  });

  it('readLogLevel is info when unset, and names a value that is no level', () => {
    expect(readLogLevel(undefined)).toEqual({ level: 'info' });
    expect(readLogLevel('  ')).toEqual({ level: 'info' });
    expect(readLogLevel('verbose')).toEqual({ level: 'info', invalid: 'verbose' });
  });
});

/**
 * The two Node channels a program built on the fabric writes to: stdout for
 * what it exists to print, and a `Logger` over stderr for everything else
 * (FAB-LOG-01). Nothing in the fabric calls `console`.
 */
import { createLogger, readLogLevel, type Logger, type LogLevel } from '@eve-fabric/core';

/** The variable that sets how much a logger says: debug, info, warn, error or silent. */
export const LOG_LEVEL_VARIABLE = 'EVE_FABRIC_LOG';

type Env = Readonly<Record<string, string | undefined>>;

/**
 * A logger over `write` at the level `EVE_FABRIC_LOG` names (info when unset).
 * A value that names no level is said, as a warning, and info is used.
 */
export function envLogger(write: (line: string) => void, env: Env): Logger {
  const { level, invalid } = readLogLevel(env[LOG_LEVEL_VARIABLE]);
  const log = createLogger({ level, write });
  if (invalid !== undefined) {
    log.warn(`${LOG_LEVEL_VARIABLE} names no level; using info`, { value: invalid });
  }
  return log;
}

export interface StderrLoggerOptions {
  /** Wins over the environment when set. */
  readonly level?: LogLevel | 'silent' | undefined;
  /** Read for `EVE_FABRIC_LOG`; the process's by default. */
  readonly env?: Env | undefined;
}

/** A logger writing one line per entry to stderr. */
export function stderrLogger(options?: StderrLoggerOptions): Logger {
  const write = (line: string): void => {
    process.stderr.write(`${line}\n`);
  };
  return options?.level === undefined
    ? envLogger(write, options?.env ?? process.env)
    : createLogger({ level: options.level, write });
}

/** Writes a line of output (an answer, a report) to stdout. */
export function printLine(text = ''): void {
  process.stdout.write(`${text}\n`);
}

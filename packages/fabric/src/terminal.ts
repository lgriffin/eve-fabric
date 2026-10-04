/**
 * The two Node channels a program built on the fabric writes to: stdout for
 * what it exists to print, and a `Logger` over stderr for everything else
 * (FAB-LOG-01). Nothing in the fabric calls `console`.
 */
import { createLogger, isLogLevel, type Logger, type LogLevel } from '@eve-fabric/core';

/** The variable that sets how much `stderrLogger` says: debug, info, warn, error or silent. */
export const LOG_LEVEL_VARIABLE = 'EVE_FABRIC_LOG';

export interface StderrLoggerOptions {
  /** Wins over the environment when set. */
  readonly level?: LogLevel | 'silent' | undefined;
  /** Read for `EVE_FABRIC_LOG`; the process's by default. */
  readonly env?: Readonly<Record<string, string | undefined>> | undefined;
}

/** The level `EVE_FABRIC_LOG` names, or `info` when it is unset or names none. */
export function logLevelFrom(
  env: Readonly<Record<string, string | undefined>>,
): LogLevel | 'silent' {
  const named = env[LOG_LEVEL_VARIABLE]?.trim().toLowerCase();
  return isLogLevel(named) ? named : 'info';
}

/** A logger writing one line per entry to stderr. */
export function stderrLogger(options?: StderrLoggerOptions): Logger {
  return createLogger({
    level: options?.level ?? logLevelFrom(options?.env ?? process.env),
    write: (line) => process.stderr.write(`${line}\n`),
  });
}

/** Writes a line of output (an answer, a report) to stdout. */
export function printLine(text = ''): void {
  process.stdout.write(`${text}\n`);
}

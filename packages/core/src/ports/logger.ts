/**
 * The only way fabric code reports what it is doing (FAB-LOG-01). A logger
 * carries diagnostics: warnings, notes and failures, never the answer. What a
 * command exists to print (an answer, a table, a report) goes to its output
 * channel instead, so stdout stays the result and stderr the commentary.
 *
 * The core holds no sink: a logger writes lines to whatever `write` it is
 * given. Node callers pass stderr (`stderrLogger` in `@eve-fabric/fabric`);
 * tests pass `memoryLogger()` to read what was said, or `silentLogger`.
 */

import { z } from 'zod';

/** How much a logger says, least to most severe. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * A level as an outsider names it (an environment variable, a flag): one of
 * the levels or `silent`, in any case and with surrounding space.
 */
export const LogLevelSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum([...LOG_LEVELS, 'silent']));

/** Structured context for an entry: ids, counts, the error that caused it. */
export type LogFields = Readonly<Record<string, unknown>>;

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly fields?: LogFields | undefined;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export interface LoggerOptions {
  /** Receives each entry at or above `level`, formatted as one line by default. */
  readonly write: (line: string) => void;
  /** The least severe level written; `info` by default, `silent` writes nothing. */
  readonly level?: LogLevel | 'silent' | undefined;
  /** Turns an entry into the line written; `formatLogEntry` by default. */
  readonly format?: ((entry: LogEntry) => string) | undefined;
}

/**
 * The level an outside value names: `info` when it is unset, and `invalid`
 * set to the value when it names none (the level is then `info` too), so the
 * caller can say so rather than guess.
 */
export function readLogLevel(value: string | undefined): {
  readonly level: LogLevel | 'silent';
  readonly invalid?: string;
} {
  if (value === undefined || value.trim() === '') return { level: 'info' };
  const parsed = LogLevelSchema.safeParse(value);
  return parsed.success ? { level: parsed.data } : { level: 'info', invalid: value };
}

/** An error with its stack (which names it) and the chain of causes under it. */
function errorText(error: Error): string {
  const own = error.stack ?? `${error.name}: ${error.message}`;
  return error.cause === undefined ? own : `${own}\ncaused by: ${valueText(error.cause)}`;
}

function valueText(value: unknown): string {
  if (value instanceof Error) return errorText(value);
  if (typeof value === 'string') return /\s/.test(value) ? JSON.stringify(value) : value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // A BigInt or a cycle; a logger never throws over what it was handed.
    return String(value);
  }
}

/**
 * `warn: kept weave skipped weave=jumps@1.0.0`: the level, the message, then
 * each field. An error field carries its stack and causes, so it spans lines.
 */
export function formatLogEntry(entry: LogEntry): string {
  const fields = Object.entries(entry.fields ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${valueText(value)}`);
  return [`${entry.level}: ${entry.message}`, ...fields].join(' ');
}

/** A logger over any line sink, dropping entries below `level`. */
export function createLogger(options: LoggerOptions): Logger {
  const threshold =
    options.level === 'silent' ? LOG_LEVELS.length : LOG_LEVELS.indexOf(options.level ?? 'info');
  const format = options.format ?? formatLogEntry;
  const at =
    (level: LogLevel) =>
    (message: string, fields?: LogFields): void => {
      if (LOG_LEVELS.indexOf(level) >= threshold) options.write(format({ level, message, fields }));
    };
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}

/** Says nothing; for library callers who want quiet. */
export const silentLogger: Logger = createLogger({ write: () => undefined, level: 'silent' });

/** A logger that keeps every entry (all levels) in `entries`, for tests. */
export interface MemoryLogger extends Logger {
  readonly entries: readonly LogEntry[];
}

export function memoryLogger(): MemoryLogger {
  const entries: LogEntry[] = [];
  const at =
    (level: LogLevel) =>
    (message: string, fields?: LogFields): void => {
      entries.push(fields === undefined ? { level, message } : { level, message, fields });
    };
  return { entries, debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}

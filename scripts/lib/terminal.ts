/**
 * The scripts' two channels (FAB-LOG-01): `print` for what a script reports
 * (stdout), `log` for warnings and failures (stderr, at $EVE_FABRIC_LOG's
 * level). Imports the core's logger by path so the lint and check scripts run
 * before anything is built.
 */
import { createLogger, readLogLevel, type Logger } from '../../packages/core/src/ports/logger.js';

const { level, invalid } = readLogLevel(process.env['EVE_FABRIC_LOG']);

export const log: Logger = createLogger({
  level,
  write: (line) => process.stderr.write(`${line}\n`),
});
if (invalid !== undefined)
  log.warn('EVE_FABRIC_LOG names no level; using info', { value: invalid });

/** One line of a script's report, on stdout. */
export function print(text = ''): void {
  process.stdout.write(`${text}\n`);
}

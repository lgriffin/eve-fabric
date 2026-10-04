/**
 * The scripts' two channels (FAB-LOG-01): `print` for what a script reports
 * (stdout), `log` for warnings and failures (stderr, at $EVE_FABRIC_LOG's
 * level). Imports the core's logger by path so the lint and check scripts run
 * before anything is built.
 */
import { createLogger, isLogLevel, type Logger } from '../../packages/core/src/ports/logger.js';

const level = process.env['EVE_FABRIC_LOG']?.trim().toLowerCase();

export const log: Logger = createLogger({
  level: isLogLevel(level) ? level : 'info',
  write: (line) => process.stderr.write(`${line}\n`),
});

/** One line of a script's report, on stdout. */
export function print(text = ''): void {
  process.stdout.write(`${text}\n`);
}

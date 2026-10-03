/**
 * `pnpm quickstart [--live]`: runs the walkthrough in ./quickstart.ts and
 * writes what it saves to examples/quickstart/out/.
 */
import { join } from 'node:path';
import { runQuickstart } from './quickstart.js';

const live = process.argv.includes('--live');

function explain(error: unknown): string {
  const cause = (error as { cause?: { statusCode?: number; url?: string } }).cause;
  if (live && cause?.url !== undefined) {
    return [
      `ESI did not answer (${String(cause.statusCode ?? 'no response')} from ${cause.url}).`,
      'Check your network or proxy, or run `pnpm quickstart` without --live to use the offline fixture.',
    ].join('\n');
  }
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

runQuickstart({ live, outDir: join(process.cwd(), 'examples', 'quickstart', 'out') }).catch(
  (error: unknown) => {
    console.error(`\nThe quickstart stopped: ${explain(error)}`);
    process.exitCode = 1;
  },
);

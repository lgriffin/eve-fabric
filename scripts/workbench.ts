/**
 * pnpm workbench: the gateway over the offline Tranquility fixture, and the
 * designer against it, so the whole designer works with no ESI access and no
 * SDE download. `--live` uses Tranquility's ESI (names still come from the
 * fixture); `--no-designer` starts the gateway alone.
 *
 * Gateway: http://localhost:3456 (PORT to change). Designer: http://localhost:5173
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createStaticSource } from '@eve-fabric/source-sde';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/test-support';
import { createServer } from '../apps/gateway/src/server.js';

const live = process.argv.includes('--live');
const port = Number(process.env['PORT'] ?? 3456);
const DESIGNER = join(import.meta.dirname, '..', 'apps', 'designer');

async function main(): Promise<void> {
  const app = createServer({
    logger: false,
    ...(live ? {} : { esi: tranquilityEsi().esi }),
    sde: createStaticSource(tranquilitySde()),
  });
  await app.listen({ port, host: '127.0.0.1' });
  console.log(
    `Gateway on http://localhost:${String(port)} (${live ? 'live ESI' : 'offline Tranquility fixture'})`,
  );
  console.log(
    '  The fixture knows Tritanium, Pyerite, Mexallon, Isogen, Rifter; The Forge, Domain;',
  );
  console.log('  Jita, Perimeter, Urlen, Sivala, Amarr.');

  const designer = process.argv.includes('--no-designer')
    ? undefined
    : spawn(process.execPath, [join(DESIGNER, 'node_modules', 'vite', 'bin', 'vite.js')], {
        cwd: DESIGNER,
        stdio: 'inherit',
      });

  const stop = (): void => {
    designer?.kill();
    void app.close().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  designer?.on('exit', stop);
}

main().catch((error: unknown) => {
  console.error(
    `The workbench did not start: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
